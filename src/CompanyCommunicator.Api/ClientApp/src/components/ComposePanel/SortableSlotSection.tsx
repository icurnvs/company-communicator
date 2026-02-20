// SortableSlotSection.tsx — Wraps each slot for @dnd-kit sortable
import { memo } from 'react';
import type { ReactNode } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  makeStyles,
  tokens,
  Button,
  Text,
  Caption1,
  Switch,
  mergeClasses,
} from '@fluentui/react-components';
import {
  ReOrderDotsVertical20Regular,
  ChevronDown16Regular,
  ChevronRight16Regular,
  Delete16Regular,
} from '@fluentui/react-icons';

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
    // No CSS transition — let @dnd-kit manage transitions via inline style
  },
  dragging: {
    boxShadow: tokens.shadow8,
    zIndex: 10,
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusMedium,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
  },
  dragHandle: {
    cursor: 'grab',
    color: tokens.colorNeutralForeground3,
    opacity: 0,
    transition: 'opacity 150ms ease',
    flexShrink: 0,
    border: 'none',
    background: 'none',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    ':hover': {
      color: tokens.colorNeutralForeground1,
    },
  },
  dragHandleVisible: {
    opacity: 1,
  },
  labelGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    minWidth: 0,
    flex: 1,
  },
  label: {
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase300,
  },
  requiredBadge: {
    color: tokens.colorPaletteRedForeground1,
    fontSize: tokens.fontSizeBase200,
    marginLeft: tokens.spacingHorizontalXS,
  },
  helpText: {
    color: tokens.colorNeutralForeground3,
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXXS,
    flexShrink: 0,
  },
  body: {
    paddingLeft: tokens.spacingHorizontalXS,
  },
});

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SortableSlotSectionProps {
  id: string;
  label: string;
  helpText?: string;
  isRequired: boolean;
  isVisible: boolean;
  advancedMode: boolean;
  isAdditionalSlot: boolean;
  propertyExpanded: boolean;
  onToggleVisibility?: (visible: boolean) => void;
  onTogglePropertyPanel?: () => void;
  onDelete?: () => void;
  children: ReactNode;
  propertyPanel?: ReactNode;
}

// ---------------------------------------------------------------------------
// SortableSlotSection — memoized to avoid re-renders during DnD
// ---------------------------------------------------------------------------

export const SortableSlotSection = memo(function SortableSlotSection({
  id,
  label,
  helpText,
  isRequired,
  isVisible,
  advancedMode,
  isAdditionalSlot,
  propertyExpanded,
  onToggleVisibility,
  onTogglePropertyPanel,
  onDelete,
  children,
  propertyPanel,
}: SortableSlotSectionProps) {
  const styles = useStyles();

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !advancedMode });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={mergeClasses(styles.root, isDragging && styles.dragging)}
      id={`slot-${id}`}
    >
      <div className={styles.header}>
        {/* Drag handle — only in advanced mode, attributes on handle not root */}
        {advancedMode && (
          <button
            type="button"
            className={mergeClasses(
              styles.dragHandle,
              advancedMode && styles.dragHandleVisible,
            )}
            {...listeners}
            {...attributes}
            aria-label={`Drag to reorder ${label}`}
          >
            <ReOrderDotsVertical20Regular />
          </button>
        )}

        <div className={styles.labelGroup}>
          <Text className={styles.label}>
            {label}
            {isRequired && <span className={styles.requiredBadge}>*</span>}
          </Text>
          {helpText && (
            <Caption1 className={styles.helpText}>{helpText}</Caption1>
          )}
        </div>

        <div className={styles.actions}>
          {/* Expand/collapse property panel — only in advanced mode */}
          {advancedMode && propertyPanel && (
            <Button
              appearance="subtle"
              size="small"
              icon={propertyExpanded ? <ChevronDown16Regular /> : <ChevronRight16Regular />}
              onClick={onTogglePropertyPanel}
              aria-label={`${propertyExpanded ? 'Collapse' : 'Expand'} properties for ${label}`}
            />
          )}

          {/* Visibility toggle — not for required or additional slots */}
          {!isRequired && !isAdditionalSlot && onToggleVisibility && (
            <Switch
              checked={isVisible}
              onChange={(_e, data) => { onToggleVisibility(data.checked); }}
              aria-label={`Toggle ${label}`}
            />
          )}

          {/* Delete — only for additional slots */}
          {isAdditionalSlot && onDelete && (
            <Button
              appearance="subtle"
              size="small"
              icon={<Delete16Regular />}
              onClick={onDelete}
              aria-label={`Remove ${label}`}
            />
          )}
        </div>
      </div>

      {/* Slot editor content */}
      {isVisible && (
        <div className={styles.body}>
          {children}
        </div>
      )}

      {/* Property panel — below the editor */}
      {advancedMode && propertyPanel}
    </div>
  );
});
