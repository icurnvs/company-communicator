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
