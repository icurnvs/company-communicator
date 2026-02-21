// components/TemplateEditor/useTemplateEditor.ts
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { TemplateDefinition, SlotDefinition, SlotType, TemplateCategory } from '@/types';
import { createBlankTemplateDef, serializeTemplateDefinition, parseTemplateDefinition } from '@/lib/templateDefinitions';
import { useCreateTemplate, useUpdateTemplate, useTemplates } from '@/api/templates';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum number of slots per template (prevents DnD perf issues and Teams card size limits). */
const MAX_SLOTS = 25;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseTemplateEditorOptions {
  /** Template ID to edit (from API). Null = create new. */
  editId?: string | null;
  onSaved?: () => void;
}

export interface UseTemplateEditorReturn {
  /** The current template definition being edited */
  template: TemplateDefinition;
  /** Whether we're editing an existing template or creating new */
  isEdit: boolean;
  /** True while loading an existing template for editing (show spinner, don't render editor). */
  isLoading: boolean;
  /** Currently selected slot ID (for center panel) */
  selectedSlotId: string | null;
  /** Select a slot for editing */
  selectSlot: (slotId: string | null) => void;

  // Metadata mutations
  setName: (name: string) => void;
  setDescription: (description: string) => void;
  setIconName: (iconName: string) => void;
  setCategory: (category: TemplateCategory) => void;
  setAccentColor: (color: string) => void;

  // Slot mutations
  addSlot: (type: SlotType) => void;
  removeSlot: (slotId: string) => void;
  reorderSlots: (fromIndex: number, toIndex: number) => void;
  updateSlot: (slotId: string, updates: Partial<SlotDefinition>) => void;

  // Save
  save: () => Promise<void>;
  isSaving: boolean;
  saveError: string | null;
  isDirty: boolean;
}

// ---------------------------------------------------------------------------
// ID generator
// ---------------------------------------------------------------------------

const generateSlotId = () =>
  typeof crypto?.randomUUID === 'function'
    ? crypto.randomUUID()
    : `slot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useTemplateEditor({
  editId,
  onSaved,
}: UseTemplateEditorOptions = {}): UseTemplateEditorReturn {
  // Load existing template data if editing
  const { data: allTemplates, isLoading: isQueryLoading } = useTemplates();
  const existingTemplate = useMemo(() => {
    if (!editId || !allTemplates) return null;
    const dto = allTemplates.find((t) => t.id === editId);
    if (!dto) return null;
    return parseTemplateDefinition(dto.cardSchema);
  }, [editId, allTemplates]);

  // isLoading = we have an editId but the data hasn't arrived yet.
  // The caller should show a spinner and NOT render the editor form.
  const isLoading = !!editId && !existingTemplate && isQueryLoading;

  const [template, setTemplate] = useState<TemplateDefinition>(createBlankTemplateDef);

  // Sync when existingTemplate loads (async) — uses useEffect instead of
  // render-time setState to avoid violating React's "render must be pure" rule
  // and prevent double-firing in StrictMode.
  const [loadedEditId, setLoadedEditId] = useState<string | null>(null);
  useEffect(() => {
    if (editId && existingTemplate && loadedEditId !== editId) {
      setTemplate({ ...existingTemplate });
      setLoadedEditId(editId);
      setIsDirty(false);
    }
  }, [editId, existingTemplate, loadedEditId]);

  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const createMutation = useCreateTemplate();
  const updateMutation = useUpdateTemplate();
  const isSaving = createMutation.isPending || updateMutation.isPending;

  // ---------------------------------------------------------------------------
  // Metadata mutations
  // ---------------------------------------------------------------------------

  const mutate = useCallback((updater: (prev: TemplateDefinition) => TemplateDefinition) => {
    setTemplate(updater);
    setIsDirty(true);
  }, []);

  const setName = useCallback((name: string) => {
    mutate((prev) => ({ ...prev, name }));
  }, [mutate]);

  const setDescription = useCallback((description: string) => {
    mutate((prev) => ({ ...prev, description }));
  }, [mutate]);

  const setIconName = useCallback((iconName: string) => {
    mutate((prev) => ({ ...prev, iconName }));
  }, [mutate]);

  const setCategory = useCallback((category: TemplateCategory) => {
    mutate((prev) => ({ ...prev, category }));
  }, [mutate]);

  const setAccentColor = useCallback((color: string) => {
    mutate((prev) => ({ ...prev, accentColor: color }));
  }, [mutate]);

  // ---------------------------------------------------------------------------
  // Slot mutations
  // ---------------------------------------------------------------------------

  const addSlot = useCallback((type: SlotType) => {
    mutate((prev) => {
      if (prev.slots.length >= MAX_SLOTS) return prev; // enforce limit
      const maxOrder = prev.slots.reduce((max, s) => Math.max(max, s.order), -1);
      const newSlot: SlotDefinition = {
        id: generateSlotId(),
        type,
        label: slotTypeLabel(type),
        helpText: '',
        visibility: 'optionalOn',
        order: maxOrder + 1,
      };
      return { ...prev, slots: [...prev.slots, newSlot] };
    });
  }, [mutate]);

  const removeSlot = useCallback((slotId: string) => {
    mutate((prev) => ({
      ...prev,
      // Re-normalize order values to prevent gaps in serialized output
      slots: prev.slots
        .filter((s) => s.id !== slotId)
        .sort((a, b) => a.order - b.order)
        .map((s, i) => ({ ...s, order: i })),
    }));
    setSelectedSlotId((prev) => (prev === slotId ? null : prev));
  }, [mutate]);

  const reorderSlots = useCallback((fromIndex: number, toIndex: number) => {
    mutate((prev) => {
      const sorted = [...prev.slots].sort((a, b) => a.order - b.order);
      const [moved] = sorted.splice(fromIndex, 1);
      sorted.splice(toIndex, 0, moved!);
      const reordered = sorted.map((s, i) => ({ ...s, order: i }));
      return { ...prev, slots: reordered };
    });
  }, [mutate]);

  const updateSlot = useCallback((slotId: string, updates: Partial<SlotDefinition>) => {
    mutate((prev) => ({
      ...prev,
      slots: prev.slots.map((s) =>
        s.id === slotId ? { ...s, ...updates } : s,
      ),
    }));
  }, [mutate]);

  // ---------------------------------------------------------------------------
  // Save
  // ---------------------------------------------------------------------------

  const save = useCallback(async () => {
    setSaveError(null);

    if (!template.name.trim()) {
      setSaveError('Template name is required.');
      return;
    }

    const json = serializeTemplateDefinition({
      ...template,
      isBuiltIn: false,
    });

    try {
      if (editId) {
        await updateMutation.mutateAsync({
          id: editId,
          body: {
            name: template.name,
            description: template.description || null,
            cardSchema: json,
          },
        });
      } else {
        await createMutation.mutateAsync({
          name: template.name,
          description: template.description || null,
          cardSchema: json,
        });
      }
      setIsDirty(false);
      onSaved?.();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save template.');
    }
  }, [template, editId, createMutation, updateMutation, onSaved]);

  return {
    template,
    isEdit: !!editId,
    isLoading,
    selectedSlotId,
    selectSlot: setSelectedSlotId,
    setName,
    setDescription,
    setIconName,
    setCategory,
    setAccentColor,
    addSlot,
    removeSlot,
    reorderSlots,
    updateSlot,
    save,
    isSaving,
    saveError,
    isDirty,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Default display label for a slot type when newly added. Uses SLOT_TYPE_LABELS. */
function slotTypeLabel(type: SlotType): string {
  return SLOT_TYPE_LABELS[type] ?? type;
}

/**
 * Shared single source of truth for slot type display labels.
 * Used by useTemplateEditor, SlotListPanel, and SlotConfigPanel.
 * If you add a new SlotType, add its label here.
 */
export const SLOT_TYPE_LABELS: Record<SlotType, string> = {
  heading: 'Heading',
  subheading: 'Subheading',
  bodyText: 'Body Text',
  heroImage: 'Hero Image',
  keyDetails: 'Key Details',
  linkButton: 'Link Button',
  footer: 'Footer',
  divider: 'Divider',
  imageGallery: 'Image Gallery',
  statsRow: 'Stats Row',
  quoteCallout: 'Quote / Callout',
  columns: 'Columns',
  table: 'Table',
  expandableSection: 'Expandable Section',
  iconTextRow: 'Icon + Text Row',
};

/** Ordered list of slot types for the "Add Slot" menu and type dropdown. Derived from SLOT_TYPE_LABELS. */
export const SLOT_TYPE_OPTIONS: { type: SlotType; label: string }[] =
  (Object.entries(SLOT_TYPE_LABELS) as [SlotType, string][]).map(([type, label]) => ({ type, label }));
