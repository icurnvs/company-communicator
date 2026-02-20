import { useCallback } from 'react';
import {
  makeStyles,
  tokens,
  Input,
  Button,
  Text,
} from '@fluentui/react-components';
import { Add16Regular, Delete16Regular } from '@fluentui/react-icons';
import type { AdvancedBlock } from '@/types';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
    overflow: 'auto',
  },
  grid: {
    display: 'grid',
    gap: '2px',
  },
  headerCell: {
    fontWeight: tokens.fontWeightSemibold,
  },
  actions: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
  },
});

export interface TableBlockProps {
  block: AdvancedBlock;
  onChange: (data: Record<string, unknown>) => void;
}

export function TableBlock({ block, onChange }: TableBlockProps) {
  const styles = useStyles();
  const headers = (block.data['headers'] as string[]) ?? ['Header 1', 'Header 2'];
  const rows = (block.data['rows'] as string[][]) ?? [['', '']];
  const colCount = headers.length;

  const updateHeader = useCallback(
    (index: number, value: string) => {
      const updated = [...headers];
      updated[index] = value;
      onChange({ ...block.data, headers: updated });
    },
    [headers, block.data, onChange],
  );

  const updateCell = useCallback(
    (rowIndex: number, colIndex: number, value: string) => {
      const updated = rows.map((r) => [...r]);
      updated[rowIndex][colIndex] = value;
      onChange({ ...block.data, rows: updated });
    },
    [rows, block.data, onChange],
  );

  const addRow = useCallback(() => {
    onChange({ ...block.data, rows: [...rows, Array(colCount).fill('')] });
  }, [rows, colCount, block.data, onChange]);

  const removeRow = useCallback(
    (index: number) => {
      if (rows.length <= 1) return;
      onChange({ ...block.data, rows: rows.filter((_, i) => i !== index) });
    },
    [rows, block.data, onChange],
  );

  const addColumn = useCallback(() => {
    if (colCount >= 4) return;
    const newHeaders = [...headers, `Header ${colCount + 1}`];
    const newRows = rows.map((r) => [...r, '']);
    onChange({ ...block.data, headers: newHeaders, rows: newRows });
  }, [headers, rows, colCount, block.data, onChange]);

  const removeColumn = useCallback(
    (index: number) => {
      if (colCount <= 2) return;
      const newHeaders = headers.filter((_, i) => i !== index);
      const newRows = rows.map((r) => r.filter((_, i) => i !== index));
      onChange({ ...block.data, headers: newHeaders, rows: newRows });
    },
    [headers, rows, colCount, block.data, onChange],
  );

  return (
    <div className={styles.root}>
      <div
        className={styles.grid}
        style={{ gridTemplateColumns: `repeat(${colCount}, 1fr) 28px` }}
      >
        {/* Header row */}
        {headers.map((h, i) => (
          <div key={`h-${i}`} className={styles.headerCell}>
            <Input
              size="small"
              value={h}
              onChange={(_e, data) => { updateHeader(i, data.value); }}
              aria-label={`Column ${i + 1} header`}
            />
          </div>
        ))}
        <div>
          {colCount > 2 && (
            <Button
              appearance="subtle"
              size="small"
              icon={<Delete16Regular />}
              onClick={() => { removeColumn(colCount - 1); }}
              aria-label="Remove last column"
            />
          )}
        </div>

        {/* Data rows */}
        {rows.map((row, ri) => (
          <>
            {row.map((cell, ci) => (
              <div key={`r${ri}-c${ci}`}>
                <Input
                  size="small"
                  value={cell}
                  onChange={(_e, data) => { updateCell(ri, ci, data.value); }}
                  aria-label={`Row ${ri + 1}, column ${ci + 1}`}
                />
              </div>
            ))}
            <div>
              {rows.length > 1 && (
                <Button
                  appearance="subtle"
                  size="small"
                  icon={<Delete16Regular />}
                  onClick={() => { removeRow(ri); }}
                  aria-label={`Remove row ${ri + 1}`}
                />
              )}
            </div>
          </>
        ))}
      </div>

      <div className={styles.actions}>
        <Button appearance="subtle" size="small" icon={<Add16Regular />} onClick={addRow}>
          Add row
        </Button>
        {colCount < 4 && (
          <Button appearance="subtle" size="small" icon={<Add16Regular />} onClick={addColumn}>
            Add column
          </Button>
        )}
        <Text size={200} style={{ color: tokens.colorNeutralForeground3, alignSelf: 'center' }}>
          {rows.length} rows x {colCount} columns
        </Text>
      </div>
    </div>
  );
}
