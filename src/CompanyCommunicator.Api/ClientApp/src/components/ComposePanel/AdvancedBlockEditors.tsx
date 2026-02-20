// AdvancedBlockEditors.tsx — 15 advanced block editors for Phase C2
import { useCallback } from 'react';
import {
  makeStyles,
  tokens,
  Field,
  Input,
  Textarea,
  Button,
  Select,
  Switch,
  SpinButton,
  Text,
} from '@fluentui/react-components';
import { Add16Regular, Delete16Regular } from '@fluentui/react-icons';
import type { AdvancedBlockType } from '@/types';
import { SingleSeriesEditor, MultiSeriesEditor } from './ChartDataEditor';
import type { ChartDataPoint, ChartSeriesData } from '@/types';

// ---------------------------------------------------------------------------
// Styles (shared across all editors)
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
  removeBtn: {
    flexShrink: 0,
    marginBottom: '2px',
  },
  segmentRow: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    padding: tokens.spacingVerticalXS,
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusSmall,
  },
  toggleGroup: {
    display: 'flex',
    gap: '2px',
  },
  toggleBtn: {
    minWidth: '28px',
    padding: '2px 4px',
  },
});

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface AdvancedBlockEditorProps {
  type: AdvancedBlockType;
  data: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

export function AdvancedBlockEditor({ type, data, onChange }: AdvancedBlockEditorProps) {
  const styles = useStyles();

  switch (type) {
    // Content
    case 'richText':
      return <RichTextEditor data={data} onChange={onChange} styles={styles} />;
    case 'icon':
      return <IconEditor data={data} onChange={onChange} styles={styles} />;
    case 'badge':
      return <BadgeEditor data={data} onChange={onChange} styles={styles} />;
    case 'codeBlock':
      return <CodeBlockEditor data={data} onChange={onChange} styles={styles} />;
    case 'ratingDisplay':
      return <RatingDisplayEditor data={data} onChange={onChange} styles={styles} />;
    case 'compoundButton':
      return <CompoundButtonEditor data={data} onChange={onChange} styles={styles} />;
    // Layout
    case 'flowLayout':
      return <FlowLayoutEditor data={data} onChange={onChange} styles={styles} />;
    case 'gridLayout':
      return <GridLayoutEditor data={data} onChange={onChange} styles={styles} />;
    // Charts
    case 'donutChart':
      return <DonutChartEditor data={data} onChange={onChange} styles={styles} />;
    case 'verticalBar':
      return <VerticalBarEditor data={data} onChange={onChange} styles={styles} />;
    case 'groupedBar':
      return <GroupedBarEditor data={data} onChange={onChange} styles={styles} />;
    case 'horizontalBar':
      return <HorizontalBarEditor data={data} onChange={onChange} styles={styles} />;
    case 'stackedBar':
      return <StackedBarEditor data={data} onChange={onChange} styles={styles} />;
    case 'lineChart':
      return <LineChartEditor data={data} onChange={onChange} styles={styles} />;
    case 'gauge':
      return <GaugeEditor data={data} onChange={onChange} styles={styles} />;
    default: {
      const _exhaustive: never = type;
      void _exhaustive;
      return null;
    }
  }
}

// ---------------------------------------------------------------------------
// Shared editor props
// ---------------------------------------------------------------------------

type Styles = ReturnType<typeof useStyles>;

interface EditorProps {
  data: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
  styles: Styles;
}

// ============================================================================
// CONTENT EDITORS
// ============================================================================

// ---------------------------------------------------------------------------
// RichTextEditor — TextRun segments with inline formatting
// ---------------------------------------------------------------------------

interface Segment {
  text: string;
  bold?: boolean;
  italic?: boolean;
  strikethrough?: boolean;
  underline?: boolean;
  highlight?: boolean;
  color?: string;
}

function RichTextEditor({ data, onChange, styles }: EditorProps) {
  const segments = (data.segments as Segment[]) ?? [{ text: '' }];

  const updateSegment = useCallback((index: number, updates: Partial<Segment>) => {
    const next = segments.map((s, i) => (i === index ? { ...s, ...updates } : s));
    onChange({ ...data, segments: next });
  }, [data, segments, onChange]);

  const addSegment = useCallback(() => {
    onChange({ ...data, segments: [...segments, { text: '' }] });
  }, [data, segments, onChange]);

  const removeSegment = useCallback((index: number) => {
    onChange({ ...data, segments: segments.filter((_, i) => i !== index) });
  }, [data, segments, onChange]);

  return (
    <div className={styles.container}>
      {segments.map((seg, i) => (
        <div key={i} className={styles.segmentRow}>
          <div className={styles.field}>
            <Input
              value={seg.text}
              onChange={(_e, d) => { updateSegment(i, { text: d.value }); }}
              placeholder="Text segment..."
            />
          </div>
          <div className={styles.toggleGroup}>
            <Button
              className={styles.toggleBtn}
              size="small"
              appearance={seg.bold ? 'primary' : 'subtle'}
              onClick={() => { updateSegment(i, { bold: !seg.bold }); }}
              aria-label="Bold"
              aria-pressed={seg.bold ?? false}
            >
              <strong>B</strong>
            </Button>
            <Button
              className={styles.toggleBtn}
              size="small"
              appearance={seg.italic ? 'primary' : 'subtle'}
              onClick={() => { updateSegment(i, { italic: !seg.italic }); }}
              aria-label="Italic"
              aria-pressed={seg.italic ?? false}
            >
              <em>I</em>
            </Button>
            <Button
              className={styles.toggleBtn}
              size="small"
              appearance={seg.strikethrough ? 'primary' : 'subtle'}
              onClick={() => { updateSegment(i, { strikethrough: !seg.strikethrough }); }}
              aria-label="Strikethrough"
              aria-pressed={seg.strikethrough ?? false}
            >
              <s>S</s>
            </Button>
            <Button
              className={styles.toggleBtn}
              size="small"
              appearance={seg.underline ? 'primary' : 'subtle'}
              onClick={() => { updateSegment(i, { underline: !seg.underline }); }}
              aria-label="Underline"
              aria-pressed={seg.underline ?? false}
            >
              <u>U</u>
            </Button>
          </div>
          {segments.length > 1 && (
            <Button
              className={styles.removeBtn}
              appearance="subtle"
              size="small"
              icon={<Delete16Regular />}
              onClick={() => { removeSegment(i); }}
              aria-label={`Remove segment ${i + 1}`}
            />
          )}
        </div>
      ))}
      <Button
        appearance="subtle"
        size="small"
        icon={<Add16Regular />}
        onClick={addSegment}
        style={{ alignSelf: 'flex-start' }}
      >
        Add text segment
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// IconEditor
// ---------------------------------------------------------------------------

function IconEditor({ data, onChange, styles }: EditorProps) {
  return (
    <div className={styles.container}>
      <div className={styles.row}>
        <div className={styles.field}>
          <Field label="Icon name">
            <Input
              value={(data.name as string) ?? ''}
              onChange={(_e, d) => { onChange({ ...data, name: d.value }); }}
              placeholder="e.g. Calendar, Heart, Star"
            />
          </Field>
        </div>
        <div className={styles.field}>
          <Field label="Size">
            <Select
              value={(data.size as string) ?? 'Standard'}
              onChange={(_e, d) => { onChange({ ...data, size: d.value }); }}
            >
              <option value="xxSmall">XX-Small</option>
              <option value="xSmall">X-Small</option>
              <option value="Small">Small</option>
              <option value="Standard">Standard</option>
              <option value="Medium">Medium</option>
              <option value="Large">Large</option>
              <option value="xLarge">X-Large</option>
              <option value="xxLarge">XX-Large</option>
            </Select>
          </Field>
        </div>
      </div>
      <div className={styles.row}>
        <div className={styles.field}>
          <Field label="Color">
            <Select
              value={(data.color as string) ?? 'Default'}
              onChange={(_e, d) => { onChange({ ...data, color: d.value }); }}
            >
              <option value="Default">Default</option>
              <option value="Dark">Dark</option>
              <option value="Light">Light</option>
              <option value="Accent">Accent</option>
              <option value="Good">Good</option>
              <option value="Warning">Warning</option>
              <option value="Attention">Attention</option>
            </Select>
          </Field>
        </div>
        <div className={styles.field}>
          <Field label="Style">
            <Select
              value={(data.style as string) ?? 'Regular'}
              onChange={(_e, d) => { onChange({ ...data, style: d.value }); }}
            >
              <option value="Regular">Regular</option>
              <option value="Filled">Filled</option>
            </Select>
          </Field>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// BadgeEditor
// ---------------------------------------------------------------------------

function BadgeEditor({ data, onChange, styles }: EditorProps) {
  return (
    <div className={styles.container}>
      <div className={styles.row}>
        <div className={styles.field}>
          <Field label="Badge text">
            <Input
              value={(data.text as string) ?? ''}
              onChange={(_e, d) => { onChange({ ...data, text: d.value }); }}
              placeholder="Status text..."
            />
          </Field>
        </div>
        <div className={styles.field}>
          <Field label="Icon (optional)">
            <Input
              value={(data.icon as string) ?? ''}
              onChange={(_e, d) => { onChange({ ...data, icon: d.value }); }}
              placeholder="e.g. CheckmarkCircle"
            />
          </Field>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CodeBlockEditor
// ---------------------------------------------------------------------------

const CODE_LANGUAGES = [
  'PlainText', 'Bash', 'C', 'C++', 'C#', 'CSS', 'DOS', 'Go', 'GraphQL',
  'HTML', 'Java', 'JavaScript', 'JSON', 'Perl', 'PHP', 'PowerShell',
  'Python', 'SQL', 'TypeScript', 'Visual Basic', 'XML',
];

function CodeBlockEditor({ data, onChange, styles }: EditorProps) {
  return (
    <div className={styles.container}>
      <Field label="Language">
        <Select
          value={(data.language as string) ?? 'PlainText'}
          onChange={(_e, d) => { onChange({ ...data, language: d.value }); }}
        >
          {CODE_LANGUAGES.map((lang) => (
            <option key={lang} value={lang}>{lang}</option>
          ))}
        </Select>
      </Field>
      <Field label="Code">
        <Textarea
          value={(data.code as string) ?? ''}
          onChange={(_e, d) => { onChange({ ...data, code: d.value }); }}
          placeholder="Paste or type code here..."
          rows={6}
          resize="vertical"
          style={{ fontFamily: 'monospace' }}
        />
      </Field>
    </div>
  );
}

// ---------------------------------------------------------------------------
// RatingDisplayEditor
// ---------------------------------------------------------------------------

function RatingDisplayEditor({ data, onChange, styles }: EditorProps) {
  return (
    <div className={styles.container}>
      <div className={styles.row}>
        <div className={styles.field}>
          <Field label="Rating value">
            <SpinButton
              value={Number(data.value) || 0}
              min={0}
              max={Number(data.max) || 5}
              step={0.5}
              onChange={(_e, d) => { onChange({ ...data, value: d.value ?? 0 }); }}
            />
          </Field>
        </div>
        <div className={styles.field}>
          <Field label="Max stars">
            <SpinButton
              value={Number(data.max) || 5}
              min={1}
              max={10}
              onChange={(_e, d) => { onChange({ ...data, max: d.value ?? 5 }); }}
            />
          </Field>
        </div>
      </div>
      <div className={styles.row}>
        <div className={styles.field}>
          <Field label="Color">
            <Select
              value={(data.color as string) ?? 'Neutral'}
              onChange={(_e, d) => { onChange({ ...data, color: d.value }); }}
            >
              <option value="Neutral">Neutral</option>
              <option value="Marigold">Marigold (gold)</option>
            </Select>
          </Field>
        </div>
        <div className={styles.field}>
          <Field label="Style">
            <Select
              value={(data.style as string) ?? 'Default'}
              onChange={(_e, d) => { onChange({ ...data, style: d.value }); }}
            >
              <option value="Default">Default (stars)</option>
              <option value="Compact">Compact (number)</option>
            </Select>
          </Field>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CompoundButtonEditor
// ---------------------------------------------------------------------------

function CompoundButtonEditor({ data, onChange, styles }: EditorProps) {
  return (
    <div className={styles.container}>
      <Field label="Button title">
        <Input
          value={(data.title as string) ?? ''}
          onChange={(_e, d) => { onChange({ ...data, title: d.value }); }}
          placeholder="Click me"
        />
      </Field>
      <Field label="Description (optional)">
        <Input
          value={(data.description as string) ?? ''}
          onChange={(_e, d) => { onChange({ ...data, description: d.value }); }}
          placeholder="Additional context..."
        />
      </Field>
      <div className={styles.row}>
        <div className={styles.field}>
          <Field label="Icon (optional)">
            <Input
              value={(data.icon as string) ?? ''}
              onChange={(_e, d) => { onChange({ ...data, icon: d.value }); }}
              placeholder="e.g. Send"
            />
          </Field>
        </div>
        <div className={styles.field}>
          <Field label="URL (optional)">
            <Input
              value={(data.url as string) ?? ''}
              onChange={(_e, d) => { onChange({ ...data, url: d.value }); }}
              placeholder="https://..."
              type="url"
            />
          </Field>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// LAYOUT EDITORS
// ============================================================================

// ---------------------------------------------------------------------------
// FlowLayoutEditor
// ---------------------------------------------------------------------------

function FlowLayoutEditor({ data, onChange, styles }: EditorProps) {
  const items = (data.items as Array<{ text: string; icon?: string }>) ?? [{ text: '' }];

  const updateItem = useCallback((index: number, field: string, val: string) => {
    const next = items.map((item, i) => (i === index ? { ...item, [field]: val } : item));
    onChange({ ...data, items: next });
  }, [data, items, onChange]);

  const addItem = useCallback(() => {
    onChange({ ...data, items: [...items, { text: '' }] });
  }, [data, items, onChange]);

  const removeItem = useCallback((index: number) => {
    onChange({ ...data, items: items.filter((_, i) => i !== index) });
  }, [data, items, onChange]);

  return (
    <div className={styles.container}>
      <Field label="Item width (optional)">
        <Input
          value={(data.itemWidth as string) ?? ''}
          onChange={(_e, d) => { onChange({ ...data, itemWidth: d.value }); }}
          placeholder='e.g. "150px"'
        />
      </Field>
      {items.map((item, i) => (
        <div key={i} className={styles.row}>
          <div className={styles.field}>
            <Input
              value={item.text}
              onChange={(_e, d) => { updateItem(i, 'text', d.value); }}
              placeholder="Item text"
            />
          </div>
          <div className={styles.field}>
            <Input
              value={item.icon ?? ''}
              onChange={(_e, d) => { updateItem(i, 'icon', d.value); }}
              placeholder="Icon (optional)"
            />
          </div>
          {items.length > 1 && (
            <Button
              className={styles.removeBtn}
              appearance="subtle"
              size="small"
              icon={<Delete16Regular />}
              onClick={() => { removeItem(i); }}
              aria-label={`Remove item ${i + 1}`}
            />
          )}
        </div>
      ))}
      <Button
        appearance="subtle"
        size="small"
        icon={<Add16Regular />}
        onClick={addItem}
        style={{ alignSelf: 'flex-start' }}
      >
        Add item
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// GridLayoutEditor
// ---------------------------------------------------------------------------

function GridLayoutEditor({ data, onChange, styles }: EditorProps) {
  const columns = (data.columns as number[]) ?? [50, 50];
  const areas = (data.areas as Array<{ name: string; content: string; imageUrl?: string }>) ?? [
    { name: 'left', content: '' },
    { name: 'right', content: '' },
  ];

  const updateColumn = useCallback((index: number, val: number) => {
    const next = [...columns];
    next[index] = val;
    onChange({ ...data, columns: next });
  }, [data, columns, onChange]);

  const updateArea = useCallback((index: number, field: string, val: string) => {
    const next = areas.map((a, i) => (i === index ? { ...a, [field]: val } : a));
    onChange({ ...data, areas: next });
  }, [data, areas, onChange]);

  const addArea = useCallback(() => {
    onChange({
      ...data,
      columns: [...columns, 50],
      areas: [...areas, { name: `area-${areas.length}`, content: '' }],
    });
  }, [data, columns, areas, onChange]);

  const removeArea = useCallback((index: number) => {
    if (areas.length <= 1) return;
    onChange({
      ...data,
      columns: columns.filter((_, i) => i !== index),
      areas: areas.filter((_, i) => i !== index),
    });
  }, [data, columns, areas, onChange]);

  return (
    <div className={styles.container}>
      <Text size={200} weight="semibold">Column widths (%)</Text>
      <div className={styles.row}>
        {columns.map((w, i) => (
          <div key={i} className={styles.field}>
            <SpinButton
              value={w}
              min={10}
              max={90}
              step={5}
              onChange={(_e, d) => { updateColumn(i, d.value ?? 50); }}
              size="small"
            />
          </div>
        ))}
      </div>
      {areas.map((area, i) => (
        <div key={i} className={styles.container} style={{ padding: tokens.spacingHorizontalS }}>
          <div className={styles.row}>
            <div className={styles.field}>
              <Field label="Area name">
                <Input
                  value={area.name}
                  onChange={(_e, d) => { updateArea(i, 'name', d.value); }}
                  placeholder="area-name"
                />
              </Field>
            </div>
            {areas.length > 1 && (
              <Button
                className={styles.removeBtn}
                appearance="subtle"
                size="small"
                icon={<Delete16Regular />}
                onClick={() => { removeArea(i); }}
                aria-label={`Remove area ${i + 1}`}
              />
            )}
          </div>
          <Field label="Content">
            <Textarea
              value={area.content}
              onChange={(_e, d) => { updateArea(i, 'content', d.value); }}
              placeholder="Area content..."
              rows={2}
              resize="vertical"
            />
          </Field>
          <Field label="Image URL (optional)">
            <Input
              value={area.imageUrl ?? ''}
              onChange={(_e, d) => { updateArea(i, 'imageUrl', d.value); }}
              placeholder="https://..."
              type="url"
            />
          </Field>
        </div>
      ))}
      <Button
        appearance="subtle"
        size="small"
        icon={<Add16Regular />}
        onClick={addArea}
        style={{ alignSelf: 'flex-start' }}
      >
        Add area
      </Button>
    </div>
  );
}

// ============================================================================
// CHART EDITORS — All delegate to SingleSeriesEditor or MultiSeriesEditor
// ============================================================================

// ---------------------------------------------------------------------------
// DonutChartEditor
// ---------------------------------------------------------------------------

function DonutChartEditor({ data, onChange, styles }: EditorProps) {
  const chartData = (data.data as ChartDataPoint[]) ?? [{ label: '', value: 0 }];

  return (
    <div className={styles.container}>
      <Field label="Chart title (optional)">
        <Input
          value={(data.title as string) ?? ''}
          onChange={(_e, d) => { onChange({ ...data, title: d.value }); }}
          placeholder="Donut chart title"
        />
      </Field>
      <Field label="Color set">
        <Select
          value={(data.colorSet as string) ?? 'categorical'}
          onChange={(_e, d) => { onChange({ ...data, colorSet: d.value }); }}
        >
          <option value="categorical">Categorical</option>
          <option value="sequential">Sequential</option>
          <option value="diverging">Diverging</option>
        </Select>
      </Field>
      <SingleSeriesEditor
        data={chartData}
        onChange={(points) => { onChange({ ...data, data: points }); }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// VerticalBarEditor
// ---------------------------------------------------------------------------

function VerticalBarEditor({ data, onChange, styles }: EditorProps) {
  const chartData = (data.data as ChartDataPoint[]) ?? [{ label: '', value: 0 }];

  return (
    <div className={styles.container}>
      <Field label="Chart title (optional)">
        <Input
          value={(data.title as string) ?? ''}
          onChange={(_e, d) => { onChange({ ...data, title: d.value }); }}
          placeholder="Bar chart title"
        />
      </Field>
      <Switch
        label="Show bar values"
        checked={Boolean(data.showBarValues)}
        onChange={(_e, d) => { onChange({ ...data, showBarValues: d.checked }); }}
      />
      <SingleSeriesEditor
        data={chartData}
        onChange={(points) => { onChange({ ...data, data: points }); }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// GroupedBarEditor
// ---------------------------------------------------------------------------

function GroupedBarEditor({ data, onChange, styles }: EditorProps) {
  const series = (data.series as ChartSeriesData[]) ?? [{ legend: '', values: [{ x: '', y: 0 }] }];

  return (
    <div className={styles.container}>
      <Field label="Chart title (optional)">
        <Input
          value={(data.title as string) ?? ''}
          onChange={(_e, d) => { onChange({ ...data, title: d.value }); }}
          placeholder="Grouped bar chart title"
        />
      </Field>
      <div className={styles.row}>
        <Switch
          label="Stacked"
          checked={Boolean(data.stacked)}
          onChange={(_e, d) => { onChange({ ...data, stacked: d.checked }); }}
        />
        <Switch
          label="Show values"
          checked={Boolean(data.showBarValues)}
          onChange={(_e, d) => { onChange({ ...data, showBarValues: d.checked }); }}
        />
      </div>
      <MultiSeriesEditor
        series={series}
        onChange={(s) => { onChange({ ...data, series: s }); }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// HorizontalBarEditor
// ---------------------------------------------------------------------------

function HorizontalBarEditor({ data, onChange, styles }: EditorProps) {
  const chartData = (data.data as ChartDataPoint[]) ?? [{ label: '', value: 0 }];

  return (
    <div className={styles.container}>
      <Field label="Chart title (optional)">
        <Input
          value={(data.title as string) ?? ''}
          onChange={(_e, d) => { onChange({ ...data, title: d.value }); }}
          placeholder="Horizontal bar chart title"
        />
      </Field>
      <Field label="Display mode">
        <Select
          value={(data.displayMode as string) ?? 'AbsoluteWithAxis'}
          onChange={(_e, d) => { onChange({ ...data, displayMode: d.value }); }}
        >
          <option value="AbsoluteWithAxis">Absolute (with axis)</option>
          <option value="AbsoluteNoAxis">Absolute (no axis)</option>
          <option value="PartToWhole">Part-to-whole (%)</option>
        </Select>
      </Field>
      <SingleSeriesEditor
        data={chartData}
        onChange={(points) => { onChange({ ...data, data: points }); }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// StackedBarEditor
// ---------------------------------------------------------------------------

function StackedBarEditor({ data, onChange, styles }: EditorProps) {
  const series = (data.series as Array<{ title: string; data: ChartDataPoint[] }>) ?? [
    { title: '', data: [{ label: '', value: 0 }] },
  ];

  const updateSeriesTitle = useCallback((index: number, title: string) => {
    const next = series.map((s, i) => (i === index ? { ...s, title } : s));
    onChange({ ...data, series: next });
  }, [data, series, onChange]);

  const updateSeriesData = useCallback((index: number, points: ChartDataPoint[]) => {
    const next = series.map((s, i) => (i === index ? { ...s, data: points } : s));
    onChange({ ...data, series: next });
  }, [data, series, onChange]);

  const addSeries = useCallback(() => {
    onChange({ ...data, series: [...series, { title: '', data: [{ label: '', value: 0 }] }] });
  }, [data, series, onChange]);

  const removeSeries = useCallback((index: number) => {
    onChange({ ...data, series: series.filter((_, i) => i !== index) });
  }, [data, series, onChange]);

  return (
    <div className={styles.container}>
      <Field label="Chart title (optional)">
        <Input
          value={(data.title as string) ?? ''}
          onChange={(_e, d) => { onChange({ ...data, title: d.value }); }}
          placeholder="Stacked bar chart title"
        />
      </Field>
      {series.map((s, i) => (
        <div key={i} className={styles.container} style={{ padding: tokens.spacingHorizontalS }}>
          <div className={styles.row}>
            <div className={styles.field}>
              <Field label={`Series ${i + 1}`}>
                <Input
                  value={s.title}
                  onChange={(_e, d) => { updateSeriesTitle(i, d.value); }}
                  placeholder="Series name"
                />
              </Field>
            </div>
            {series.length > 1 && (
              <Button
                className={styles.removeBtn}
                appearance="subtle"
                size="small"
                icon={<Delete16Regular />}
                onClick={() => { removeSeries(i); }}
                aria-label={`Remove series ${i + 1}`}
              />
            )}
          </div>
          <SingleSeriesEditor
            data={s.data}
            onChange={(points) => { updateSeriesData(i, points); }}
          />
        </div>
      ))}
      <Button
        appearance="subtle"
        size="small"
        icon={<Add16Regular />}
        onClick={addSeries}
        style={{ alignSelf: 'flex-start' }}
      >
        Add series
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LineChartEditor
// ---------------------------------------------------------------------------

function LineChartEditor({ data, onChange, styles }: EditorProps) {
  const series = (data.series as ChartSeriesData[]) ?? [{ legend: '', values: [{ x: '', y: 0 }] }];

  return (
    <div className={styles.container}>
      <Field label="Chart title (optional)">
        <Input
          value={(data.title as string) ?? ''}
          onChange={(_e, d) => { onChange({ ...data, title: d.value }); }}
          placeholder="Line chart title"
        />
      </Field>
      <div className={styles.row}>
        <div className={styles.field}>
          <Field label="X-axis title">
            <Input
              value={(data.xAxisTitle as string) ?? ''}
              onChange={(_e, d) => { onChange({ ...data, xAxisTitle: d.value }); }}
              placeholder="X axis"
            />
          </Field>
        </div>
        <div className={styles.field}>
          <Field label="Y-axis title">
            <Input
              value={(data.yAxisTitle as string) ?? ''}
              onChange={(_e, d) => { onChange({ ...data, yAxisTitle: d.value }); }}
              placeholder="Y axis"
            />
          </Field>
        </div>
      </div>
      <MultiSeriesEditor
        series={series}
        onChange={(s) => { onChange({ ...data, series: s }); }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// GaugeEditor
// ---------------------------------------------------------------------------

function GaugeEditor({ data, onChange, styles }: EditorProps) {
  const segments = (data.segments as Array<{ legend: string; size: number; color?: string }>) ?? [];

  const updateSegment = useCallback((index: number, field: string, val: string | number) => {
    const next = segments.map((s, i) => (i === index ? { ...s, [field]: val } : s));
    onChange({ ...data, segments: next });
  }, [data, segments, onChange]);

  const addSegment = useCallback(() => {
    onChange({ ...data, segments: [...segments, { legend: '', size: 25 }] });
  }, [data, segments, onChange]);

  const removeSegment = useCallback((index: number) => {
    onChange({ ...data, segments: segments.filter((_, i) => i !== index) });
  }, [data, segments, onChange]);

  return (
    <div className={styles.container}>
      <div className={styles.row}>
        <div className={styles.field}>
          <Field label="Value">
            <SpinButton
              value={Number(data.value) || 0}
              min={Number(data.min) || 0}
              max={Number(data.max) || 100}
              onChange={(_e, d) => { onChange({ ...data, value: d.value ?? 0 }); }}
            />
          </Field>
        </div>
        <div className={styles.field}>
          <Field label="Min">
            <SpinButton
              value={Number(data.min) || 0}
              onChange={(_e, d) => { onChange({ ...data, min: d.value ?? 0 }); }}
            />
          </Field>
        </div>
        <div className={styles.field}>
          <Field label="Max">
            <SpinButton
              value={Number(data.max) || 100}
              min={1}
              onChange={(_e, d) => { onChange({ ...data, max: d.value ?? 100 }); }}
            />
          </Field>
        </div>
      </div>
      <div className={styles.row}>
        <div className={styles.field}>
          <Field label="Format">
            <Select
              value={(data.valueFormat as string) ?? 'Percentage'}
              onChange={(_e, d) => { onChange({ ...data, valueFormat: d.value }); }}
            >
              <option value="Percentage">Percentage</option>
              <option value="Fraction">Fraction</option>
            </Select>
          </Field>
        </div>
        <div className={styles.field}>
          <Field label="Sub-label (optional)">
            <Input
              value={(data.subLabel as string) ?? ''}
              onChange={(_e, d) => { onChange({ ...data, subLabel: d.value }); }}
              placeholder="e.g. Complete"
            />
          </Field>
        </div>
      </div>

      <Text size={200} weight="semibold">Segments (optional)</Text>
      {segments.map((seg, i) => (
        <div key={i} className={styles.row}>
          <div className={styles.field}>
            <Input
              value={seg.legend}
              onChange={(_e, d) => { updateSegment(i, 'legend', d.value); }}
              placeholder="Segment label"
            />
          </div>
          <div className={styles.field}>
            <SpinButton
              value={seg.size}
              min={1}
              max={100}
              onChange={(_e, d) => { updateSegment(i, 'size', d.value ?? 25); }}
              size="small"
            />
          </div>
          <Button
            className={styles.removeBtn}
            appearance="subtle"
            size="small"
            icon={<Delete16Regular />}
            onClick={() => { removeSegment(i); }}
            aria-label={`Remove segment ${i + 1}`}
          />
        </div>
      ))}
      <Button
        appearance="subtle"
        size="small"
        icon={<Add16Regular />}
        onClick={addSegment}
        style={{ alignSelf: 'flex-start' }}
      >
        Add segment
      </Button>
    </div>
  );
}
