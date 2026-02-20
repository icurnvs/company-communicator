import { useMemo } from 'react';
import {
  makeStyles,
  tokens,
  Switch,
  Text,
  Caption1,
} from '@fluentui/react-components';
import type { UseFormReturn } from 'react-hook-form';
import type { TemplateDefinition } from '@/types';
import type { ComposeFormValues } from '@/lib/validators';
import { SlotEditor } from './SlotEditors';
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

  slotSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
  },

  slotHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacingHorizontalS,
  },

  slotLabelGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    minWidth: 0,
    flex: 1,
  },

  slotLabel: {
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

  slotBody: {
    paddingLeft: tokens.spacingHorizontalXS,
  },

  variablesSection: {
    marginTop: tokens.spacingVerticalS,
    paddingTop: tokens.spacingVerticalS,
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
  },
});

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SlotListProps {
  template: TemplateDefinition;
  form: UseFormReturn<ComposeFormValues>;
  slotVisibility: Record<string, boolean>;
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
  onToggleSlot,
  onAddCustomVariable,
}: SlotListProps) {
  const styles = useStyles();

  const sortedSlots = useMemo(
    () => [...template.slots].sort((a, b) => a.order - b.order),
    [template.slots],
  );

  return (
    <div className={styles.root}>
      {sortedSlots.map((slot) => {
        const isRequired = slot.visibility === 'required';
        const isVisible = isRequired || (slotVisibility[slot.id] ?? slot.visibility === 'optionalOn');

        return (
          <div key={slot.id} className={styles.slotSection}>
            <div className={styles.slotHeader}>
              <div className={styles.slotLabelGroup}>
                <Text className={styles.slotLabel}>
                  {slot.label}
                  {isRequired && <span className={styles.requiredBadge}>*</span>}
                </Text>
                {slot.helpText && (
                  <Caption1 className={styles.helpText}>{slot.helpText}</Caption1>
                )}
              </div>

              {!isRequired && (
                <Switch
                  checked={isVisible}
                  onChange={(_e, data) => { onToggleSlot(slot.id, data.checked); }}
                  aria-label={`Toggle ${slot.label}`}
                />
              )}
            </div>

            {isVisible && (
              <div className={styles.slotBody}>
                <SlotEditor
                  slot={slot}
                  form={form}
                  onAddCustomVariable={onAddCustomVariable}
                />
              </div>
            )}
          </div>
        );
      })}

      <div className={styles.variablesSection}>
        <CustomVariablesPanel form={form} />
      </div>
    </div>
  );
}
