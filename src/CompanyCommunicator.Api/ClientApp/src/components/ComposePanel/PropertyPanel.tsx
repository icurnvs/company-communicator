// PropertyPanel.tsx — Per-slot AC property overrides panel
import { useMemo, useCallback } from 'react';
import {
  makeStyles,
  tokens,
  Switch,
  SpinButton,
  ToggleButton,
  Text,
  Tooltip,
} from '@fluentui/react-components';
import { LockClosed16Regular } from '@fluentui/react-icons';
import type { SlotType } from '@/types';

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const useStyles = makeStyles({
  root: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: tokens.spacingVerticalXS + ' ' + tokens.spacingHorizontalS,
    padding: tokens.spacingHorizontalM,
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusMedium,
  },
  propertyRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  label: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXXS,
  },
  segmented: {
    display: 'flex',
    gap: '1px',
  },
  fullWidth: {
    gridColumn: '1 / -1',
  },
});

// ---------------------------------------------------------------------------
// Property definitions per slot type
// ---------------------------------------------------------------------------

interface PropertyDef {
  key: string;
  label: string;
  type: 'enum' | 'boolean' | 'number';
  options?: string[];
  defaultValue?: unknown;
  fullWidth?: boolean;
}

const PROPERTY_DEFS: Partial<Record<SlotType, PropertyDef[]>> = {
  heading: [
    { key: 'horizontalAlignment', label: 'Alignment', type: 'enum', options: ['left', 'center', 'right'], defaultValue: 'left' },
    { key: 'size', label: 'Size', type: 'enum', options: ['Small', 'Medium', 'Large', 'ExtraLarge'], defaultValue: 'Large' },
    { key: 'weight', label: 'Weight', type: 'enum', options: ['Lighter', 'Default', 'Bolder'], defaultValue: 'Bolder' },
    { key: 'color', label: 'Color', type: 'enum', options: ['Default', 'Accent', 'Good', 'Warning', 'Attention'], defaultValue: 'Default' },
    { key: 'isSubtle', label: 'Subtle', type: 'boolean', defaultValue: false },
  ],
  subheading: [
    { key: 'horizontalAlignment', label: 'Alignment', type: 'enum', options: ['left', 'center', 'right'], defaultValue: 'left' },
    { key: 'size', label: 'Size', type: 'enum', options: ['Small', 'Medium', 'Large', 'ExtraLarge'], defaultValue: 'Medium' },
    { key: 'weight', label: 'Weight', type: 'enum', options: ['Lighter', 'Default', 'Bolder'], defaultValue: 'Default' },
    { key: 'color', label: 'Color', type: 'enum', options: ['Default', 'Accent', 'Good', 'Warning', 'Attention'], defaultValue: 'Default' },
    { key: 'isSubtle', label: 'Subtle', type: 'boolean', defaultValue: true },
  ],
  bodyText: [
    { key: 'horizontalAlignment', label: 'Alignment', type: 'enum', options: ['left', 'center', 'right'], defaultValue: 'left' },
    { key: 'size', label: 'Size', type: 'enum', options: ['Small', 'Default', 'Medium', 'Large'], defaultValue: 'Default' },
    { key: 'color', label: 'Color', type: 'enum', options: ['Default', 'Accent', 'Good', 'Warning', 'Attention'], defaultValue: 'Default' },
    { key: 'isSubtle', label: 'Subtle', type: 'boolean', defaultValue: false },
    { key: 'maxLines', label: 'Max Lines', type: 'number', defaultValue: 0 },
  ],
  footer: [
    { key: 'horizontalAlignment', label: 'Alignment', type: 'enum', options: ['left', 'center', 'right'], defaultValue: 'left' },
    { key: 'size', label: 'Size', type: 'enum', options: ['Small', 'Default', 'Medium'], defaultValue: 'Small' },
    { key: 'color', label: 'Color', type: 'enum', options: ['Default', 'Accent', 'Good', 'Warning', 'Attention'], defaultValue: 'Default' },
    { key: 'isSubtle', label: 'Subtle', type: 'boolean', defaultValue: true },
  ],
  heroImage: [
    { key: 'size', label: 'Size', type: 'enum', options: ['Small', 'Medium', 'Large', 'Auto', 'Stretch'], defaultValue: 'Stretch' },
    { key: 'horizontalAlignment', label: 'Alignment', type: 'enum', options: ['left', 'center', 'right'], defaultValue: 'left' },
  ],
  keyDetails: [
    { key: 'separator', label: 'Separator', type: 'boolean', defaultValue: false },
  ],
  linkButton: [
    { key: 'style', label: 'Style', type: 'enum', options: ['default', 'positive', 'destructive'], defaultValue: 'positive' },
  ],
  divider: [
    { key: 'spacing', label: 'Spacing', type: 'enum', options: ['None', 'Small', 'Medium', 'Large'], defaultValue: 'Medium' },
  ],
  quoteCallout: [
    { key: 'separator', label: 'Separator', type: 'boolean', defaultValue: true },
  ],
  columns: [
    { key: 'separator', label: 'Separator', type: 'boolean', defaultValue: false },
  ],
  table: [
    { key: 'separator', label: 'Separator', type: 'boolean', defaultValue: false },
  ],
  statsRow: [
    { key: 'separator', label: 'Separator', type: 'boolean', defaultValue: false },
  ],
  imageGallery: [
    { key: 'separator', label: 'Separator', type: 'boolean', defaultValue: false },
  ],
  expandableSection: [
    { key: 'separator', label: 'Separator', type: 'boolean', defaultValue: false },
  ],
  iconTextRow: [
    { key: 'separator', label: 'Separator', type: 'boolean', defaultValue: false },
  ],
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PropertyPanelProps {
  slotType: SlotType;
  slotId: string;
  overrides: Record<string, unknown>;
  lockedProperties?: Record<string, unknown>;
  expanded: boolean;
  onChange: (slotId: string, property: string, value: unknown) => void;
}

// ---------------------------------------------------------------------------
// PropertyPanel — conditionally rendered (unmounted when collapsed)
// ---------------------------------------------------------------------------

export function PropertyPanel({
  slotType,
  slotId,
  overrides,
  lockedProperties,
  expanded,
  onChange,
}: PropertyPanelProps) {
  const styles = useStyles();

  const properties = useMemo(
    () => PROPERTY_DEFS[slotType] ?? [],
    [slotType],
  );

  const handleChange = useCallback(
    (key: string, value: unknown) => {
      onChange(slotId, key, value);
    },
    [slotId, onChange],
  );

  if (properties.length === 0 || !expanded) return null;

  return (
    <div className={styles.root}>
      {properties.map((prop) => {
        const isLocked = lockedProperties?.[prop.key] !== undefined;
        const currentValue = overrides[prop.key] ?? prop.defaultValue;

        return (
          <div
            key={prop.key}
            className={`${styles.propertyRow} ${prop.fullWidth ? styles.fullWidth : ''}`}
          >
            <Text className={styles.label}>
              {prop.label}
              {isLocked && (
                <Tooltip content="Locked by template" relationship="description">
                  <LockClosed16Regular aria-hidden="true" />
                </Tooltip>
              )}
            </Text>

            {prop.type === 'enum' && prop.options && (
              <div className={styles.segmented}>
                {prop.options.map((opt) => (
                  <ToggleButton
                    key={opt}
                    size="small"
                    checked={currentValue === opt}
                    disabled={isLocked}
                    onClick={() => { handleChange(prop.key, opt); }}
                  >
                    {opt}
                  </ToggleButton>
                ))}
              </div>
            )}

            {prop.type === 'boolean' && (
              <Switch
                checked={Boolean(currentValue)}
                disabled={isLocked}
                onChange={(_e, d) => { handleChange(prop.key, d.checked); }}
              />
            )}

            {prop.type === 'number' && (
              <SpinButton
                value={Number(currentValue) || 0}
                min={0}
                max={100}
                disabled={isLocked}
                onChange={(_e, d) => { handleChange(prop.key, d.value ?? 0); }}
                size="small"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
