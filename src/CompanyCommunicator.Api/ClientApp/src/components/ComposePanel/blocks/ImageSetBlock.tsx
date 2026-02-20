import { useCallback } from 'react';
import {
  makeStyles,
  tokens,
  Input,
  Field,
  Button,
} from '@fluentui/react-components';
import { Add16Regular, Delete16Regular } from '@fluentui/react-icons';
import type { AdvancedBlock } from '@/types';

const useStyles = makeStyles({
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
  },
  input: {
    flex: 1,
  },
});

export interface ImageSetBlockProps {
  block: AdvancedBlock;
  onChange: (data: Record<string, unknown>) => void;
}

export function ImageSetBlock({ block, onChange }: ImageSetBlockProps) {
  const styles = useStyles();
  const images = (block.data['images'] as string[]) ?? [''];

  const updateImage = useCallback(
    (index: number, url: string) => {
      const updated = [...images];
      updated[index] = url;
      onChange({ images: updated });
    },
    [images, onChange],
  );

  const addImage = useCallback(() => {
    onChange({ images: [...images, ''] });
  }, [images, onChange]);

  const removeImage = useCallback(
    (index: number) => {
      const updated = images.filter((_, i) => i !== index);
      onChange({ images: updated.length > 0 ? updated : [''] });
    },
    [images, onChange],
  );

  return (
    <div className={styles.list}>
      {images.map((url, i) => (
        <div key={i} className={styles.row}>
          <Field className={styles.input}>
            <Input
              size="small"
              value={url}
              onChange={(_e, data) => { updateImage(i, data.value); }}
              placeholder="https://... image URL"
              type="url"
            />
          </Field>
          <Button
            appearance="subtle"
            size="small"
            icon={<Delete16Regular />}
            onClick={() => { removeImage(i); }}
            aria-label={`Remove image ${i + 1}`}
          />
        </div>
      ))}
      <Button
        appearance="subtle"
        size="small"
        icon={<Add16Regular />}
        onClick={addImage}
        style={{ alignSelf: 'flex-start' }}
      >
        Add image
      </Button>
    </div>
  );
}
