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
}

export interface UseComposeFormReturn {
  form: UseFormReturn<ComposeFormValues>;
  isLoading: boolean;
  isSaving: boolean;
  saveDraft: () => Promise<string | undefined>;
  isDirty: boolean;
  isEdit: boolean;
  notificationId: string | null;
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
}: UseComposeFormOptions): UseComposeFormReturn {
  const isEdit = Boolean(editId);

  // Tracks the current notification ID (null when composing a new message
  // that has not yet been saved, then set after first create).
  const [notificationId, setNotificationId] = useState<string | null>(
    editId ?? null,
  );

  // Keep notificationId in sync when editId changes from outside (e.g. parent
  // re-opens the panel on a different notification).
  useEffect(() => {
    setNotificationId(editId ?? null);
  }, [editId]);

  // ---------------------------------------------------------------------------
  // Form setup
  // ---------------------------------------------------------------------------

  const form = useForm<ComposeFormValues>({
    resolver: zodResolver(composeFormSchema),
    defaultValues: {
      headline: '',
      body: '',
      imageLink: '',
      keyDetails: null,
      buttonTitle: '',
      buttonLink: '',
      secondaryText: '',
      customVariables: null,
      cardPreference: 'Standard',
      advancedBlocks: null,
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

  const saveDraft = useCallback(async (): Promise<string | undefined> => {
    const valid = await form.trigger();
    if (!valid) return undefined;

    const values = form.getValues();

    try {
      let savedId: string;

      if (notificationId) {
        // Update existing
        const updated = await updateMutation.mutateAsync({
          id: notificationId,
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
      }

      onSaved?.(savedId);
      return savedId;
    } catch {
      // Mutations surface errors via their own state; the caller can also
      // inspect mutation.error if it needs to display a specific message.
      return undefined;
    }
  }, [form, notificationId, createMutation, updateMutation, onSaved]);

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
  };
}
