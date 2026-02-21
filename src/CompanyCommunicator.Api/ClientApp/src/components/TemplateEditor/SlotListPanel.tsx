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
  AddRegular,
  DeleteRegular,
  ReOrderDotsVerticalRegular,
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
        <ReOrderDotsVerticalRegular />
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
          icon={<DeleteRegular />}
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
              icon={<AddRegular />}
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
