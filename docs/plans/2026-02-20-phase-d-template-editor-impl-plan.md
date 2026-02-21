# Phase D — Template Editor (Tier 3) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

> **Review Notes (2026-02-21):** This plan was reviewed by 3 specialist agents (React, Code Quality, Architecture). All Critical and High findings have been incorporated below. Key fixes:
> - **C1: Preview pipeline** — Task 9 now uses `buildCard()` directly with the template object instead of `buildCardFromDocument()` (which only resolves built-in templates).
> - **C2: Edit loading race** — Task 2 now uses `useEffect` for async sync (not render-time setState), exposes `isLoading`, and Task 3 gates the editor UI on data availability.
> - **H1: Invisible delete buttons** — Task 4 slot hover styles fixed to show actions on `:hover` and for selected items.
> - **H2: Z-index conflicts** — Tasks 3 and 11 use z-index 200 (above ComposePanel's 100) to prevent focus-trap and Escape key conflicts.
> - **H3: DnD stale closure** — Task 4 `sortedSlots` now uses `useMemo`.
> - **H4: Task 14 underspecified** — Now fully specifies replacing the existing `SaveTemplateDialog` with TemplateDefinition format.
> - **H5: Schema versioning** — Task 1 uses `schemaVersion: 2` discriminator instead of `Array.isArray(slots)`.
> - **H6: Unsafe casts** — Task 8 `DefaultValueEditor` now uses type guards.
> - **H7: Max slot limit** — Task 2 caps at 25 slots. Task 2 also re-normalizes order on remove.
> - **M: Dedup constants** — Shared `SLOT_TYPE_LABELS` / `SLOT_TYPE_OPTIONS` in Task 2, imported by Tasks 4 and 7.
> - **M: TemplateListView perf** — Task 10 memoizes parsed templates.
> - **M: mergeClasses** — Task 6 IconPicker uses `mergeClasses()` instead of string concatenation.

**Goal:** Build a dedicated three-panel template authoring screen where any user can create, edit, and manage reusable card templates.

**Architecture:** Full-screen modal overlay (like ComposePanel) with a list/detail pattern — opens to a template list, then switches to a three-panel editor (slot list | slot config | live preview). Reuses the existing card pipeline for preview and the existing `/api/templates` CRUD endpoints. Templates are serialized as `TemplateDefinition` JSON in the existing `cardSchema` field.

**Tech Stack:** React 19, Fluent UI v9, @dnd-kit (reuse from Phase C), react-hook-form (for metadata), TanStack Query (existing API hooks), existing card pipeline (`cardPipeline.ts`, `cardElementTree.ts`, `themeEngine.ts`, `serializer.ts`).

**Base path:** `src/CompanyCommunicator.Api/ClientApp/src/` (all relative paths below are from here, use `@/` import alias)

---

## Key Design Decisions

1. **No new routes** — Template Editor is a full-screen overlay (modal), same pattern as ComposePanel. Works within the Teams tab iframe.
2. **No backend changes** — `TemplateDefinition` is serialized to JSON and stored in the existing `cardSchema` field. Format detection uses `schemaVersion: 2` discriminator (not just the presence of `slots`) to distinguish from legacy `CardSchema` format.
3. **List + Editor modes** — The modal opens to a template list view. Clicking "Create" or "Edit" switches to the three-panel editor.
4. **Reuse existing infrastructure** — DnD from `@dnd-kit`, card pipeline from Phase A, slot editors are NOT reused (template editor edits *definitions*, not *values*).

---

## Task 1: Template serialization helpers

**Files:**
- Modify: `lib/templateDefinitions.ts`

**Step 1: Add serialization/deserialization functions**

Append these to the end of `lib/templateDefinitions.ts`:

```typescript
// ---------------------------------------------------------------------------
// Serialization helpers (Phase D — Template Editor)
// ---------------------------------------------------------------------------

/** Schema version for TemplateDefinition format (distinguishes from legacy CardSchema). */
export const TEMPLATE_SCHEMA_VERSION = 2;

/**
 * Detect whether a JSON string represents a TemplateDefinition (schemaVersion === 2)
 * vs. a legacy CardSchema.
 */
export function isTemplateDefinitionJson(json: string): boolean {
  try {
    const parsed = JSON.parse(json);
    return parsed?.schemaVersion === TEMPLATE_SCHEMA_VERSION;
  } catch {
    return false;
  }
}

/**
 * Parse a JSON string into a TemplateDefinition. Returns null if invalid.
 * Performs structural validation on slots to guard against malformed API data.
 */
export function parseTemplateDefinition(json: string): TemplateDefinition | null {
  try {
    const parsed = JSON.parse(json);
    if (
      parsed?.schemaVersion !== TEMPLATE_SCHEMA_VERSION ||
      !Array.isArray(parsed?.slots) ||
      typeof parsed?.name !== 'string'
    ) {
      return null;
    }
    // Validate each slot has required fields
    for (const slot of parsed.slots) {
      if (
        typeof slot?.id !== 'string' ||
        typeof slot?.type !== 'string' ||
        typeof slot?.label !== 'string' ||
        typeof slot?.visibility !== 'string' ||
        typeof slot?.order !== 'number'
      ) {
        return null;
      }
    }
    return parsed as TemplateDefinition;
  } catch {
    return null;
  }
}

/**
 * Serialize a TemplateDefinition to a JSON string for storage.
 * Always stamps schemaVersion so the format can be detected on read.
 */
export function serializeTemplateDefinition(def: TemplateDefinition): string {
  return JSON.stringify({ ...def, schemaVersion: TEMPLATE_SCHEMA_VERSION });
}

/**
 * Create a blank TemplateDefinition as starting point for the editor.
 */
export function createBlankTemplateDef(): TemplateDefinition {
  return {
    id: '',               // Set by backend on save
    name: '',
    description: '',
    iconName: 'DocumentOnePage',
    category: 'general',
    accentColor: '#5B5FC7',
    isBuiltIn: false,
    slots: [
      {
        id: 'heading',
        type: 'heading',
        label: 'Heading',
        helpText: 'Enter a title',
        visibility: 'required',
        order: 0,
      },
      {
        id: 'body',
        type: 'bodyText',
        label: 'Body Text',
        helpText: 'Enter the message content',
        visibility: 'optionalOn',
        order: 1,
      },
    ],
  };
}
```

**Step 2: Verify it compiles**

Run: `cd src/CompanyCommunicator.Api/ClientApp && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/CompanyCommunicator.Api/ClientApp/src/lib/templateDefinitions.ts
git commit -m "feat(templates): add serialization helpers for TemplateDefinition"
```

---

## Task 2: useTemplateEditor hook

**Files:**
- Create: `components/TemplateEditor/useTemplateEditor.ts`

This is the core state management hook for the template editor.

**Step 1: Create the hook**

```typescript
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
```

**Step 2: Verify it compiles**

Run: `cd src/CompanyCommunicator.Api/ClientApp && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/CompanyCommunicator.Api/ClientApp/src/components/TemplateEditor/useTemplateEditor.ts
git commit -m "feat(templates): add useTemplateEditor state management hook"
```

---

## Task 3: TemplateEditor layout shell

**Files:**
- Create: `components/TemplateEditor/TemplateEditor.tsx`

The main full-screen overlay with header and three-panel layout. Initially renders placeholder divs for each panel.

**Step 1: Create the component**

```typescript
// components/TemplateEditor/TemplateEditor.tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  makeStyles,
  tokens,
  Text,
  Button,
  Spinner,
  Dialog,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  DialogActions,
  MessageBar,
  MessageBarBody,
} from '@fluentui/react-components';
import { Dismiss24Regular, Save24Regular } from '@fluentui/react-icons';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useTemplateEditor } from './useTemplateEditor';
import { SlotListPanel } from './SlotListPanel';
import { SlotConfigPanel } from './SlotConfigPanel';
import { TemplatePreviewPanel } from './TemplatePreviewPanel';
import { TemplateMetadataForm } from './TemplateMetadataForm';

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const useStyles = makeStyles({
  overlay: {
    position: 'fixed',
    inset: 0,
    // z-index 200 so this stacks above ComposePanel (100) when opened from TemplatePicker
    zIndex: 200,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorBackgroundOverlay,
    backdropFilter: 'blur(4px)',
    animationName: {
      from: { opacity: 0 },
      to: { opacity: 1 },
    },
    animationDuration: '200ms',
    animationTimingFunction: 'ease-out',
    animationFillMode: 'both',
  },

  panel: {
    position: 'relative',
    width: 'calc(100% - 48px)',
    maxWidth: '960px',
    height: 'calc(100vh - 80px)',
    maxHeight: '85vh',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusXLarge,
    boxShadow: tokens.shadow64,
    overflow: 'hidden',
    animationName: {
      from: { opacity: 0, transform: 'scale(0.97)' },
      to: { opacity: 1, transform: 'scale(1)' },
    },
    animationDuration: '220ms',
    animationTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
    animationFillMode: 'both',
  },

  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalL}`,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    flexShrink: 0,
    gap: tokens.spacingHorizontalM,
    minHeight: '56px',
  },

  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    flex: 1,
    overflow: 'hidden',
  },

  headerTitle: {
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase400,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: tokens.colorNeutralForeground1,
  },

  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    flexShrink: 0,
  },

  body: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
    minHeight: 0,
  },

  leftPanel: {
    flex: '0 0 220px',
    borderRight: `1px solid ${tokens.colorNeutralStroke2}`,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },

  centerPanel: {
    flex: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },

  rightPanel: {
    flex: '0 0 320px',
    borderLeft: `1px solid ${tokens.colorNeutralStroke2}`,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
});

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface TemplateEditorProps {
  /** Template ID to edit (null = create new). */
  editId?: string | null;
  /** Called when the editor should close. */
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TemplateEditor({ editId, onClose }: TemplateEditorProps) {
  const styles = useStyles();
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, true);

  const [showDiscardDialog, setShowDiscardDialog] = useState(false);

  const editor = useTemplateEditor({
    editId,
    onSaved: onClose,
  });

  // Gate on loading — prevent user from interacting with blank form while data loads
  if (editor.isLoading) {
    return (
      <div className={styles.overlay}>
        <div className={styles.panel} role="dialog" aria-modal="true" aria-label="Loading template...">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
            <Spinner label="Loading template..." />
          </div>
        </div>
      </div>
    );
  }

  // Close with dirty-check
  const requestClose = useCallback(() => {
    if (editor.isDirty) {
      setShowDiscardDialog(true);
    } else {
      onClose();
    }
  }, [editor.isDirty, onClose]);

  // Escape key handler
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showDiscardDialog) return;
        requestClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('keydown', onKeyDown); };
  }, [requestClose, showDiscardDialog]);

  // Focus panel on mount
  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  const panelTitle = editor.isEdit
    ? `Edit Template: ${editor.template.name || 'Untitled'}`
    : 'Create Template';

  return (
    <>
      <div
        className={styles.overlay}
        onClick={(e) => { if (e.target === e.currentTarget) requestClose(); }}
      >
        <div
          ref={panelRef}
          className={styles.panel}
          role="dialog"
          aria-modal="true"
          aria-label={panelTitle}
          tabIndex={-1}
        >
          {/* Header */}
          <div className={styles.header}>
            <div className={styles.headerLeft}>
              <Text className={styles.headerTitle}>{panelTitle}</Text>
            </div>
            <div className={styles.headerActions}>
              {editor.isSaving && <Spinner size="tiny" label="Saving..." labelPosition="before" />}
              <Button
                appearance="primary"
                icon={<Save24Regular />}
                onClick={() => { void editor.save(); }}
                disabled={editor.isSaving || !editor.template.name.trim()}
              >
                Save
              </Button>
              <Button
                appearance="subtle"
                icon={<Dismiss24Regular />}
                onClick={requestClose}
                aria-label="Close template editor"
              />
            </div>
          </div>

          {editor.saveError && (
            <MessageBar intent="error" style={{ flexShrink: 0 }}>
              <MessageBarBody>{editor.saveError}</MessageBarBody>
            </MessageBar>
          )}

          {/* Three-panel body */}
          <div className={styles.body}>
            {/* Left: Slot list */}
            <div className={styles.leftPanel}>
              <SlotListPanel
                slots={editor.template.slots}
                selectedSlotId={editor.selectedSlotId}
                onSelectSlot={editor.selectSlot}
                onAddSlot={editor.addSlot}
                onRemoveSlot={editor.removeSlot}
                onReorderSlots={editor.reorderSlots}
              />
            </div>

            {/* Center: Slot config + template metadata */}
            <div className={styles.centerPanel}>
              <TemplateMetadataForm
                name={editor.template.name}
                description={editor.template.description}
                iconName={editor.template.iconName}
                category={editor.template.category}
                accentColor={editor.template.accentColor}
                onNameChange={editor.setName}
                onDescriptionChange={editor.setDescription}
                onIconNameChange={editor.setIconName}
                onCategoryChange={editor.setCategory}
                onAccentColorChange={editor.setAccentColor}
              />
              <SlotConfigPanel
                slot={editor.template.slots.find((s) => s.id === editor.selectedSlotId) ?? null}
                onUpdate={(updates) => {
                  if (editor.selectedSlotId) {
                    editor.updateSlot(editor.selectedSlotId, updates);
                  }
                }}
              />
            </div>

            {/* Right: Preview */}
            <div className={styles.rightPanel}>
              <TemplatePreviewPanel template={editor.template} />
            </div>
          </div>
        </div>
      </div>

      {/* Discard dialog */}
      <Dialog
        open={showDiscardDialog}
        onOpenChange={(_e, data) => { setShowDiscardDialog(data.open); }}
      >
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Unsaved changes</DialogTitle>
            <DialogContent>
              You have unsaved changes. Discard them and close?
            </DialogContent>
            <DialogActions>
              <Button appearance="primary" onClick={() => { setShowDiscardDialog(false); }}>
                Keep editing
              </Button>
              <Button
                appearance="secondary"
                onClick={() => {
                  setShowDiscardDialog(false);
                  onClose();
                }}
              >
                Discard
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </>
  );
}
```

**Step 2: Verify it compiles** (will fail — child components don't exist yet). This is expected; we create stubs next.

**Step 3: Commit** (defer until child components exist)

---

## Task 4: SlotListPanel (left panel)

**Files:**
- Create: `components/TemplateEditor/SlotListPanel.tsx`

Ordered slot list with DnD reorder, type indicators, and add/remove controls.

**Step 1: Create the component**

```typescript
// components/TemplateEditor/SlotListPanel.tsx
import { useCallback, useMemo, useState } from 'react';
import {
  makeStyles,
  tokens,
  Text,
  Button,
  Badge,
  mergeClasses,
  MenuList,
  MenuItem,
  MenuPopover,
  MenuTrigger,
  Menu,
} from '@fluentui/react-components';
import {
  Add16Regular,
  Delete16Regular,
  ReOrder16Regular,
} from '@fluentui/react-icons';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import type { SlotDefinition, SlotType } from '@/types';
import { SLOT_TYPE_OPTIONS } from './useTemplateEditor';

// ---------------------------------------------------------------------------
// Visibility badge colors
// ---------------------------------------------------------------------------

const VISIBILITY_COLORS: Record<string, 'important' | 'informative' | 'subtle'> = {
  required: 'important',
  optionalOn: 'informative',
  optionalOff: 'subtle',
};

const VISIBILITY_LABELS: Record<string, string> = {
  required: 'Req',
  optionalOn: 'On',
  optionalOff: 'Off',
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },

  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    flexShrink: 0,
  },

  headerLabel: {
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase200,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: tokens.colorNeutralForeground3,
  },

  list: {
    flex: 1,
    overflowY: 'auto',
    padding: `${tokens.spacingVerticalXS} 0`,
  },

  slotItem: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    padding: `6px ${tokens.spacingHorizontalM}`,
    cursor: 'pointer',
    border: 'none',
    background: 'transparent',
    width: '100%',
    textAlign: 'left',
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground1,
    ':hover': {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
    // Show delete button on hover via child selector
    ':hover [data-slot-actions]': {
      opacity: 1,
    },
  },

  slotItemSelected: {
    backgroundColor: tokens.colorNeutralBackground1Selected,
    color: tokens.colorBrandForeground1,
    ':hover': {
      backgroundColor: tokens.colorNeutralBackground1Selected,
    },
    // Always show actions for selected slot
    '& [data-slot-actions]': {
      opacity: 1,
    },
  },

  dragHandle: {
    cursor: 'grab',
    color: tokens.colorNeutralForeground3,
    flexShrink: 0,
    ':active': {
      cursor: 'grabbing',
    },
  },

  slotLabel: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },

  slotActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '2px',
    flexShrink: 0,
    opacity: 0,
  },

  dragOverlay: {
    padding: '6px 12px',
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow8,
    borderRadius: tokens.borderRadiusMedium,
    fontSize: tokens.fontSizeBase200,
  },
});

// ---------------------------------------------------------------------------
// SortableSlotItem
// ---------------------------------------------------------------------------

interface SortableSlotItemProps {
  slot: SlotDefinition;
  isSelected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}

function SortableSlotItem({ slot, isSelected, onSelect, onRemove }: SortableSlotItemProps) {
  const styles = useStyles();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: slot.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={mergeClasses(
        styles.slotItem,
        isSelected && styles.slotItemSelected,
      )}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      aria-label={`${slot.label} (${slot.visibility})`}
      aria-selected={isSelected}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(); } }}
    >
      <span
        className={styles.dragHandle}
        {...attributes}
        {...listeners}
        onClick={(e) => { e.stopPropagation(); }}
        aria-label="Drag to reorder"
      >
        <ReOrder16Regular />
      </span>

      <span className={styles.slotLabel}>{slot.label}</span>

      <Badge
        appearance="outline"
        size="small"
        color={VISIBILITY_COLORS[slot.visibility] ?? 'subtle'}
      >
        {VISIBILITY_LABELS[slot.visibility] ?? slot.visibility}
      </Badge>

      <span data-slot-actions className={styles.slotActions}>
        <Button
          appearance="subtle"
          size="small"
          icon={<Delete16Regular />}
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          aria-label={`Remove ${slot.label}`}
        />
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SlotListPanelProps {
  slots: SlotDefinition[];
  selectedSlotId: string | null;
  onSelectSlot: (slotId: string | null) => void;
  onAddSlot: (type: SlotType) => void;
  onRemoveSlot: (slotId: string) => void;
  onReorderSlots: (fromIndex: number, toIndex: number) => void;
}

// ---------------------------------------------------------------------------
// SlotListPanel
// ---------------------------------------------------------------------------

export function SlotListPanel({
  slots,
  selectedSlotId,
  onSelectSlot,
  onAddSlot,
  onRemoveSlot,
  onReorderSlots,
}: SlotListPanelProps) {
  const styles = useStyles();
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  // Memoize to stabilize the reference and avoid recreating useCallback handlers every render
  const sortedSlots = useMemo(
    () => [...slots].sort((a, b) => a.order - b.order),
    [slots],
  );
  const sortableIds = useMemo(() => sortedSlots.map((s) => s.id), [sortedSlots]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragId(String(event.active.id));
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sortedSlots.findIndex((s) => s.id === active.id);
    const newIndex = sortedSlots.findIndex((s) => s.id === over.id);
    if (oldIndex !== -1 && newIndex !== -1) {
      onReorderSlots(oldIndex, newIndex);
    }
  }, [sortedSlots, onReorderSlots]);

  const handleDragCancel = useCallback(() => {
    setActiveDragId(null);
  }, []);

  const draggedSlot = activeDragId ? sortedSlots.find((s) => s.id === activeDragId) : null;

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <Text className={styles.headerLabel}>Sections</Text>
        <Menu>
          <MenuTrigger>
            <Button
              appearance="subtle"
              size="small"
              icon={<Add16Regular />}
              aria-label="Add section"
            />
          </MenuTrigger>
          <MenuPopover>
            <MenuList>
              {SLOT_TYPE_OPTIONS.map(({ type, label }) => (
                <MenuItem key={type} onClick={() => { onAddSlot(type); }}>
                  {label}
                </MenuItem>
              ))}
            </MenuList>
          </MenuPopover>
        </Menu>
      </div>

      <div className={styles.list}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
            {sortedSlots.map((slot) => (
              <SortableSlotItem
                key={slot.id}
                slot={slot}
                isSelected={selectedSlotId === slot.id}
                onSelect={() => { onSelectSlot(slot.id); }}
                onRemove={() => { onRemoveSlot(slot.id); }}
              />
            ))}
          </SortableContext>
          <DragOverlay>
            {draggedSlot ? (
              <div className={styles.dragOverlay}>{draggedSlot.label}</div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}
```

**Step 2: Verify it compiles**

Run: `cd src/CompanyCommunicator.Api/ClientApp && npx tsc --noEmit`

**Step 3: Commit**

```bash
git add src/CompanyCommunicator.Api/ClientApp/src/components/TemplateEditor/SlotListPanel.tsx
git commit -m "feat(templates): add SlotListPanel with DnD reorder"
```

---

## Task 5: TemplateMetadataForm

**Files:**
- Create: `components/TemplateEditor/TemplateMetadataForm.tsx`

Top section of the center panel — template name, description, icon, category, accent color.

**Step 1: Create the component**

```typescript
// components/TemplateEditor/TemplateMetadataForm.tsx
import {
  makeStyles,
  tokens,
  Input,
  Textarea,
  Label,
  Dropdown,
  Option,
  Text,
} from '@fluentui/react-components';
import type { TemplateCategory } from '@/types';
import { IconPicker } from './IconPicker';

// ---------------------------------------------------------------------------
// Category options
// ---------------------------------------------------------------------------

const CATEGORY_OPTIONS: { value: TemplateCategory; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'announcement', label: 'Announcement' },
  { value: 'event', label: 'Event' },
  { value: 'alert', label: 'Alert' },
  { value: 'feedback', label: 'Feedback' },
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'policy', label: 'Policy' },
  { value: 'celebration', label: 'Celebration' },
];

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
    padding: tokens.spacingHorizontalL,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    flexShrink: 0,
    overflowY: 'auto',
    maxHeight: '280px',
  },

  sectionLabel: {
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase200,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: tokens.colorNeutralForeground3,
  },

  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXXS,
  },

  row: {
    display: 'flex',
    gap: tokens.spacingHorizontalM,
    alignItems: 'flex-start',
  },

  colorInput: {
    width: '40px',
    height: '32px',
    padding: '2px',
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    borderRadius: tokens.borderRadiusMedium,
    cursor: 'pointer',
    backgroundColor: 'transparent',
  },

  colorRow: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
  },
});

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface TemplateMetadataFormProps {
  name: string;
  description: string;
  iconName: string;
  category: TemplateCategory;
  accentColor: string;
  onNameChange: (name: string) => void;
  onDescriptionChange: (description: string) => void;
  onIconNameChange: (iconName: string) => void;
  onCategoryChange: (category: TemplateCategory) => void;
  onAccentColorChange: (color: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TemplateMetadataForm({
  name,
  description,
  iconName,
  category,
  accentColor,
  onNameChange,
  onDescriptionChange,
  onIconNameChange,
  onCategoryChange,
  onAccentColorChange,
}: TemplateMetadataFormProps) {
  const styles = useStyles();

  return (
    <div className={styles.root}>
      <Text className={styles.sectionLabel}>Template Details</Text>

      <div className={styles.field}>
        <Label htmlFor="template-name" required>Name</Label>
        <Input
          id="template-name"
          value={name}
          onChange={(_e, data) => { onNameChange(data.value); }}
          placeholder="e.g., Weekly Update"
          maxLength={200}
        />
      </div>

      <div className={styles.field}>
        <Label htmlFor="template-description">Description</Label>
        <Textarea
          id="template-description"
          value={description}
          onChange={(_e, data) => { onDescriptionChange(data.value); }}
          placeholder="What is this template for?"
          maxLength={500}
          rows={2}
          resize="vertical"
        />
      </div>

      <div className={styles.row}>
        <div className={styles.field} style={{ flex: 1 }}>
          <Label>Category</Label>
          <Dropdown
            value={CATEGORY_OPTIONS.find((c) => c.value === category)?.label ?? 'General'}
            selectedOptions={[category]}
            onOptionSelect={(_e, data) => {
              if (data.optionValue) onCategoryChange(data.optionValue as TemplateCategory);
            }}
          >
            {CATEGORY_OPTIONS.map((opt) => (
              <Option key={opt.value} value={opt.value}>{opt.label}</Option>
            ))}
          </Dropdown>
        </div>

        <div className={styles.field}>
          <Label>Icon</Label>
          <IconPicker
            selectedIcon={iconName}
            onSelect={onIconNameChange}
          />
        </div>

        <div className={styles.field}>
          <Label>Accent Color</Label>
          <div className={styles.colorRow}>
            <input
              type="color"
              value={accentColor}
              onChange={(e) => { onAccentColorChange(e.target.value); }}
              className={styles.colorInput}
              aria-label="Template accent color"
            />
            <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
              {accentColor}
            </Text>
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Verify it compiles** (will need IconPicker first)

**Step 3: Commit** (after IconPicker)

---

## Task 6: IconPicker component

**Files:**
- Create: `components/TemplateEditor/IconPicker.tsx`

Small popover with a grid of Fluent icons for selection.

**Step 1: Create the component**

```typescript
// components/TemplateEditor/IconPicker.tsx
import { useState, useMemo } from 'react';
import type { ComponentType } from 'react';
import {
  makeStyles,
  mergeClasses,
  tokens,
  Button,
  Input,
  Popover,
  PopoverSurface,
  PopoverTrigger,
} from '@fluentui/react-components';
import type { FluentIconsProps } from '@fluentui/react-icons';
import {
  DocumentOnePage20Regular,
  MegaphoneRegular,
  CalendarRegular,
  AlertUrgentRegular,
  LinkRegular,
  ClipboardTaskRegular,
  PeopleRegular,
  ShieldCheckmarkRegular,
  StarRegular,
  HeartRegular,
  RocketRegular,
  LightbulbRegular,
  BookRegular,
  BriefcaseRegular,
  GlobeRegular,
  ChatRegular,
  MailRegular,
  FlagRegular,
  CheckmarkCircleRegular,
  InfoRegular,
  TargetRegular,
  SparkleRegular,
  HandshakeRegular,
  BuildingRegular,
} from '@fluentui/react-icons';

// ---------------------------------------------------------------------------
// Icon registry
// ---------------------------------------------------------------------------

export const TEMPLATE_ICON_MAP: Record<string, ComponentType<FluentIconsProps>> = {
  DocumentOnePage: DocumentOnePage20Regular,
  Megaphone: MegaphoneRegular,
  Calendar: CalendarRegular,
  AlertUrgent: AlertUrgentRegular,
  Link: LinkRegular,
  ClipboardTask: ClipboardTaskRegular,
  People: PeopleRegular,
  ShieldCheckmark: ShieldCheckmarkRegular,
  Star: StarRegular,
  Heart: HeartRegular,
  Rocket: RocketRegular,
  Lightbulb: LightbulbRegular,
  Book: BookRegular,
  Briefcase: BriefcaseRegular,
  Globe: GlobeRegular,
  Chat: ChatRegular,
  Mail: MailRegular,
  Flag: FlagRegular,
  CheckmarkCircle: CheckmarkCircleRegular,
  Info: InfoRegular,
  Target: TargetRegular,
  Sparkle: SparkleRegular,
  Handshake: HandshakeRegular,
  Building: BuildingRegular,
};

export function resolveTemplateIcon(iconName: string): ComponentType<FluentIconsProps> {
  return TEMPLATE_ICON_MAP[iconName] ?? DocumentOnePage20Regular;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const useStyles = makeStyles({
  trigger: {
    minWidth: '40px',
    height: '32px',
    padding: '4px 8px',
  },

  popover: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
    padding: tokens.spacingHorizontalM,
    width: '260px',
  },

  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(6, 1fr)',
    gap: '4px',
    maxHeight: '200px',
    overflowY: 'auto',
  },

  iconCell: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '36px',
    height: '36px',
    borderRadius: tokens.borderRadiusMedium,
    cursor: 'pointer',
    border: 'none',
    backgroundColor: 'transparent',
    color: tokens.colorNeutralForeground1,
    fontSize: '20px',
    ':hover': {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },

  iconCellSelected: {
    backgroundColor: tokens.colorBrandBackground,
    color: tokens.colorNeutralForegroundOnBrand,
    ':hover': {
      backgroundColor: tokens.colorBrandBackgroundHover,
    },
  },
});

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface IconPickerProps {
  selectedIcon: string;
  onSelect: (iconName: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function IconPicker({ selectedIcon, onSelect }: IconPickerProps) {
  const styles = useStyles();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const iconEntries = useMemo(() => Object.entries(TEMPLATE_ICON_MAP), []);

  const filtered = useMemo(() => {
    if (!search.trim()) return iconEntries;
    const q = search.toLowerCase();
    return iconEntries.filter(([name]) => name.toLowerCase().includes(q));
  }, [iconEntries, search]);

  const SelectedIcon = resolveTemplateIcon(selectedIcon);

  return (
    <Popover open={open} onOpenChange={(_e, data) => { setOpen(data.open); }}>
      <PopoverTrigger>
        <Button
          appearance="outline"
          className={styles.trigger}
          icon={<SelectedIcon />}
          aria-label={`Selected icon: ${selectedIcon}`}
        />
      </PopoverTrigger>
      <PopoverSurface>
        <div className={styles.popover}>
          <Input
            placeholder="Search icons..."
            value={search}
            onChange={(_e, data) => { setSearch(data.value); }}
            size="small"
          />
          <div className={styles.grid}>
            {filtered.map(([name, Icon]) => (
              <button
                key={name}
                type="button"
                className={mergeClasses(styles.iconCell, name === selectedIcon && styles.iconCellSelected)}
                onClick={() => {
                  onSelect(name);
                  setOpen(false);
                }}
                aria-label={name}
                title={name}
              >
                <Icon />
              </button>
            ))}
          </div>
        </div>
      </PopoverSurface>
    </Popover>
  );
}
```

**Step 2: Verify it compiles**

Run: `cd src/CompanyCommunicator.Api/ClientApp && npx tsc --noEmit`

**Step 3: Commit**

```bash
git add src/CompanyCommunicator.Api/ClientApp/src/components/TemplateEditor/IconPicker.tsx \
        src/CompanyCommunicator.Api/ClientApp/src/components/TemplateEditor/TemplateMetadataForm.tsx
git commit -m "feat(templates): add IconPicker and TemplateMetadataForm"
```

---

## Task 7: SlotConfigPanel (center panel)

**Files:**
- Create: `components/TemplateEditor/SlotConfigPanel.tsx`

Editing panel for the selected slot: type selector, label, help text, visibility, default value, locked properties.

**Step 1: Create the component**

```typescript
// components/TemplateEditor/SlotConfigPanel.tsx
import {
  makeStyles,
  tokens,
  Text,
  Input,
  Textarea,
  Label,
  Dropdown,
  Option,
  RadioGroup,
  Radio,
} from '@fluentui/react-components';
import type { SlotDefinition, SlotType, SlotVisibility } from '@/types';
import { DefaultValueEditor } from './DefaultValueEditor';
import { SLOT_TYPE_OPTIONS } from './useTemplateEditor';

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const useStyles = makeStyles({
  root: {
    flex: 1,
    overflowY: 'auto',
    padding: tokens.spacingHorizontalL,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },

  emptyState: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: tokens.colorNeutralForeground3,
    padding: tokens.spacingHorizontalL,
  },

  sectionLabel: {
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase200,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: tokens.colorNeutralForeground3,
    marginTop: tokens.spacingVerticalS,
  },

  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXXS,
  },

  row: {
    display: 'flex',
    gap: tokens.spacingHorizontalM,
    alignItems: 'flex-start',
  },
});

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SlotConfigPanelProps {
  slot: SlotDefinition | null;
  onUpdate: (updates: Partial<SlotDefinition>) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SlotConfigPanel({ slot, onUpdate }: SlotConfigPanelProps) {
  const styles = useStyles();

  if (!slot) {
    return (
      <div className={styles.emptyState}>
        <Text size={300}>Select a section from the list to configure it</Text>
      </div>
    );
  }

  return (
    <div className={styles.root} key={slot.id}>
      <Text className={styles.sectionLabel}>Section Configuration</Text>

      {/* Type selector */}
      <div className={styles.field}>
        <Label>Section Type</Label>
        <Dropdown
          value={SLOT_TYPE_OPTIONS.find((o) => o.type === slot.type)?.label ?? slot.type}
          selectedOptions={[slot.type]}
          onOptionSelect={(_e, data) => {
            if (data.optionValue) {
              onUpdate({
                type: data.optionValue as SlotType,
                defaultValue: undefined, // Reset default when type changes
              });
            }
          }}
        >
          {SLOT_TYPE_OPTIONS.map((opt) => (
            <Option key={opt.type} value={opt.type}>{opt.label}</Option>
          ))}
        </Dropdown>
      </div>

      {/* Label */}
      <div className={styles.field}>
        <Label htmlFor={`slot-label-${slot.id}`} required>Label</Label>
        <Input
          id={`slot-label-${slot.id}`}
          value={slot.label}
          onChange={(_e, data) => { onUpdate({ label: data.value }); }}
          placeholder="User-facing section name"
          maxLength={100}
        />
      </div>

      {/* Help text */}
      <div className={styles.field}>
        <Label htmlFor={`slot-help-${slot.id}`}>Help Text</Label>
        <Textarea
          id={`slot-help-${slot.id}`}
          value={slot.helpText ?? ''}
          onChange={(_e, data) => { onUpdate({ helpText: data.value || undefined }); }}
          placeholder="Guidance shown to authors"
          maxLength={300}
          rows={2}
          resize="vertical"
        />
      </div>

      {/* Visibility */}
      <div className={styles.field}>
        <Label>Visibility</Label>
        <RadioGroup
          value={slot.visibility}
          onChange={(_e, data) => {
            onUpdate({ visibility: data.value as SlotVisibility });
          }}
        >
          <Radio value="required" label="Required — always shown, cannot be hidden" />
          <Radio value="optionalOn" label="Optional (on by default) — shown but toggleable" />
          <Radio value="optionalOff" label="Optional (off by default) — hidden until toggled on" />
        </RadioGroup>
      </div>

      {/* Default value */}
      <Text className={styles.sectionLabel}>Default Content</Text>
      <DefaultValueEditor
        slotType={slot.type}
        value={slot.defaultValue}
        onChange={(defaultValue) => { onUpdate({ defaultValue }); }}
      />
    </div>
  );
}
```

**Step 2: Verify it compiles** (needs DefaultValueEditor)

---

## Task 8: DefaultValueEditor

**Files:**
- Create: `components/TemplateEditor/DefaultValueEditor.tsx`

Type-specific editor for slot default values. Shows the right input controls based on the slot type.

**Step 1: Create the component**

```typescript
// components/TemplateEditor/DefaultValueEditor.tsx
import {
  makeStyles,
  tokens,
  Input,
  Textarea,
  Label,
  Button,
  Text,
} from '@fluentui/react-components';
import { Add16Regular, Delete16Regular } from '@fluentui/react-icons';
import type { SlotType, HeadingSlotValue, BodyTextSlotValue, HeroImageSlotValue, KeyDetailsSlotValue, LinkButtonSlotValue, FooterSlotValue } from '@/types';

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
  },

  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXXS,
  },

  pairRow: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
    alignItems: 'center',
  },

  noDefault: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
    fontStyle: 'italic',
  },
});

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DefaultValueEditorProps {
  slotType: SlotType;
  value: unknown;
  onChange: (value: unknown) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DefaultValueEditor({ slotType, value, onChange }: DefaultValueEditorProps) {
  const styles = useStyles();

  // Type guards — safe narrowing instead of unsafe `as` casts.
  // When slot type changes, the old value shape may linger for one render.
  const asText = (v: unknown): { text: string } =>
    v != null && typeof v === 'object' && 'text' in v && typeof (v as Record<string, unknown>).text === 'string'
      ? (v as { text: string })
      : { text: '' };

  switch (slotType) {
    case 'heading':
    case 'subheading': {
      const v = asText(value);
      return (
        <div className={styles.root}>
          <div className={styles.field}>
            <Label size="small">Default text</Label>
            <Input
              value={v.text}
              onChange={(_e, data) => { onChange({ ...v, text: data.value }); }}
              placeholder="Pre-filled heading text"
            />
          </div>
        </div>
      );
    }

    case 'bodyText': {
      const v = asText(value);
      return (
        <div className={styles.root}>
          <div className={styles.field}>
            <Label size="small">Default body</Label>
            <Textarea
              value={v.text}
              onChange={(_e, data) => { onChange({ ...v, text: data.value }); }}
              placeholder="Pre-filled body content (supports markdown)"
              rows={3}
              resize="vertical"
            />
          </div>
        </div>
      );
    }

    case 'heroImage': {
      const raw = value as Record<string, unknown> | null | undefined;
      const v = raw && typeof raw.url === 'string' ? (raw as HeroImageSlotValue) : { url: '', altText: '' };
      return (
        <div className={styles.root}>
          <div className={styles.field}>
            <Label size="small">Default image URL</Label>
            <Input
              value={v.url}
              onChange={(_e, data) => { onChange({ ...v, url: data.value }); }}
              placeholder="https://..."
              type="url"
            />
          </div>
          <div className={styles.field}>
            <Label size="small">Alt text</Label>
            <Input
              value={v.altText ?? ''}
              onChange={(_e, data) => { onChange({ ...v, altText: data.value || undefined }); }}
              placeholder="Image description"
            />
          </div>
        </div>
      );
    }

    case 'keyDetails': {
      const raw = value as Record<string, unknown> | null | undefined;
      const v = raw && Array.isArray(raw.pairs) ? (raw as KeyDetailsSlotValue) : { pairs: [] };
      const pairs = v.pairs ?? [];
      return (
        <div className={styles.root}>
          <Label size="small">Default detail pairs</Label>
          {pairs.map((pair, i) => (
            <div key={i} className={styles.pairRow}>
              <Input
                value={pair.label}
                onChange={(_e, data) => {
                  const updated = [...pairs];
                  updated[i] = { ...updated[i]!, label: data.value };
                  onChange({ pairs: updated });
                }}
                placeholder="Label"
                style={{ flex: 1 }}
              />
              <Input
                value={pair.value}
                onChange={(_e, data) => {
                  const updated = [...pairs];
                  updated[i] = { ...updated[i]!, value: data.value };
                  onChange({ pairs: updated });
                }}
                placeholder="Value"
                style={{ flex: 1 }}
              />
              <Button
                appearance="subtle"
                size="small"
                icon={<Delete16Regular />}
                onClick={() => {
                  onChange({ pairs: pairs.filter((_, j) => j !== i) });
                }}
                aria-label="Remove pair"
              />
            </div>
          ))}
          <Button
            appearance="subtle"
            size="small"
            icon={<Add16Regular />}
            onClick={() => {
              onChange({ pairs: [...pairs, { label: '', value: '' }] });
            }}
          >
            Add pair
          </Button>
        </div>
      );
    }

    case 'linkButton': {
      const raw = value as Record<string, unknown> | null | undefined;
      const v = raw && typeof raw.title === 'string' ? (raw as LinkButtonSlotValue) : { title: '', url: '' };
      return (
        <div className={styles.root}>
          <div className={styles.field}>
            <Label size="small">Default button text</Label>
            <Input
              value={v.title}
              onChange={(_e, data) => { onChange({ ...v, title: data.value }); }}
              placeholder="e.g., Learn More"
            />
          </div>
          <div className={styles.field}>
            <Label size="small">Default URL</Label>
            <Input
              value={v.url}
              onChange={(_e, data) => { onChange({ ...v, url: data.value }); }}
              placeholder="https://..."
              type="url"
            />
          </div>
        </div>
      );
    }

    case 'footer': {
      const v = asText(value);
      return (
        <div className={styles.root}>
          <div className={styles.field}>
            <Label size="small">Default footer text</Label>
            <Textarea
              value={v.text}
              onChange={(_e, data) => { onChange({ ...v, text: data.value }); }}
              placeholder="Pre-filled footer"
              rows={2}
              resize="vertical"
            />
          </div>
        </div>
      );
    }

    case 'divider':
      return (
        <Text className={styles.noDefault}>
          Dividers have no configurable default content.
        </Text>
      );

    default:
      return (
        <Text className={styles.noDefault}>
          Default value editing for this section type will use the section's data shape when authored. Leave empty for no pre-filled content.
        </Text>
      );
  }
}
```

**Step 2: Verify it compiles**

Run: `cd src/CompanyCommunicator.Api/ClientApp && npx tsc --noEmit`

**Step 3: Commit**

```bash
git add src/CompanyCommunicator.Api/ClientApp/src/components/TemplateEditor/SlotConfigPanel.tsx \
        src/CompanyCommunicator.Api/ClientApp/src/components/TemplateEditor/DefaultValueEditor.tsx
git commit -m "feat(templates): add SlotConfigPanel and DefaultValueEditor"
```

---

## Task 9: TemplatePreviewPanel (right panel)

**Files:**
- Create: `components/TemplateEditor/TemplatePreviewPanel.tsx`

Live preview of the template using the existing card pipeline. Generates a CardDocument from the template definition with sample data, then renders via CardPreviewPanel.

**Step 1: Create the component**

```typescript
// components/TemplateEditor/TemplatePreviewPanel.tsx
import { useMemo } from 'react';
import {
  makeStyles,
  tokens,
  Text,
} from '@fluentui/react-components';
import type { TemplateDefinition, CardDocument } from '@/types';
import { getThemeById, DEFAULT_THEME_ID } from '@/lib/builtinThemes';
import { buildCard } from '@/lib/cardPipeline';
import { CardPreviewPanel } from '@/components/ComposePanel/CardPreviewPanel';

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
  },

  header: {
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    flexShrink: 0,
  },

  headerLabel: {
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase200,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: tokens.colorNeutralForeground3,
  },

  preview: {
    flex: 1,
    overflow: 'auto',
    padding: tokens.spacingHorizontalS,
  },
});

// ---------------------------------------------------------------------------
// Build preview document from template definition
// ---------------------------------------------------------------------------

function templateToPreviewDocument(template: TemplateDefinition): CardDocument {
  const slotValues: Record<string, unknown> = {};
  const slotVisibility: Record<string, boolean> = {};

  for (const slot of template.slots) {
    slotVisibility[slot.id] = slot.visibility !== 'optionalOff';
    if (slot.defaultValue !== undefined) {
      slotValues[slot.id] = slot.defaultValue;
    } else {
      // Generate sample data when no default is set
      slotValues[slot.id] = generateSampleValue(slot.type);
    }
  }

  return {
    templateId: null, // Not used — we pass the template object directly to buildCard
    themeId: DEFAULT_THEME_ID,
    slotValues,
    slotVisibility,
    cardPreference: 'template',
  };
}

/** Generate sample data for preview when no default value is set. */
function generateSampleValue(type: string): unknown {
  switch (type) {
    case 'heading':
      return { text: 'Sample Heading' };
    case 'subheading':
      return { text: 'Sample Subheading' };
    case 'bodyText':
      return { text: 'This is sample body text to preview the template layout. It shows how the content will appear to recipients.' };
    case 'heroImage':
      return { url: 'https://picsum.photos/seed/template-preview/800/300', altText: 'Preview image' };
    case 'keyDetails':
      return { pairs: [{ label: 'Detail', value: 'Value' }, { label: 'Another', value: 'Info' }] };
    case 'linkButton':
      return { title: 'Click Here', url: 'https://example.com' };
    case 'footer':
      return { text: 'Footer text appears here' };
    default:
      return undefined;
  }
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface TemplatePreviewPanelProps {
  template: TemplateDefinition;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TemplatePreviewPanel({ template }: TemplatePreviewPanelProps) {
  const styles = useStyles();

  const cardTheme = useMemo(() => getThemeById(DEFAULT_THEME_ID), []);

  // CRITICAL FIX: Use buildCard() directly with the template object instead of
  // buildCardFromDocument(), which only resolves built-in templates via getTemplateById().
  // Custom templates being authored here are NOT in the built-in registry.
  const previewResult = useMemo(() => {
    if (template.slots.length === 0) return null;

    const document = templateToPreviewDocument(template);
    try {
      return buildCard({
        document,
        template,     // Pass the in-progress template directly — bypasses registry lookup
        theme: cardTheme ?? undefined,
        customVariables: {},
      });
    } catch {
      return null;
    }
  }, [template, cardTheme]);

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <Text className={styles.headerLabel}>Preview</Text>
      </div>
      <div className={styles.preview}>
        <CardPreviewPanel
          cardPayload={previewResult?.cardPayload ?? null}
          cardTheme={cardTheme}
        />
      </div>
    </div>
  );
}
```

**Step 2: Verify it compiles**

Run: `cd src/CompanyCommunicator.Api/ClientApp && npx tsc --noEmit`

**Step 3: Commit all Task 3 through 9 together (first compilable checkpoint)**

```bash
git add src/CompanyCommunicator.Api/ClientApp/src/components/TemplateEditor/
git commit -m "feat(templates): add TemplateEditor three-panel layout with all sub-panels"
```

---

## Task 10: TemplateListView

**Files:**
- Create: `components/TemplateEditor/TemplateListView.tsx`

The initial view when "Manage Templates" opens. Shows a grid of the user's custom templates plus a "Create New" card.

**Step 1: Create the component**

```typescript
// components/TemplateEditor/TemplateListView.tsx
import {
  makeStyles,
  tokens,
  Text,
  Button,
  Spinner,
  Badge,
  Dialog,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@fluentui/react-components';
import {
  Add24Regular,
  Edit16Regular,
  Delete16Regular,
  DocumentOnePage20Regular,
} from '@fluentui/react-icons';
import { useMemo, useState } from 'react';
import { useTemplates, useDeleteTemplate } from '@/api/templates';
import { isTemplateDefinitionJson, parseTemplateDefinition } from '@/lib/templateDefinitions';
import { resolveTemplateIcon } from './IconPicker';
import type { TemplateDto } from '@/types';

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'auto',
    padding: '24px',
    gap: '24px',
  },

  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  title: {
    fontSize: tokens.fontSizeBase500,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
  },

  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: '16px',
  },

  card: {
    display: 'flex',
    flexDirection: 'column',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusLarge,
    backgroundColor: tokens.colorNeutralBackground1,
    overflow: 'hidden',
    transitionProperty: 'border-color, box-shadow',
    transitionDuration: '0.15s',
    transitionTimingFunction: 'ease',
    ':hover': {
      borderTopColor: tokens.colorBrandStroke1,
      borderRightColor: tokens.colorBrandStroke1,
      borderBottomColor: tokens.colorBrandStroke1,
      borderLeftColor: tokens.colorBrandStroke1,
      boxShadow: tokens.shadow4,
    },
  },

  cardAccent: {
    height: '4px',
    flexShrink: 0,
  },

  cardBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '16px',
    flex: 1,
  },

  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },

  cardIcon: {
    fontSize: '24px',
    flexShrink: 0,
  },

  cardName: {
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
  },

  cardDescription: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
    display: '-webkit-box',
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: 2,
    overflow: 'hidden',
  },

  cardFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '4px',
    padding: `0 16px 12px`,
  },

  createCard: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '140px',
    border: `2px dashed ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusLarge,
    cursor: 'pointer',
    backgroundColor: 'transparent',
    color: tokens.colorBrandForeground1,
    gap: '8px',
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightSemibold,
    transitionProperty: 'border-color, background-color',
    transitionDuration: '0.15s',
    ':hover': {
      borderTopColor: tokens.colorBrandStroke1,
      borderRightColor: tokens.colorBrandStroke1,
      borderBottomColor: tokens.colorBrandStroke1,
      borderLeftColor: tokens.colorBrandStroke1,
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },

  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
    padding: '48px',
    color: tokens.colorNeutralForeground3,
    textAlign: 'center',
  },

  slotCount: {
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorNeutralForeground3,
  },
});

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface TemplateListViewProps {
  onCreateNew: () => void;
  onEdit: (templateId: string) => void;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TemplateListView({ onCreateNew, onEdit, onClose }: TemplateListViewProps) {
  const styles = useStyles();
  const { data: templates, isLoading } = useTemplates();
  const deleteMutation = useDeleteTemplate();
  const [deleteConfirm, setDeleteConfirm] = useState<TemplateDto | null>(null);

  // Memoize parsed templates to avoid double JSON.parse per template per render
  const parsedTemplates = useMemo(() =>
    (templates ?? []).map((t) => ({
      dto: t,
      parsed: isTemplateDefinitionJson(t.cardSchema) ? parseTemplateDefinition(t.cardSchema) : null,
    })),
    [templates],
  );

  const handleDelete = (template: TemplateDto) => {
    setDeleteConfirm(template);
  };

  const confirmDelete = () => {
    if (deleteConfirm) {
      deleteMutation.mutate(deleteConfirm.id);
      setDeleteConfirm(null);
    }
  };

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <Text className={styles.title}>Manage Templates</Text>
        <Button
          appearance="subtle"
          onClick={onClose}
        >
          Close
        </Button>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
          <Spinner label="Loading templates..." />
        </div>
      ) : (
        <div className={styles.grid}>
          {/* Create new card */}
          <button
            type="button"
            className={styles.createCard}
            onClick={onCreateNew}
          >
            <Add24Regular />
            Create Template
          </button>

          {/* Existing templates (using memoized parsed data) */}
          {parsedTemplates.map(({ dto: t, parsed }) => {
            const Icon = parsed ? resolveTemplateIcon(parsed.iconName) : DocumentOnePage20Regular;
            const accentColor = parsed?.accentColor ?? '#8a8886';
            const slotCount = parsed?.slots.length ?? 0;

            return (
              <div key={t.id} className={styles.card}>
                <div className={styles.cardAccent} style={{ backgroundColor: accentColor }} />
                <div className={styles.cardBody}>
                  <div className={styles.cardHeader}>
                    <span className={styles.cardIcon} style={{ color: accentColor }}>
                      <Icon />
                    </span>
                    <span className={styles.cardName}>{t.name}</span>
                  </div>
                  {t.description && (
                    <span className={styles.cardDescription}>{t.description}</span>
                  )}
                  {parsed && (
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      <Badge appearance="outline" size="small" color="informative">
                        {slotCount} {slotCount === 1 ? 'section' : 'sections'}
                      </Badge>
                      {parsed.category !== 'general' && (
                        <Badge appearance="outline" size="small">
                          {parsed.category}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
                <div className={styles.cardFooter}>
                  <Button
                    appearance="subtle"
                    size="small"
                    icon={<Edit16Regular />}
                    onClick={() => { onEdit(t.id); }}
                  >
                    Edit
                  </Button>
                  <Button
                    appearance="subtle"
                    size="small"
                    icon={<Delete16Regular />}
                    onClick={() => { handleDelete(t); }}
                    disabled={deleteMutation.isPending}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!isLoading && (templates ?? []).length === 0 && (
        <div className={styles.emptyState}>
          <Text size={400}>No custom templates yet</Text>
          <Text size={200}>Create your first template to get started</Text>
        </div>
      )}

      {/* Delete confirmation dialog */}
      <Dialog
        open={deleteConfirm !== null}
        onOpenChange={(_e, data) => { if (!data.open) setDeleteConfirm(null); }}
      >
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Delete Template</DialogTitle>
            <DialogContent>
              Delete "{deleteConfirm?.name}"? This cannot be undone.
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => { setDeleteConfirm(null); }}>
                Cancel
              </Button>
              <Button appearance="primary" onClick={confirmDelete}>
                Delete
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}
```

**Step 2: Verify it compiles**

**Step 3: Commit**

```bash
git add src/CompanyCommunicator.Api/ClientApp/src/components/TemplateEditor/TemplateListView.tsx
git commit -m "feat(templates): add TemplateListView with grid and CRUD"
```

---

## Task 11: TemplateEditorModal wrapper (list + editor)

**Files:**
- Create: `components/TemplateEditor/TemplateEditorModal.tsx`

Top-level modal that manages the list/editor toggle. This is what CommunicationCenter renders.

**Step 1: Create the component**

```typescript
// components/TemplateEditor/TemplateEditorModal.tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { TemplateListView } from './TemplateListView';
import { TemplateEditor } from './TemplateEditor';

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const useStyles = makeStyles({
  overlay: {
    position: 'fixed',
    inset: 0,
    // z-index 200 so this stacks above ComposePanel (100) when opened from TemplatePicker
    zIndex: 200,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorBackgroundOverlay,
    backdropFilter: 'blur(4px)',
    animationName: {
      from: { opacity: 0 },
      to: { opacity: 1 },
    },
    animationDuration: '200ms',
    animationTimingFunction: 'ease-out',
    animationFillMode: 'both',
  },

  panel: {
    position: 'relative',
    width: 'calc(100% - 48px)',
    maxWidth: '960px',
    height: 'calc(100vh - 80px)',
    maxHeight: '85vh',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusXLarge,
    boxShadow: tokens.shadow64,
    overflow: 'hidden',
    animationName: {
      from: { opacity: 0, transform: 'scale(0.97)' },
      to: { opacity: 1, transform: 'scale(1)' },
    },
    animationDuration: '220ms',
    animationTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
    animationFillMode: 'both',
  },
});

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface TemplateEditorModalProps {
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type EditorMode = { view: 'list' } | { view: 'editor'; editId: string | null };

export function TemplateEditorModal({ onClose }: TemplateEditorModalProps) {
  const styles = useStyles();
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, true);

  const [mode, setMode] = useState<EditorMode>({ view: 'list' });

  // Escape key closes (only in list mode — editor handles its own Escape)
  useEffect(() => {
    if (mode.view !== 'list') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('keydown', onKeyDown); };
  }, [mode.view, onClose]);

  const handleCreateNew = useCallback(() => {
    setMode({ view: 'editor', editId: null });
  }, []);

  const handleEdit = useCallback((templateId: string) => {
    setMode({ view: 'editor', editId: templateId });
  }, []);

  const handleBackToList = useCallback(() => {
    setMode({ view: 'list' });
  }, []);

  // When in editor mode, render the TemplateEditor directly (it has its own overlay)
  if (mode.view === 'editor') {
    return (
      <TemplateEditor
        editId={mode.editId}
        onClose={handleBackToList}
      />
    );
  }

  // List mode — show within the modal
  return (
    <div
      className={styles.overlay}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={panelRef}
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-label="Manage Templates"
        tabIndex={-1}
      >
        <TemplateListView
          onCreateNew={handleCreateNew}
          onEdit={handleEdit}
          onClose={onClose}
        />
      </div>
    </div>
  );
}
```

**Step 2: Verify it compiles**

**Step 3: Commit**

```bash
git add src/CompanyCommunicator.Api/ClientApp/src/components/TemplateEditor/TemplateEditorModal.tsx
git commit -m "feat(templates): add TemplateEditorModal with list/editor toggle"
```

---

## Task 12: Wire TemplateEditor into CommunicationCenter

**Files:**
- Modify: `components/CommunicationCenter/CommunicationCenter.tsx`
- Modify: `components/HomeDashboard/HomeDashboard.tsx`

Add state + button to open the template editor from the home dashboard.

**Step 1: Add state to CommunicationCenter**

In `CommunicationCenter.tsx`:

1. Add import at top:
```typescript
const TemplateEditorModal = lazy(() =>
  import('@/components/TemplateEditor/TemplateEditorModal').then((m) => ({
    default: m.TemplateEditorModal,
  })),
);
```

2. Add state after `cloneValues`:
```typescript
const [templateEditorOpen, setTemplateEditorOpen] = useState(false);
```

3. Add handler:
```typescript
const handleOpenTemplateEditor = useCallback(() => {
  setTemplateEditorOpen(true);
}, []);

const handleCloseTemplateEditor = useCallback(() => {
  setTemplateEditorOpen(false);
}, []);
```

4. Pass `onManageTemplates` to HomeDashboard:
```typescript
<HomeDashboard onNavigate={handleViewChange} onManageTemplates={handleOpenTemplateEditor} />
```

5. Render the modal (after ComposePanel):
```typescript
{templateEditorOpen && (
  <Suspense fallback={null}>
    <TemplateEditorModal onClose={handleCloseTemplateEditor} />
  </Suspense>
)}
```

**Step 2: Add "Manage Templates" button to HomeDashboard**

In `HomeDashboard.tsx`:

1. Add import:
```typescript
import { DesignIdeas24Regular } from '@fluentui/react-icons';
```

2. Update `HomeDashboardProps`:
```typescript
interface HomeDashboardProps {
  onNavigate: (view: SidebarView) => void;
  onManageTemplates?: () => void;
}
```

3. Add a "Templates" card after the stat cards row. In the render, after the `statsRow` div:
```typescript
{onManageTemplates && (
  <div
    role="button"
    tabIndex={0}
    className={styles.statCard}
    onClick={onManageTemplates}
    onKeyDown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onManageTemplates();
      }
    }}
    aria-label="Manage Templates"
  >
    <div className={styles.statCardHeader}>
      <DesignIdeas24Regular className={styles.statCardIcon} />
      <span className={styles.statCardLabel}>Templates</span>
    </div>
    <span className={styles.statCardLink}>
      Manage <ArrowRight16Regular />
    </span>
  </div>
)}
```

**Step 3: Verify it compiles**

Run: `cd src/CompanyCommunicator.Api/ClientApp && npx tsc --noEmit`

**Step 4: Commit**

```bash
git add src/CompanyCommunicator.Api/ClientApp/src/components/CommunicationCenter/CommunicationCenter.tsx \
        src/CompanyCommunicator.Api/ClientApp/src/components/HomeDashboard/HomeDashboard.tsx
git commit -m "feat(templates): wire TemplateEditor into CommunicationCenter and HomeDashboard"
```

---

## Task 13: TemplatePicker upgrade — handle TemplateDefinition format

**Files:**
- Modify: `components/ComposePanel/TemplatePicker.tsx`

Upgrade the TemplatePicker to detect and properly handle custom templates stored as `TemplateDefinition` (alongside legacy `CardSchema` format). Add a "Manage Templates" link.

**Step 1: Update imports and add detection logic**

Add to imports:
```typescript
import {
  isTemplateDefinitionJson,
  parseTemplateDefinition,
} from '@/lib/templateDefinitions';
import { resolveTemplateIcon } from '@/components/TemplateEditor/IconPicker';
```

**Step 2: Add "Manage Templates" link and TemplateDefinition handling**

In the custom templates section (after the "Saved" divider), update the map to detect format:

```typescript
{customTemplates!.map((t) => {
  // Phase D: detect TemplateDefinition format
  if (isTemplateDefinitionJson(t.cardSchema)) {
    const templateDef = parseTemplateDefinition(t.cardSchema);
    if (!templateDef) return null;
    // Apply as TemplateDefinition (same as built-in)
    return (
      <TemplateCard
        key={t.id}
        name={templateDef.name}
        description={templateDef.description}
        icon={resolveTemplateIcon(templateDef.iconName)}
        accentColor={templateDef.accentColor}
        features={getSlotFeatures(templateDef)}
        onSelect={() => { handleSelectBuiltin({ ...templateDef, id: t.id, isBuiltIn: false }); }}
        onDelete={() => { handleDelete(t.id); }}
        isDeleting={deletingId === t.id}
      />
    );
  }

  // Legacy: CardSchema format
  const schema = parseCustomSchema(t.cardSchema);
  if (!schema) return null;
  return (
    <TemplateCard
      key={t.id}
      name={t.name}
      description={t.description ?? ''}
      icon={DocumentOnePage20Regular}
      accentColor="#8a8886"
      onSelect={() => { handleSelectCustom(schema); }}
      onDelete={() => { handleDelete(t.id); }}
      isDeleting={deletingId === t.id}
    />
  );
})}
```

**Step 3: Add onManageTemplates prop and link**

Add to `TemplatePickerProps`:
```typescript
/** Called when "Manage Templates" is clicked. */
onManageTemplates?: () => void;
```

After the custom templates grid, add a link:
```typescript
{onManageTemplates && (
  <div style={{ gridColumn: '1 / -1', textAlign: 'center', paddingTop: '8px' }}>
    <Button
      appearance="subtle"
      size="small"
      onClick={onManageTemplates}
    >
      Manage Templates
    </Button>
  </div>
)}
```

**Step 4: Thread onManageTemplates through ContentTab**

In `ContentTab.tsx`, add the prop pass-through from ComposePanel. In `ContentTabProps` add:
```typescript
onManageTemplates?: () => void;
```

And pass to `TemplatePicker`:
```typescript
<TemplatePicker
  form={form}
  defaultCollapsed={isEdit}
  onTemplateSelect={handleTemplateSelect}
  onManageTemplates={onManageTemplates}
/>
```

In `ComposePanel.tsx`, pass through:
```typescript
<ContentTab form={form} isEdit={isEdit} advancedMode={advancedMode} onManageTemplates={onManageTemplates} />
```

Add `onManageTemplates` to `ComposePanelProps`:
```typescript
onManageTemplates?: () => void;
```

And in `CommunicationCenter.tsx`, pass it:
```typescript
<ComposePanel
  editId={composeEditId}
  initialValues={cloneValues}
  onClose={handleCloseCompose}
  onDeliveryDone={handleDeliveryDone}
  onManageTemplates={handleOpenTemplateEditor}
/>
```

**Step 5: Verify it compiles**

Run: `cd src/CompanyCommunicator.Api/ClientApp && npx tsc --noEmit`

**Step 6: Commit**

```bash
git add src/CompanyCommunicator.Api/ClientApp/src/components/ComposePanel/TemplatePicker.tsx \
        src/CompanyCommunicator.Api/ClientApp/src/components/ComposePanel/ContentTab.tsx \
        src/CompanyCommunicator.Api/ClientApp/src/components/ComposePanel/ComposePanel.tsx \
        src/CompanyCommunicator.Api/ClientApp/src/components/CommunicationCenter/CommunicationCenter.tsx
git commit -m "feat(templates): upgrade TemplatePicker for TemplateDefinition format + manage link"
```

---

## Task 14: Replace legacy SaveTemplateDialog with TemplateDefinition format

**IMPORTANT:** `ActionBar.tsx` already has a fully implemented `SaveTemplateDialog` (lines 279-377) that saves templates in legacy `CardSchema` format. This task **replaces** that dialog with one that saves in the new `TemplateDefinition` format (with `schemaVersion: 2`), so there is only ONE format going forward.

**Files:**
- Modify: `components/ComposePanel/ActionBar.tsx`
- Modify: `components/ComposePanel/ComposePanel.tsx`

**Step 1: Read existing ActionBar.tsx**

Read `ActionBar.tsx` fully. Identify the existing `SaveTemplateDialog` component and its props. Note how it builds `CardSchema` from form values.

**Step 2: Replace SaveTemplateDialog internals**

Replace the save handler inside `SaveTemplateDialog` to build a `TemplateDefinition` instead of a legacy `CardSchema`. The conversion logic:

```typescript
import { serializeTemplateDefinition } from '@/lib/templateDefinitions';
import { SLOT_TYPE_LABELS } from '@/components/TemplateEditor/useTemplateEditor';
import type { TemplateDefinition, SlotDefinition } from '@/types';

/** Convert current compose form state to a TemplateDefinition for saving. */
function formToTemplateDefinition(
  name: string,
  description: string,
  form: UseFormReturn<ComposeFormValues>,
  activeTemplate: TemplateDefinition | null,
): TemplateDefinition {
  const values = form.getValues();
  const slots: SlotDefinition[] = [];

  if (activeTemplate) {
    // Preserve the template's slot structure; stamp current values as defaults
    for (const slotDef of activeTemplate.slots) {
      const currentValue = values.slotValues?.[slotDef.id];
      const isVisible = values.slotVisibility?.[slotDef.id] ?? true;
      slots.push({
        ...slotDef,
        defaultValue: currentValue,
        visibility: isVisible ? slotDef.visibility : 'optionalOff',
      });
    }
  } else {
    // No active template — build minimal slots from whatever fields have data
    let order = 0;
    if (values.title) {
      slots.push({ id: 'heading', type: 'heading', label: 'Heading', helpText: '', visibility: 'required', order: order++, defaultValue: { text: values.title } });
    }
    if (values.body) {
      slots.push({ id: 'body', type: 'bodyText', label: 'Body Text', helpText: '', visibility: 'optionalOn', order: order++, defaultValue: { text: values.body } });
    }
    if (values.imageUrl) {
      slots.push({ id: 'heroImage', type: 'heroImage', label: 'Hero Image', helpText: '', visibility: 'optionalOn', order: order++, defaultValue: { url: values.imageUrl } });
    }
    if (values.buttonTitle && values.buttonUrl) {
      slots.push({ id: 'linkButton', type: 'linkButton', label: 'Link Button', helpText: '', visibility: 'optionalOn', order: order++, defaultValue: { title: values.buttonTitle, url: values.buttonUrl } });
    }
  }

  return {
    id: '',
    name,
    description,
    iconName: activeTemplate?.iconName ?? 'DocumentOnePage',
    category: activeTemplate?.category ?? 'general',
    accentColor: activeTemplate?.accentColor ?? '#5B5FC7',
    isBuiltIn: false,
    slots,
  };
}
```

**Step 3: Update the save call**

In the dialog's submit handler, replace the legacy save with:
```typescript
const templateDef = formToTemplateDefinition(name, description, form, activeTemplate);
const json = serializeTemplateDefinition(templateDef);
await createTemplate({ name, description, cardSchema: json });
```

**Step 4: Remove the legacy `buildCardSchema` helper** (if it exists only for save-as-template). If `buildCardSchema` is used elsewhere, keep it but add a deprecation comment.

**Step 5: Verify and commit**

```bash
cd src/CompanyCommunicator.Api/ClientApp && npx tsc --noEmit
git add src/CompanyCommunicator.Api/ClientApp/src/components/ComposePanel/ActionBar.tsx \
        src/CompanyCommunicator.Api/ClientApp/src/components/ComposePanel/ComposePanel.tsx
git commit -m "feat(templates): replace legacy SaveTemplateDialog with TemplateDefinition format"
```

---

## Task 15: End-to-end verification + polish

**Files:**
- All TemplateEditor files

**Step 1: Run the build**

```bash
cd src/CompanyCommunicator.Api/ClientApp && npm run build
```

Fix any build errors.

**Step 2: Manual verification checklist**

- [ ] HomeDashboard shows "Templates" card → clicking opens TemplateEditorModal
- [ ] TemplateListView shows custom templates (or empty state)
- [ ] "Create Template" opens the three-panel editor
- [ ] Metadata form (name, description, icon picker, category, accent color) works
- [ ] Slot list shows sections with DnD reorder
- [ ] Adding a section via the menu works
- [ ] Removing a section works
- [ ] Selecting a slot shows its config in the center panel
- [ ] Slot config (type, label, help text, visibility, default value) saves
- [ ] Live preview updates as slots are configured
- [ ] Save creates the template (visible in template list and TemplatePicker)
- [ ] Edit loads existing template and saves changes
- [ ] Delete removes template with confirmation
- [ ] TemplatePicker shows new-format templates with proper icons and accent colors
- [ ] "Manage Templates" link in TemplatePicker opens the editor
- [ ] Escape key closes modals with dirty-check
- [ ] Keyboard navigation works throughout

**Step 3: Fix any issues found**

**Step 4: Final commit**

```bash
git commit -m "fix(templates): polish and fixes from end-to-end verification"
```

---

## File Summary

### New files (create):
| File | Task | Purpose |
|------|------|---------|
| `components/TemplateEditor/useTemplateEditor.ts` | 2 | State management hook |
| `components/TemplateEditor/TemplateEditor.tsx` | 3 | Three-panel editor layout |
| `components/TemplateEditor/SlotListPanel.tsx` | 4 | Left panel: slot list + DnD |
| `components/TemplateEditor/TemplateMetadataForm.tsx` | 5 | Template name/desc/icon/category |
| `components/TemplateEditor/IconPicker.tsx` | 6 | Fluent icon picker popover |
| `components/TemplateEditor/SlotConfigPanel.tsx` | 7 | Center panel: slot config |
| `components/TemplateEditor/DefaultValueEditor.tsx` | 8 | Type-specific default editors |
| `components/TemplateEditor/TemplatePreviewPanel.tsx` | 9 | Right panel: live preview |
| `components/TemplateEditor/TemplateListView.tsx` | 10 | Template grid/list view |
| `components/TemplateEditor/TemplateEditorModal.tsx` | 11 | Modal wrapper (list ↔ editor) |

### Modified files:
| File | Task | Change |
|------|------|--------|
| `lib/templateDefinitions.ts` | 1 | Add serialization helpers |
| `components/CommunicationCenter/CommunicationCenter.tsx` | 12 | Add template editor state + render |
| `components/HomeDashboard/HomeDashboard.tsx` | 12 | Add "Templates" card |
| `components/ComposePanel/TemplatePicker.tsx` | 13 | TemplateDefinition format + manage link |
| `components/ComposePanel/ContentTab.tsx` | 13 | Pass onManageTemplates prop |
| `components/ComposePanel/ComposePanel.tsx` | 13-14 | Pass onManageTemplates + save-as-template |
