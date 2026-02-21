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
import type { SlotType, HeroImageSlotValue, KeyDetailsSlotValue, LinkButtonSlotValue } from '@/types';

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
      const v = raw && typeof raw.url === 'string' ? (raw as unknown as HeroImageSlotValue) : { url: '', altText: '' };
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
      const v = raw && Array.isArray(raw.pairs) ? (raw as unknown as KeyDetailsSlotValue) : { pairs: [] };
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
      const v = raw && typeof raw.title === 'string' ? (raw as unknown as LinkButtonSlotValue) : { title: '', url: '' };
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
