// ExtendedSlotEditors.tsx — 7 extended slot editors for Phase C Advanced mode
import { useCallback } from 'react';
import {
  makeStyles,
  tokens,
  Field,
  Input,
  Textarea,
  Button,
  Select,
  Text,
} from '@fluentui/react-components';
import { Add16Regular, Delete16Regular } from '@fluentui/react-icons';
import type { ExtendedSlotType } from '@/types';

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
    padding: tokens.spacingHorizontalM,
    backgroundColor: tokens.colorNeutralBackground2,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
  },
  row: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: tokens.spacingHorizontalS,
  },
  field: {
    flex: 1,
    minWidth: 0,
  },
  gridRow: {
    display: 'flex',
    gap: tokens.spacingHorizontalXS,
  },
  gridCell: {
    flex: 1,
    minWidth: 0,
  },
  removeBtn: {
    flexShrink: 0,
    marginBottom: '2px',
  },
});

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ExtendedSlotEditorProps {
  type: ExtendedSlotType;
  data: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
}

// ---------------------------------------------------------------------------
// Dispatch component — calls useStyles once, passes styles down
// ---------------------------------------------------------------------------

export function ExtendedSlotEditor({ type, data, onChange }: ExtendedSlotEditorProps) {
  const styles = useStyles();

  switch (type) {
    case 'imageGallery':
      return <ImageGalleryEditor data={data} onChange={onChange} styles={styles} />;
    case 'statsRow':
      return <StatsRowEditor data={data} onChange={onChange} styles={styles} />;
    case 'quoteCallout':
      return <QuoteCalloutEditor data={data} onChange={onChange} styles={styles} />;
    case 'columns':
      return <ColumnsEditor data={data} onChange={onChange} styles={styles} />;
    case 'table':
      return <TableEditor data={data} onChange={onChange} styles={styles} />;
    case 'expandableSection':
      return <ExpandableSectionEditor data={data} onChange={onChange} styles={styles} />;
    case 'iconTextRow':
      return <IconTextRowEditor data={data} onChange={onChange} styles={styles} />;
    default: {
      const _exhaustive: never = type;
      void _exhaustive;
      return null;
    }
  }
}

// ---------------------------------------------------------------------------
// Sub-editor props
// ---------------------------------------------------------------------------

type Styles = ReturnType<typeof useStyles>;

interface EditorProps {
  data: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
  styles: Styles;
}

// ---------------------------------------------------------------------------
// ImageGalleryEditor — uses images[]{url,altText} shape per ImageGallerySlotValue
// ---------------------------------------------------------------------------

function ImageGalleryEditor({ data, onChange, styles }: EditorProps) {
  const images = (data.images as Array<{ url: string; altText?: string }>) ?? [{ url: '', altText: '' }];
  const imageSize = (data.imageSize as string) ?? 'medium';

  const updateImage = useCallback((index: number, field: string, value: string) => {
    const next = images.map((img, i) => (i === index ? { ...img, [field]: value } : img));
    onChange({ ...data, images: next });
  }, [data, images, onChange]);

  const addImage = useCallback(() => {
    onChange({ ...data, images: [...images, { url: '', altText: '' }] });
  }, [data, images, onChange]);

  const removeImage = useCallback((index: number) => {
    onChange({ ...data, images: images.filter((_, i) => i !== index) });
  }, [data, images, onChange]);

  return (
    <div className={styles.container}>
      <Field label="Image Size">
        <Select
          value={imageSize}
          onChange={(_e, d) => { onChange({ ...data, imageSize: d.value }); }}
        >
          <option value="small">Small</option>
          <option value="medium">Medium</option>
          <option value="large">Large</option>
        </Select>
      </Field>
      {images.map((img, i) => (
        <div key={i} className={styles.row}>
          <div className={styles.field}>
            <Input
              value={img.url}
              onChange={(_e, d) => { updateImage(i, 'url', d.value); }}
              placeholder="https://..."
              type="url"
            />
          </div>
          {images.length > 1 && (
            <Button
              className={styles.removeBtn}
              appearance="subtle"
              size="small"
              icon={<Delete16Regular />}
              onClick={() => { removeImage(i); }}
              aria-label={`Remove image ${i + 1}`}
            />
          )}
        </div>
      ))}
      <Button
        appearance="subtle"
        size="small"
        icon={<Add16Regular />}
        onClick={addImage}
        style={{ alignSelf: 'flex-start' }}
      >
        Add image URL
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// StatsRowEditor
// ---------------------------------------------------------------------------

function StatsRowEditor({ data, onChange, styles }: EditorProps) {
  const stats = (data.stats as Array<{ value: string; label: string }>) ?? [{ value: '', label: '' }];

  const updateStat = useCallback((index: number, field: 'value' | 'label', val: string) => {
    const next = stats.map((s, i) => (i === index ? { ...s, [field]: val } : s));
    onChange({ ...data, stats: next });
  }, [data, stats, onChange]);

  const addStat = useCallback(() => {
    if (stats.length >= 4) return;
    onChange({ ...data, stats: [...stats, { value: '', label: '' }] });
  }, [data, stats, onChange]);

  const removeStat = useCallback((index: number) => {
    onChange({ ...data, stats: stats.filter((_, i) => i !== index) });
  }, [data, stats, onChange]);

  return (
    <div className={styles.container}>
      {stats.map((stat, i) => (
        <div key={i} className={styles.row}>
          <div className={styles.field}>
            <Field label={i === 0 ? 'Value' : undefined}>
              <Input
                value={stat.value}
                onChange={(_e, d) => { updateStat(i, 'value', d.value); }}
                placeholder="42"
              />
            </Field>
          </div>
          <div className={styles.field}>
            <Field label={i === 0 ? 'Label' : undefined}>
              <Input
                value={stat.label}
                onChange={(_e, d) => { updateStat(i, 'label', d.value); }}
                placeholder="Active users"
              />
            </Field>
          </div>
          {stats.length > 1 && (
            <Button
              className={styles.removeBtn}
              appearance="subtle"
              size="small"
              icon={<Delete16Regular />}
              onClick={() => { removeStat(i); }}
              aria-label={`Remove stat ${i + 1}`}
            />
          )}
        </div>
      ))}
      {stats.length < 4 && (
        <Button
          appearance="subtle"
          size="small"
          icon={<Add16Regular />}
          onClick={addStat}
          style={{ alignSelf: 'flex-start' }}
        >
          Add stat
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// QuoteCalloutEditor
// ---------------------------------------------------------------------------

function QuoteCalloutEditor({ data, onChange, styles }: EditorProps) {
  const text = (data.text as string) ?? '';
  const style = (data.style as string) ?? 'default';

  return (
    <div className={styles.container}>
      <Field label="Style">
        <Select
          value={style}
          onChange={(_e, d) => { onChange({ ...data, style: d.value }); }}
        >
          <option value="default">Default</option>
          <option value="good">Good (green)</option>
          <option value="warning">Warning (yellow)</option>
          <option value="attention">Attention (red)</option>
          <option value="accent">Accent</option>
        </Select>
      </Field>
      <Field label="Quote text">
        <Textarea
          value={text}
          onChange={(_e, d) => { onChange({ ...data, text: d.value }); }}
          placeholder="Enter quote or callout text..."
          rows={3}
          resize="vertical"
        />
      </Field>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ColumnsEditor — uses content (not text) per ColumnsSlotValue
// ---------------------------------------------------------------------------

function ColumnsEditor({ data, onChange, styles }: EditorProps) {
  const columns = (data.columns as Array<{ content: string; imageUrl?: string }>) ?? [
    { content: '' },
    { content: '' },
  ];

  const updateColumn = useCallback((index: number, field: string, val: string) => {
    const next = columns.map((c, i) =>
      i === index ? { ...c, [field]: val } : c,
    );
    onChange({ ...data, columns: next });
  }, [data, columns, onChange]);

  const addColumn = useCallback(() => {
    if (columns.length >= 3) return;
    onChange({ ...data, columns: [...columns, { content: '' }] });
  }, [data, columns, onChange]);

  const removeColumn = useCallback((index: number) => {
    if (columns.length <= 2) return;
    onChange({ ...data, columns: columns.filter((_, i) => i !== index) });
  }, [data, columns, onChange]);

  return (
    <div className={styles.container}>
      {columns.map((col, i) => (
        <div key={i} className={styles.container} style={{ padding: tokens.spacingHorizontalS }}>
          <div className={styles.row}>
            <Text weight="semibold" size={200}>Column {i + 1}</Text>
            {columns.length > 2 && (
              <Button
                appearance="subtle"
                size="small"
                icon={<Delete16Regular />}
                onClick={() => { removeColumn(i); }}
                aria-label={`Remove column ${i + 1}`}
              />
            )}
          </div>
          <Field label="Content">
            <Textarea
              value={col.content}
              onChange={(_e, d) => { updateColumn(i, 'content', d.value); }}
              placeholder="Column content..."
              rows={2}
              resize="vertical"
            />
          </Field>
          <Field label="Image URL (optional)">
            <Input
              value={col.imageUrl ?? ''}
              onChange={(_e, d) => { updateColumn(i, 'imageUrl', d.value); }}
              placeholder="https://..."
              type="url"
            />
          </Field>
        </div>
      ))}
      {columns.length < 3 && (
        <Button
          appearance="subtle"
          size="small"
          icon={<Add16Regular />}
          onClick={addColumn}
          style={{ alignSelf: 'flex-start' }}
        >
          Add column
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TableEditor
// ---------------------------------------------------------------------------

function TableEditor({ data, onChange, styles }: EditorProps) {
  const headers = (data.headers as string[]) ?? ['', ''];
  const rows = (data.rows as string[][]) ?? [['', '']];

  const updateHeader = useCallback((index: number, val: string) => {
    const next = [...headers];
    next[index] = val;
    onChange({ ...data, headers: next });
  }, [data, headers, onChange]);

  const updateCell = useCallback((row: number, col: number, val: string) => {
    const nextRows = rows.map((r, ri) =>
      ri === row ? r.map((c, ci) => (ci === col ? val : c)) : r,
    );
    onChange({ ...data, rows: nextRows });
  }, [data, rows, onChange]);

  const addColumn = useCallback(() => {
    onChange({
      ...data,
      headers: [...headers, ''],
      rows: rows.map((r) => [...r, '']),
    });
  }, [data, headers, rows, onChange]);

  const removeColumn = useCallback((index: number) => {
    if (headers.length <= 1) return;
    onChange({
      ...data,
      headers: headers.filter((_, i) => i !== index),
      rows: rows.map((r) => r.filter((_, i) => i !== index)),
    });
  }, [data, headers, rows, onChange]);

  const addRow = useCallback(() => {
    onChange({
      ...data,
      rows: [...rows, Array(headers.length).fill('')],
    });
  }, [data, headers, rows, onChange]);

  const removeRow = useCallback((index: number) => {
    onChange({ ...data, rows: rows.filter((_, i) => i !== index) });
  }, [data, rows, onChange]);

  return (
    <div className={styles.container}>
      {/* Header row */}
      <div className={styles.gridRow}>
        {headers.map((h, i) => (
          <div key={i} className={styles.gridCell}>
            <div className={styles.row}>
              <div className={styles.field}>
                <Input
                  value={h}
                  onChange={(_e, d) => { updateHeader(i, d.value); }}
                  placeholder={`Header ${i + 1}`}
                  style={{ fontWeight: 600 }}
                />
              </div>
              {headers.length > 1 && (
                <Button
                  className={styles.removeBtn}
                  appearance="subtle"
                  size="small"
                  icon={<Delete16Regular />}
                  onClick={() => { removeColumn(i); }}
                  aria-label={`Remove column ${i + 1}`}
                />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Data rows */}
      {rows.map((row, ri) => (
        <div key={ri} className={styles.gridRow}>
          {row.map((cell, ci) => (
            <div key={ci} className={styles.gridCell}>
              <Input
                value={cell}
                onChange={(_e, d) => { updateCell(ri, ci, d.value); }}
                placeholder="..."
              />
            </div>
          ))}
          <Button
            className={styles.removeBtn}
            appearance="subtle"
            size="small"
            icon={<Delete16Regular />}
            onClick={() => { removeRow(ri); }}
            aria-label={`Remove row ${ri + 1}`}
          />
        </div>
      ))}

      <div className={styles.row}>
        <Button appearance="subtle" size="small" icon={<Add16Regular />} onClick={addRow}>
          Add row
        </Button>
        <Button appearance="subtle" size="small" icon={<Add16Regular />} onClick={addColumn}>
          Add column
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ExpandableSectionEditor
// ---------------------------------------------------------------------------

function ExpandableSectionEditor({ data, onChange, styles }: EditorProps) {
  const title = (data.title as string) ?? '';
  const body = (data.body as string) ?? '';

  return (
    <div className={styles.container}>
      <Field label="Section title">
        <Input
          value={title}
          onChange={(_e, d) => { onChange({ ...data, title: d.value }); }}
          placeholder="Click to expand..."
        />
      </Field>
      <Field label="Body content">
        <Textarea
          value={body}
          onChange={(_e, d) => { onChange({ ...data, body: d.value }); }}
          placeholder="Hidden content revealed on click..."
          rows={3}
          resize="vertical"
        />
      </Field>
    </div>
  );
}

// ---------------------------------------------------------------------------
// IconTextRowEditor
// ---------------------------------------------------------------------------

function IconTextRowEditor({ data, onChange, styles }: EditorProps) {
  const iconName = (data.iconName as string) ?? '';
  const text = (data.text as string) ?? '';

  return (
    <div className={styles.container}>
      <div className={styles.row}>
        <div className={styles.field}>
          <Field label="Icon name">
            <Input
              value={iconName}
              onChange={(_e, d) => { onChange({ ...data, iconName: d.value }); }}
              placeholder="e.g. Heart, Star, Info"
            />
          </Field>
        </div>
        <div className={styles.field}>
          <Field label="Text">
            <Input
              value={text}
              onChange={(_e, d) => { onChange({ ...data, text: d.value }); }}
              placeholder="Descriptive text..."
            />
          </Field>
        </div>
      </div>
    </div>
  );
}
