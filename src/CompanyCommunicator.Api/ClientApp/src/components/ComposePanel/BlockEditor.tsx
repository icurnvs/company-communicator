import { useCallback, useRef, useState } from 'react';
import { useFieldArray } from 'react-hook-form';
import type { UseFormReturn } from 'react-hook-form';
import {
  makeStyles,
  mergeClasses,
  tokens,
  Button,
  Menu,
  MenuTrigger,
  MenuPopover,
  MenuList,
  MenuItem,
  Text,
  Caption1,
  Caption1Strong,
} from '@fluentui/react-components';
import {
  Add16Regular,
  Delete16Regular,
  ReOrderDotsVertical16Regular,
  TextT16Regular,
  Image16Regular,
  Table16Regular,
  ColumnTripleRegular,
  Subtract16Regular,
  CursorClickRegular,
} from '@fluentui/react-icons';
import type { ComposeFormValues } from '@/lib/validators';
import type { AdvancedBlockType } from '@/types';
import {
  ColumnBlock,
  ImageSetBlock,
  TextBlockBlock,
  TableBlock,
  ActionButtonBlock,
  DividerBlock,
} from './blocks';

const BLOCK_TYPE_META: Record<AdvancedBlockType, { label: string; icon: React.ReactNode; defaultData: Record<string, unknown> }> = {
  ColumnLayout: {
    label: 'Column Layout',
    icon: <ColumnTripleRegular />,
    defaultData: { columns: [{ text: '' }, { text: '' }] },
  },
  ImageSet: {
    label: 'Image Set',
    icon: <Image16Regular />,
    defaultData: { images: [''] },
  },
  TextBlock: {
    label: 'Text Block',
    icon: <TextT16Regular />,
    defaultData: { text: '', size: 'Default', weight: 'Default' },
  },
  Table: {
    label: 'Table',
    icon: <Table16Regular />,
    defaultData: { headers: ['Header 1', 'Header 2'], rows: [['', '']] },
  },
  ActionButton: {
    label: 'Action Button',
    icon: <CursorClickRegular />,
    defaultData: { title: '', url: '' },
  },
  Divider: {
    label: 'Divider',
    icon: <Subtract16Regular />,
    defaultData: {},
  },
};

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
  },

  blockCard: {
    display: 'flex',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground2,
    overflow: 'hidden',
    transition: 'box-shadow 200ms ease',
  },

  blockCardDragging: {
    boxShadow: tokens.shadow8,
    opacity: 0.6,
  },

  blockCardDragOver: {
    border: `1px dashed ${tokens.colorBrandStroke1}`,
  },

  dragHandle: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '28px',
    flexShrink: 0,
    cursor: 'grab',
    backgroundColor: tokens.colorNeutralBackground3,
    color: tokens.colorNeutralForeground3,
    ':hover': {
      backgroundColor: tokens.colorNeutralBackground4,
    },
    ':active': {
      cursor: 'grabbing',
    },
  },

  blockContent: {
    flex: 1,
    padding: tokens.spacingHorizontalM,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
    minWidth: 0,
  },

  blockHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacingHorizontalS,
  },

  blockLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    color: tokens.colorNeutralForeground2,
  },

  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: tokens.spacingVerticalS,
    padding: tokens.spacingVerticalL,
    color: tokens.colorNeutralForeground3,
    border: `1px dashed ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
  },
});

export interface BlockEditorProps {
  form: UseFormReturn<ComposeFormValues>;
}

export function BlockEditor({ form }: BlockEditorProps) {
  const styles = useStyles();

  const { fields, append, remove, move } = useFieldArray({
    control: form.control,
    name: 'advancedBlocks',
  });

  // Drag state
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragCounterRef = useRef(0);

  const handleAddBlock = useCallback(
    (type: AdvancedBlockType) => {
      const meta = BLOCK_TYPE_META[type];
      append({
        id: crypto.randomUUID(),
        type,
        data: { ...meta.defaultData },
      });
    },
    [append],
  );

  const handleBlockDataChange = useCallback(
    (index: number, data: Record<string, unknown>) => {
      form.setValue(`advancedBlocks.${index}.data`, data, { shouldDirty: true });
    },
    [form],
  );

  // Drag handlers
  const handleDragStart = useCallback(
    (e: React.DragEvent, index: number) => {
      setDragIndex(index);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(index));
    },
    [],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, index: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setDragOverIndex(index);
    },
    [],
  );

  const handleDragEnter = useCallback(
    (e: React.DragEvent, index: number) => {
      e.preventDefault();
      dragCounterRef.current++;
      setDragOverIndex(index);
    },
    [],
  );

  const handleDragLeave = useCallback(() => {
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setDragOverIndex(null);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, dropIndex: number) => {
      e.preventDefault();
      dragCounterRef.current = 0;
      if (dragIndex !== null && dragIndex !== dropIndex) {
        move(dragIndex, dropIndex);
      }
      setDragIndex(null);
      setDragOverIndex(null);
    },
    [dragIndex, move],
  );

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
    setDragOverIndex(null);
    dragCounterRef.current = 0;
  }, []);

  const renderBlockEditor = (index: number) => {
    const block = form.getValues(`advancedBlocks.${index}`);
    if (!block) return null;

    const onChange = (data: Record<string, unknown>) => {
      handleBlockDataChange(index, data);
    };

    switch (block.type) {
      case 'ColumnLayout':
        return <ColumnBlock block={block} onChange={onChange} />;
      case 'ImageSet':
        return <ImageSetBlock block={block} onChange={onChange} />;
      case 'TextBlock':
        return <TextBlockBlock block={block} onChange={onChange} />;
      case 'Table':
        return <TableBlock block={block} onChange={onChange} />;
      case 'ActionButton':
        return <ActionButtonBlock block={block} onChange={onChange} />;
      case 'Divider':
        return <DividerBlock />;
      default:
        return null;
    }
  };

  return (
    <div className={styles.root}>
      {fields.length === 0 ? (
        <div className={styles.emptyState}>
          <Text size={200}>No advanced blocks added yet</Text>
          <Caption1>Add blocks below to create complex card layouts</Caption1>
        </div>
      ) : (
        fields.map((field, index) => {
          const block = form.getValues(`advancedBlocks.${index}`);
          const meta = block ? BLOCK_TYPE_META[block.type] : null;
          const isDragging = dragIndex === index;
          const isDragOver = dragOverIndex === index && dragIndex !== index;

          return (
            <div
              key={field.id}
              className={mergeClasses(
                styles.blockCard,
                isDragging ? styles.blockCardDragging : undefined,
                isDragOver ? styles.blockCardDragOver : undefined,
              )}
              onDragOver={(e) => { handleDragOver(e, index); }}
              onDragEnter={(e) => { handleDragEnter(e, index); }}
              onDragLeave={handleDragLeave}
              onDrop={(e) => { handleDrop(e, index); }}
            >
              {/* Drag handle */}
              <div
                className={styles.dragHandle}
                draggable
                onDragStart={(e) => { handleDragStart(e, index); }}
                onDragEnd={handleDragEnd}
                aria-label="Drag to reorder"
              >
                <ReOrderDotsVertical16Regular />
              </div>

              {/* Block content */}
              <div className={styles.blockContent}>
                <div className={styles.blockHeader}>
                  <div className={styles.blockLabel}>
                    {meta?.icon}
                    <Caption1Strong>
                      {meta?.label ?? block?.type}
                    </Caption1Strong>
                  </div>
                  <Button
                    appearance="subtle"
                    size="small"
                    icon={<Delete16Regular />}
                    onClick={() => { remove(index); }}
                    aria-label={`Remove ${meta?.label ?? 'block'}`}
                  />
                </div>
                {renderBlockEditor(index)}
              </div>
            </div>
          );
        })
      )}

      {/* Add block menu */}
      <Menu>
        <MenuTrigger>
          <Button
            appearance="subtle"
            size="small"
            icon={<Add16Regular />}
            style={{ alignSelf: 'flex-start' }}
          >
            Add Block
          </Button>
        </MenuTrigger>
        <MenuPopover>
          <MenuList>
            {(Object.entries(BLOCK_TYPE_META) as [AdvancedBlockType, typeof BLOCK_TYPE_META[AdvancedBlockType]][]).map(
              ([type, meta]) => (
                <MenuItem
                  key={type}
                  icon={meta.icon as React.ReactElement}
                  onClick={() => { handleAddBlock(type); }}
                >
                  {meta.label}
                </MenuItem>
              ),
            )}
          </MenuList>
        </MenuPopover>
      </Menu>
    </div>
  );
}
