import { useCallback } from 'react';
import {
  makeStyles,
  tokens,
  Textarea,
  Field,
  Button,
  Text,
} from '@fluentui/react-components';
import { Add16Regular, Delete16Regular } from '@fluentui/react-icons';
import type { AdvancedBlock } from '@/types';

const useStyles = makeStyles({
  columns: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
  },
  column: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
  },
  columnHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actions: {
    display: 'flex',
    gap: tokens.spacingHorizontalXS,
    marginTop: tokens.spacingVerticalXS,
  },
});

export interface ColumnBlockProps {
  block: AdvancedBlock;
  onChange: (data: Record<string, unknown>) => void;
}

export function ColumnBlock({ block, onChange }: ColumnBlockProps) {
  const styles = useStyles();
  const columns = (block.data['columns'] as { text?: string }[]) ?? [
    { text: '' },
    { text: '' },
  ];

  const updateColumn = useCallback(
    (index: number, text: string) => {
      const updated = [...columns];
      updated[index] = { text };
      onChange({ columns: updated });
    },
    [columns, onChange],
  );

  const addColumn = useCallback(() => {
    if (columns.length >= 3) return;
    onChange({ columns: [...columns, { text: '' }] });
  }, [columns, onChange]);

  const removeColumn = useCallback(
    (index: number) => {
      if (columns.length <= 2) return;
      const updated = columns.filter((_, i) => i !== index);
      onChange({ columns: updated });
    },
    [columns, onChange],
  );

  return (
    <div>
      <div className={styles.columns}>
        {columns.map((col, i) => (
          <div key={i} className={styles.column}>
            <div className={styles.columnHeader}>
              <Text size={200} weight="semibold">Column {i + 1}</Text>
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
            <Field>
              <Textarea
                size="small"
                value={col.text ?? ''}
                onChange={(_e, data) => { updateColumn(i, data.value); }}
                placeholder={`Column ${i + 1} content...`}
                rows={2}
                resize="vertical"
              />
            </Field>
          </div>
        ))}
      </div>
      <div className={styles.actions}>
        {columns.length < 3 && (
          <Button
            appearance="subtle"
            size="small"
            icon={<Add16Regular />}
            onClick={addColumn}
          >
            Add column
          </Button>
        )}
      </div>
    </div>
  );
}
