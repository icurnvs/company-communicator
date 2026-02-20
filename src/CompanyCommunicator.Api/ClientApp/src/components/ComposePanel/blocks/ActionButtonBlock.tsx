import {
  makeStyles,
  tokens,
  Input,
  Field,
} from '@fluentui/react-components';
import type { AdvancedBlock } from '@/types';

const useStyles = makeStyles({
  row: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
  },
  field: {
    flex: 1,
    minWidth: 0,
  },
});

export interface ActionButtonBlockProps {
  block: AdvancedBlock;
  onChange: (data: Record<string, unknown>) => void;
}

export function ActionButtonBlock({ block, onChange }: ActionButtonBlockProps) {
  const styles = useStyles();
  const title = (block.data['title'] as string) ?? '';
  const url = (block.data['url'] as string) ?? '';

  return (
    <div className={styles.row}>
      <Field label="Button Label" className={styles.field}>
        <Input
          size="small"
          value={title}
          onChange={(_e, data) => {
            onChange({ ...block.data, title: data.value });
          }}
          placeholder="Click Here"
        />
      </Field>
      <Field label="URL" className={styles.field}>
        <Input
          size="small"
          value={url}
          onChange={(_e, data) => {
            onChange({ ...block.data, url: data.value });
          }}
          placeholder="https://..."
          type="url"
        />
      </Field>
    </div>
  );
}
