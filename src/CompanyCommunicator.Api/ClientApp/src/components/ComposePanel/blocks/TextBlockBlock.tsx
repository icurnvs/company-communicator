import {
  Textarea,
  Field,
  makeStyles,
  tokens,
  Dropdown,
  Option,
} from '@fluentui/react-components';
import type { AdvancedBlock } from '@/types';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
  },
  options: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
  },
});

export interface TextBlockBlockProps {
  block: AdvancedBlock;
  onChange: (data: Record<string, unknown>) => void;
}

export function TextBlockBlock({ block, onChange }: TextBlockBlockProps) {
  const styles = useStyles();
  const text = (block.data['text'] as string) ?? '';
  const size = (block.data['size'] as string) ?? 'Default';
  const weight = (block.data['weight'] as string) ?? 'Default';

  return (
    <div className={styles.root}>
      <Field>
        <Textarea
          size="small"
          value={text}
          onChange={(_e, data) => {
            onChange({ ...block.data, text: data.value });
          }}
          placeholder="Additional text..."
          rows={3}
          resize="vertical"
        />
      </Field>
      <div className={styles.options}>
        <Field label="Size">
          <Dropdown
            size="small"
            value={size}
            selectedOptions={[size]}
            onOptionSelect={(_e, data) => {
              onChange({ ...block.data, size: data.optionValue });
            }}
          >
            <Option value="Small">Small</Option>
            <Option value="Default">Default</Option>
            <Option value="Medium">Medium</Option>
            <Option value="Large">Large</Option>
          </Dropdown>
        </Field>
        <Field label="Weight">
          <Dropdown
            size="small"
            value={weight}
            selectedOptions={[weight]}
            onOptionSelect={(_e, data) => {
              onChange({ ...block.data, weight: data.optionValue });
            }}
          >
            <Option value="Default">Default</Option>
            <Option value="Bolder">Bold</Option>
            <Option value="Lighter">Light</Option>
          </Dropdown>
        </Field>
      </div>
    </div>
  );
}
