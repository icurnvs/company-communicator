// CardSettingsPanel.tsx — Full-width toggle + accent color override
import { useCallback } from 'react';
import {
  makeStyles,
  tokens,
  Switch,
  Field,
  Input,
  Text,
} from '@fluentui/react-components';
import type { UseFormReturn } from 'react-hook-form';
import type { CardSettings } from '@/types';
import type { ComposeFormValues } from '@/lib/validators';

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
    padding: tokens.spacingHorizontalM,
    backgroundColor: tokens.colorNeutralBackground2,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
  },
  sectionLabel: {
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase200,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: tokens.colorNeutralForeground3,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacingHorizontalM,
  },
  colorInput: {
    maxWidth: '120px',
  },
});

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CardSettingsPanelProps {
  form: UseFormReturn<ComposeFormValues>;
}

// ---------------------------------------------------------------------------
// CardSettingsPanel
// ---------------------------------------------------------------------------

export function CardSettingsPanel({ form }: CardSettingsPanelProps) {
  const styles = useStyles();
  const cardSettings = form.watch('cardSettings');
  const fullWidth = cardSettings?.fullWidth ?? false;
  const accentColorOverride = cardSettings?.accentColorOverride ?? '';

  const updateSetting = useCallback(
    (key: string, value: unknown) => {
      const current: CardSettings = form.getValues('cardSettings') ?? {
        fullWidth: false,
        accentColorOverride: null,
      };
      form.setValue('cardSettings', { ...current, [key]: value }, { shouldDirty: true });
    },
    [form],
  );

  return (
    <div className={styles.root}>
      <Text className={styles.sectionLabel}>Card Settings</Text>

      <div className={styles.row}>
        <Text size={300}>Full-width card</Text>
        <Switch
          checked={fullWidth}
          onChange={(_e, data) => { updateSetting('fullWidth', data.checked); }}
          aria-label="Toggle full-width card layout"
        />
      </div>

      <Field label="Accent color override">
        <Input
          className={styles.colorInput}
          value={accentColorOverride}
          onChange={(_e, d) => {
            updateSetting('accentColorOverride', d.value || null);
          }}
          placeholder="#5B5FC7"
          type="text"
        />
      </Field>
    </div>
  );
}
