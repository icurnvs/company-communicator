import { useCallback, useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { UseFormReturn } from 'react-hook-form';
import {
  composeFormSchema,
  type ComposeFormValues,
  formValuesToCreateRequest,
  formValuesToUpdateRequest,
} from '@/lib/validators';
import {
  useNotification,
  useCreateNotification,
  useUpdateNotification,
} from '@/api/notifications';
import type { AdvancedBlock, CardPreference, KeyDetailPair, CustomVariable } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseComposeFormOptions {
  editId?: string | null;
  onSaved?: (id: string) => void;
  /** Pre-fill the form with these values (used for "clone" / "use as template"). */
  initialValues?: Partial<ComposeFormValues> | null;
}

export interface UseComposeFormReturn {
  form: UseFormReturn<ComposeFormValues>;
  isLoading: boolean;
  isSaving: boolean;
  saveDraft: () => Promise<string | undefined>;
  isDirty: boolean;
  isEdit: boolean;
  notificationId: string | null;
  lastAutoSaved: Date | null;
}

// ---------------------------------------------------------------------------
// Helpers — parse JSON fields from NotificationDto
// ---------------------------------------------------------------------------

function parseKeyDetails(raw: string | null): KeyDetailPair[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return parsed as KeyDetailPair[];
    }
    return null;
  } catch {
    return null;
  }
}

function parseCustomVariables(raw: string | null): CustomVariable[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      // Backend stores as Record<string, string>; convert to name/value pairs
      return Object.entries(parsed as Record<string, string>).map(
        ([name, value]) => ({ name, value }),
      );
    }
    return null;
  } catch {
    return null;
  }
}

function parseAdvancedBlocks(raw: string | null): AdvancedBlock[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return parsed as AdvancedBlock[];
    }
    return null;
  } catch {
    return null;
  }
}

function parseCardPreference(raw: string | null): CardPreference | null {
  if (raw === 'Standard' || raw === 'Advanced') return raw;
  return null;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useComposeForm({
  editId,
  onSaved,
  initialValues,
}: UseComposeFormOptions): UseComposeFormReturn {
  const isEdit = Boolean(editId);

  // Tracks the current notification ID (null when composing a new message
  // that has not yet been saved, then set after first create).
  const [notificationId, setNotificationId] = useState<string | null>(
    editId ?? null,
  );

  // Timestamp of the last successful auto-save (null until first auto-save).
  const [lastAutoSaved, setLastAutoSaved] = useState<Date | null>(null);

  // Keep notificationId in sync when editId changes from outside (e.g. parent
  // re-opens the panel on a different notification).
  useEffect(() => {
    setNotificationId(editId ?? null);
    setLastAutoSaved(null);
  }, [editId]);

  // ---------------------------------------------------------------------------
  // Form setup
  // ---------------------------------------------------------------------------

  const form = useForm<ComposeFormValues>({
    resolver: zodResolver(composeFormSchema),
    defaultValues: {
      headline: initialValues?.headline ?? '',
      body: initialValues?.body ?? '',
      imageLink: initialValues?.imageLink ?? '',
      keyDetails: initialValues?.keyDetails ?? null,
      buttonTitle: initialValues?.buttonTitle ?? '',
      buttonLink: initialValues?.buttonLink ?? '',
      secondaryText: initialValues?.secondaryText ?? '',
      customVariables: initialValues?.customVariables ?? null,
      cardPreference: initialValues?.cardPreference ?? 'Standard',
      advancedBlocks: initialValues?.advancedBlocks ?? null,
      allUsers: false,
      audiences: [],
    },
  });

  // ---------------------------------------------------------------------------
  // Load existing notification for edit mode
  // ---------------------------------------------------------------------------

  const { data: existingNotification, isLoading } = useNotification(
    editId ?? '',
    { enabled: Boolean(editId) },
  );

  // Guard against double-reset when the same data object reference arrives
  // more than once (TanStack Query can re-deliver the same value on refetch).
  const lastResetIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!existingNotification) return;
    if (lastResetIdRef.current === existingNotification.id) return;
    lastResetIdRef.current = existingNotification.id;

    form.reset({
      headline: existingNotification.title,
      body: existingNotification.summary ?? '',
      imageLink: existingNotification.imageLink ?? '',
      keyDetails: parseKeyDetails(existingNotification.keyDetails),
      buttonTitle: existingNotification.buttonTitle ?? '',
      buttonLink: existingNotification.buttonLink ?? '',
      secondaryText: existingNotification.secondaryText ?? '',
      customVariables: parseCustomVariables(existingNotification.customVariables),
      cardPreference: parseCardPreference(existingNotification.cardPreference),
      advancedBlocks: parseAdvancedBlocks(existingNotification.advancedBlocks),
      allUsers: existingNotification.allUsers,
      audiences: existingNotification.audiences ?? [],
    });
  }, [existingNotification, form]);

  // ---------------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------------

  const createMutation = useCreateNotification();
  const updateMutation = useUpdateNotification();

  const isSaving = createMutation.isPending || updateMutation.isPending;

  // ---------------------------------------------------------------------------
  // saveDraft — validates then creates or updates
  // ---------------------------------------------------------------------------

  // Use a ref so the auto-save interval can always see the latest notificationId
  // without stale closure issues.
  const notificationIdRef = useRef<string | null>(notificationId);
  useEffect(() => {
    notificationIdRef.current = notificationId;
  }, [notificationId]);

  const saveDraft = useCallback(async (): Promise<string | undefined> => {
    const valid = await form.trigger();
    if (!valid) return undefined;

    const values = form.getValues();

    try {
      let savedId: string;
      const currentId = notificationIdRef.current;

      if (currentId) {
        // Update existing
        const updated = await updateMutation.mutateAsync({
          id: currentId,
          body: formValuesToUpdateRequest(values),
        });
        savedId = updated.id;
      } else {
        // Create new
        const created = await createMutation.mutateAsync(
          formValuesToCreateRequest(values),
        );
        savedId = created.id;
        setNotificationId(savedId);
        notificationIdRef.current = savedId;
      }

      onSaved?.(savedId);
      return savedId;
    } catch {
      // Mutations surface errors via their own state; the caller can also
      // inspect mutation.error if it needs to display a specific message.
      return undefined;
    }
  }, [form, createMutation, updateMutation, onSaved]);

  // ---------------------------------------------------------------------------
  // Auto-save — every 30 seconds when dirty and headline is present
  // ---------------------------------------------------------------------------

  // Track whether a save is currently in progress to avoid concurrent saves.
  const isSavingRef = useRef(false);

  // Use a ref so the interval always calls the latest saveDraft without
  // needing to restart when mutation state changes (fixes M1).
  const saveDraftRef = useRef(saveDraft);
  useEffect(() => { saveDraftRef.current = saveDraft; }, [saveDraft]);

  useEffect(() => {
    const interval = setInterval(() => {
      const { isDirty } = form.formState;
      const headline = form.getValues('headline');
      const hasTitle = Boolean(headline?.trim());

      if (!isDirty || !hasTitle || isSavingRef.current) return;

      isSavingRef.current = true;
      void saveDraftRef.current().then((savedId) => {
        isSavingRef.current = false;
        if (savedId !== undefined) {
          setLastAutoSaved(new Date());
        }
      });
    }, 30_000);

    return () => { clearInterval(interval); };
  }, [form]); // Only depends on form, which is stable

  // ---------------------------------------------------------------------------
  // Return
  // ---------------------------------------------------------------------------

  return {
    form,
    isLoading: isEdit ? isLoading : false,
    isSaving,
    saveDraft,
    isDirty: form.formState.isDirty,
    isEdit,
    notificationId,
    lastAutoSaved,
  };
}
