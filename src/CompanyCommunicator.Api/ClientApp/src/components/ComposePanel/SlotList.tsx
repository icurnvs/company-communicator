// SlotList.tsx — Full rewrite for Phase C with DnD, property panels, extended slots
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useWatch } from 'react-hook-form';
import {
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import type { UseFormReturn } from 'react-hook-form';
import type { TemplateDefinition, ExtendedSlotType, SlotType } from '@/types';
import type { ComposeFormValues } from '@/lib/validators';
import { SlotEditor } from './SlotEditors';
import { ExtendedSlotEditor } from './ExtendedSlotEditors';
import { PropertyPanel } from './PropertyPanel';
import { SortableSlotSection } from './SortableSlotSection';
import { AddSectionPalette } from './AddSectionPalette';
import { CustomVariablesPanel } from './CustomVariablesPanel';

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
  variablesSection: {
    marginTop: tokens.spacingVerticalS,
    paddingTop: tokens.spacingVerticalS,
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  addSectionRow: {
    display: 'flex',
    justifyContent: 'center',
    paddingTop: tokens.spacingVerticalS,
  },
  dragOverlay: {
    padding: '8px',
    background: 'var(--colorNeutralBackground1)',
    boxShadow: 'var(--shadow8)',
    borderRadius: '4px',
  },
});

// ---------------------------------------------------------------------------
// Slot type display names
// ---------------------------------------------------------------------------

const EXTENDED_SLOT_LABELS: Record<ExtendedSlotType, string> = {
  imageGallery: 'Image Gallery',
  statsRow: 'Stats Row',
  quoteCallout: 'Quote / Callout',
  columns: 'Columns',
  table: 'Table',
  expandableSection: 'Expandable Section',
  iconTextRow: 'Icon + Text Row',
};

// ---------------------------------------------------------------------------
// Unified slot item (template + additional merged for ordering)
// ---------------------------------------------------------------------------

interface UnifiedSlot {
  id: string;
  type: SlotType;
  label: string;
  helpText?: string;
  isRequired: boolean;
  isAdditional: boolean;
  order: number;
  visibility: 'required' | 'optionalOn' | 'optionalOff';
}

// ---------------------------------------------------------------------------
// ID generator with fallback
// ---------------------------------------------------------------------------

const generateId = () =>
  typeof crypto?.randomUUID === 'function'
    ? crypto.randomUUID()
    : `slot-${Date.now()}-${Math.random().toString(36).slice(2)}`;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SlotListProps {
  template: TemplateDefinition;
  form: UseFormReturn<ComposeFormValues>;
  slotVisibility: Record<string, boolean>;
  advancedMode?: boolean;
  onToggleSlot: (slotId: string, visible: boolean) => void;
  onAddCustomVariable?: (name: string) => void;
}

// ---------------------------------------------------------------------------
// SlotList
// ---------------------------------------------------------------------------

export function SlotList({
  template,
  form,
  slotVisibility,
  advancedMode = false,
  onToggleSlot,
  onAddCustomVariable,
}: SlotListProps) {
  const styles = useStyles();

  // DnD sensors — delay-based to avoid accidental drags when scrolling in Teams iframe
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Property panel expand state
  const [expandedPanels, setExpandedPanels] = useState<Set<string>>(new Set());

  // Clear expanded panels when template changes
  useEffect(() => {
    setExpandedPanels(new Set());
  }, [template.id]);

  const togglePanel = useCallback((slotId: string) => {
    setExpandedPanels((prev) => {
      const next = new Set(prev);
      if (next.has(slotId)) next.delete(slotId);
      else next.add(slotId);
      return next;
    });
  }, []);

  // DragOverlay state
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragId(String(event.active.id));
  }, []);

  const handleDragCancel = useCallback(() => {
    setActiveDragId(null);
  }, []);

  // Use single useWatch instead of triple form.watch() for reactive values
  const [slotOrder, additionalSlots, advancedOverrides] = useWatch({
    control: form.control,
    name: ['slotOrder', 'additionalSlots', 'advancedOverrides'],
  });
  const safeSlotOrder = slotOrder ?? {};
  const safeAdditionalSlots = additionalSlots ?? [];
  const safeAdvancedOverrides = advancedOverrides ?? {};

  // Build unified ordered slot list
  const unifiedSlots = useMemo<UnifiedSlot[]>(() => {
    const templateSlots: UnifiedSlot[] = template.slots.map((s) => ({
      id: s.id,
      type: s.type,
      label: s.label,
      helpText: s.helpText,
      isRequired: s.visibility === 'required',
      isAdditional: false,
      order: safeSlotOrder[s.id] ?? s.order,
      visibility: s.visibility,
    }));

    const addSlots: UnifiedSlot[] = safeAdditionalSlots.map((s) => ({
      id: s.id,
      type: s.type as SlotType,
      label: EXTENDED_SLOT_LABELS[s.type as ExtendedSlotType] ?? s.type,
      isRequired: false,
      isAdditional: true,
      order: s.order,
      visibility: 'required' as const,
    }));

    return [...templateSlots, ...addSlots].sort((a, b) => a.order - b.order);
  }, [template.slots, safeAdditionalSlots, safeSlotOrder]);

  const sortableIds = useMemo(() => unifiedSlots.map((s) => s.id), [unifiedSlots]);

  // Helper for DnD announcements
  const getSlotLabel = useCallback((id: string | number) => {
    return unifiedSlots.find((s) => s.id === String(id))?.label ?? 'Section';
  }, [unifiedSlots]);

  // ---------------------------------------------------------------------------
  // Handlers — use form.getValues() inside to avoid stale closures
  // ---------------------------------------------------------------------------

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveDragId(null);
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      // Read LIVE values to avoid stale closure during rapid DnD
      const currentAdditional = form.getValues('additionalSlots') ?? [];
      const currentSlotOrder = form.getValues('slotOrder') ?? {};

      // Rebuild unified list from live values
      const liveUnified: UnifiedSlot[] = [
        ...template.slots.map((s) => ({
          id: s.id,
          type: s.type,
          label: s.label,
          isRequired: s.visibility === 'required',
          isAdditional: false,
          order: currentSlotOrder[s.id] ?? s.order,
          visibility: s.visibility,
        })),
        ...currentAdditional.map((s) => ({
          id: s.id,
          type: s.type as SlotType,
          label: EXTENDED_SLOT_LABELS[s.type as ExtendedSlotType] ?? s.type,
          isRequired: false,
          isAdditional: true,
          order: s.order,
          visibility: 'required' as const,
        })),
      ].sort((a, b) => a.order - b.order);

      const oldIndex = liveUnified.findIndex((s) => s.id === active.id);
      const newIndex = liveUnified.findIndex((s) => s.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = [...liveUnified];
      const [moved] = reordered.splice(oldIndex, 1);
      reordered.splice(newIndex, 0, moved!);

      const newSlotOrder: Record<string, number> = {};
      const newAdditionalSlots = [...currentAdditional];

      reordered.forEach((slot, i) => {
        if (slot.isAdditional) {
          const idx = newAdditionalSlots.findIndex((a) => a.id === slot.id);
          if (idx !== -1) {
            newAdditionalSlots[idx] = { ...newAdditionalSlots[idx]!, order: i };
          }
        } else {
          newSlotOrder[slot.id] = i;
        }
      });

      form.setValue('slotOrder', newSlotOrder, { shouldDirty: true });
      form.setValue('additionalSlots', newAdditionalSlots, { shouldDirty: true });
    },
    [form, template.slots],
  );

  const handleAddSection = useCallback(
    (type: ExtendedSlotType, defaultData: Record<string, unknown>) => {
      const currentAdditional = form.getValues('additionalSlots') ?? [];
      const currentSlotOrder = form.getValues('slotOrder') ?? {};
      const allOrders = [
        ...template.slots.map((s) => currentSlotOrder[s.id] ?? s.order),
        ...currentAdditional.map((s) => s.order),
      ];
      const maxOrder = allOrders.length > 0 ? Math.max(...allOrders) : -1;
      const newSlot = { id: generateId(), type, data: defaultData, order: maxOrder + 1 };
      form.setValue('additionalSlots', [...currentAdditional, newSlot], { shouldDirty: true });

      // Scroll new slot into view
      requestAnimationFrame(() => {
        const el = document.getElementById(`slot-${newSlot.id}`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    },
    [form, template.slots],
  );

  const handleDeleteAdditional = useCallback(
    (slotId: string) => {
      const current = form.getValues('additionalSlots') ?? [];
      form.setValue(
        'additionalSlots',
        current.filter((s) => s.id !== slotId),
        { shouldDirty: true },
      );
    },
    [form],
  );

  const handleAdditionalDataChange = useCallback(
    (slotId: string, newData: Record<string, unknown>) => {
      const current = form.getValues('additionalSlots') ?? [];
      form.setValue(
        'additionalSlots',
        current.map((s) => (s.id === slotId ? { ...s, data: newData } : s)),
        { shouldDirty: true },
      );
    },
    [form],
  );

  const handleOverrideChange = useCallback(
    (slotId: string, property: string, value: unknown) => {
      const current = form.getValues('advancedOverrides') ?? {};
      const slotOverrides = { ...(current[slotId] ?? {}), [property]: value };
      form.setValue(
        'advancedOverrides',
        { ...current, [slotId]: slotOverrides },
        { shouldDirty: true },
      );
    },
    [form],
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const slotContent = unifiedSlots.map((slot) => {
    const isVisible = slot.isRequired
      || slot.isAdditional
      || (slotVisibility[slot.id] ?? slot.visibility === 'optionalOn');

    const slotOverrides = safeAdvancedOverrides[slot.id] ?? {};
    const templateSlotDef = template.slots.find((s) => s.id === slot.id);

    return (
      <SortableSlotSection
        key={slot.id}
        id={slot.id}
        label={slot.label}
        helpText={slot.helpText}
        isRequired={slot.isRequired}
        isVisible={isVisible}
        advancedMode={advancedMode}
        isAdditionalSlot={slot.isAdditional}
        propertyExpanded={expandedPanels.has(slot.id)}
        onToggleVisibility={(visible) => { onToggleSlot(slot.id, visible); }}
        onTogglePropertyPanel={() => { togglePanel(slot.id); }}
        onDelete={slot.isAdditional ? () => { handleDeleteAdditional(slot.id); } : undefined}
        propertyPanel={
          advancedMode ? (
            <PropertyPanel
              slotType={slot.type}
              slotId={slot.id}
              overrides={slotOverrides}
              lockedProperties={templateSlotDef?.lockedProperties}
              expanded={expandedPanels.has(slot.id)}
              onChange={handleOverrideChange}
            />
          ) : undefined
        }
      >
        {slot.isAdditional ? (
          <ExtendedSlotEditor
            type={slot.type as ExtendedSlotType}
            data={safeAdditionalSlots.find((a) => a.id === slot.id)?.data ?? {}}
            onChange={(newData) => { handleAdditionalDataChange(slot.id, newData); }}
          />
        ) : (
          <SlotEditor
            slot={templateSlotDef!}
            form={form}
            onAddCustomVariable={onAddCustomVariable}
          />
        )}
      </SortableSlotSection>
    );
  });

  return (
    <div className={styles.root}>
      {advancedMode ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
          accessibility={{
            announcements: {
              onDragStart({ active }) { return `Picked up ${getSlotLabel(active.id)}`; },
              onDragEnd({ active, over }) { return over ? `Moved ${getSlotLabel(active.id)} to new position` : 'Drag cancelled'; },
              onDragCancel() { return 'Drag cancelled'; },
            },
          }}
        >
          <SortableContext
            items={sortableIds}
            strategy={verticalListSortingStrategy}
          >
            {slotContent}
          </SortableContext>
          <DragOverlay>
            {activeDragId ? (
              <div className={styles.dragOverlay}>
                {getSlotLabel(activeDragId)}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        slotContent
      )}

      {/* Add Section — only in advanced mode */}
      {advancedMode && (
        <div className={styles.addSectionRow}>
          <AddSectionPalette onAdd={handleAddSection} />
        </div>
      )}

      <div className={styles.variablesSection}>
        <CustomVariablesPanel form={form} />
      </div>
    </div>
  );
}
