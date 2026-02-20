// ChartDataEditor.tsx — Shared data table for chart block editors
import { useCallback } from 'react';
import {
  makeStyles,
  tokens,
  Field,
  Input,
  Button,
  Text,
} from '@fluentui/react-components';
import { Add16Regular, Delete16Regular } from '@fluentui/react-icons';
import type { ChartDataPoint, ChartSeriesData } from '@/types';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
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
  valueField: {
    flex: 0,
    minWidth: '80px',
    maxWidth: '100px',
  },
  removeBtn: {
    flexShrink: 0,
    marginBottom: '2px',
  },
  seriesBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
    padding: tokens.spacingHorizontalS,
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
  },
  seriesHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacingHorizontalS,
  },
});

// ---------------------------------------------------------------------------
// Single-series editor
// ---------------------------------------------------------------------------

export interface SingleSeriesEditorProps {
  data: ChartDataPoint[];
  labelPlaceholder?: string;
  onChange: (data: ChartDataPoint[]) => void;
}

export function SingleSeriesEditor({
  data,
  labelPlaceholder = 'Label',
  onChange,
}: SingleSeriesEditorProps) {
  const styles = useStyles();

  const update = useCallback((index: number, field: 'label' | 'value' | 'color', val: string | number) => {
    const next = data.map((d, i) => (i === index ? { ...d, [field]: val } : d));
    onChange(next);
  }, [data, onChange]);

  const add = useCallback(() => {
    onChange([...data, { label: '', value: 0 }]);
  }, [data, onChange]);

  const remove = useCallback((index: number) => {
    onChange(data.filter((_, i) => i !== index));
  }, [data, onChange]);

  return (
    <div className={styles.container}>
      {data.map((point, i) => (
        <div key={i} className={styles.row}>
          <div className={styles.field}>
            {i === 0 && <Text size={200} weight="semibold">Label</Text>}
            <Input
              value={point.label}
              onChange={(_e, d) => { update(i, 'label', d.value); }}
              placeholder={labelPlaceholder}
            />
          </div>
          <div className={styles.valueField}>
            {i === 0 && <Text size={200} weight="semibold">Value</Text>}
            <Input
              type="number"
              value={String(point.value)}
              onChange={(_e, d) => { update(i, 'value', Number(d.value) || 0); }}
              placeholder="0"
            />
          </div>
          {data.length > 1 && (
            <Button
              className={styles.removeBtn}
              appearance="subtle"
              size="small"
              icon={<Delete16Regular />}
              onClick={() => { remove(i); }}
              aria-label={`Remove data point ${i + 1}`}
            />
          )}
        </div>
      ))}
      <Button
        appearance="subtle"
        size="small"
        icon={<Add16Regular />}
        onClick={add}
        style={{ alignSelf: 'flex-start' }}
      >
        Add data point
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Multi-series editor
// ---------------------------------------------------------------------------

export interface MultiSeriesEditorProps {
  series: ChartSeriesData[];
  onChange: (series: ChartSeriesData[]) => void;
}

// Adapter: convert ChartSeriesData.values to/from ChartDataPoint[] for SingleSeriesEditor
function toPoints(values: { x: string; y: number }[]): ChartDataPoint[] {
  return values.map((v) => ({ label: v.x, value: v.y }));
}

function fromPoints(points: ChartDataPoint[]): { x: string; y: number }[] {
  return points.map((p) => ({ x: p.label, y: p.value }));
}

export function MultiSeriesEditor({ series, onChange }: MultiSeriesEditorProps) {
  const styles = useStyles();

  const updateSeriesName = useCallback((index: number, legend: string) => {
    const next = series.map((s, i) => (i === index ? { ...s, legend } : s));
    onChange(next);
  }, [series, onChange]);

  const updateSeriesValues = useCallback((index: number, values: { x: string; y: number }[]) => {
    const next = series.map((s, i) => (i === index ? { ...s, values } : s));
    onChange(next);
  }, [series, onChange]);

  const addSeries = useCallback(() => {
    onChange([...series, { legend: '', values: [{ x: '', y: 0 }] }]);
  }, [series, onChange]);

  const removeSeries = useCallback((index: number) => {
    onChange(series.filter((_, i) => i !== index));
  }, [series, onChange]);

  return (
    <div className={styles.container}>
      {series.map((s, i) => (
        <div key={i} className={styles.seriesBlock}>
          <div className={styles.seriesHeader}>
            <Field label={`Series ${i + 1}`} style={{ flex: 1 }}>
              <Input
                value={s.legend}
                onChange={(_e, d) => { updateSeriesName(i, d.value); }}
                placeholder="Series name"
              />
            </Field>
            {series.length > 1 && (
              <Button
                appearance="subtle"
                size="small"
                icon={<Delete16Regular />}
                onClick={() => { removeSeries(i); }}
                aria-label={`Remove series ${i + 1}`}
              />
            )}
          </div>
          <SingleSeriesEditor
            data={toPoints(s.values)}
            labelPlaceholder="X value"
            onChange={(points) => { updateSeriesValues(i, fromPoints(points)); }}
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
