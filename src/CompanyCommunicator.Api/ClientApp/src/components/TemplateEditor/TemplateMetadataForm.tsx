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
