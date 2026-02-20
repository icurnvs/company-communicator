// AddSectionPalette.tsx — Popover for inserting extended block types
import { useCallback, useState } from 'react';
import {
  makeStyles,
  tokens,
  Button,
  Popover,
  PopoverSurface,
  PopoverTrigger,
  Text,
  Card,
  CardHeader,
} from '@fluentui/react-components';
import { Add16Regular } from '@fluentui/react-icons';
import type { ExtendedSlotType } from '@/types';

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const useStyles = makeStyles({
  palette: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
    padding: tokens.spacingVerticalM,
    minWidth: '320px',
    maxWidth: '380px',
  },
  categoryLabel: {
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: tokens.colorNeutralForeground3,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: tokens.spacingVerticalXS,
  },
  blockCard: {
    cursor: 'pointer',
    padding: tokens.spacingVerticalS + ' ' + tokens.spacingHorizontalS,
    ':hover': {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },
  blockName: {
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
  },
  blockDesc: {
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorNeutralForeground3,
  },
});

// ---------------------------------------------------------------------------
// Block definitions
// ---------------------------------------------------------------------------

interface BlockDef {
  type: ExtendedSlotType;
  name: string;
  description: string;
  icon: string;
  category: 'content' | 'layout' | 'media';
  defaultData: Record<string, unknown>;
}

const BLOCK_DEFS: BlockDef[] = [
  { type: 'statsRow', name: 'Stats Row', description: 'Number + label pairs', icon: '\u{1F4CA}', category: 'content', defaultData: { stats: [{ value: '', label: '' }] } },
  { type: 'quoteCallout', name: 'Quote / Callout', description: 'Highlighted text', icon: '\u{1F4AC}', category: 'content', defaultData: { text: '', style: 'default' } },
  { type: 'expandableSection', name: 'Expandable', description: 'Collapsible content', icon: '\u{1F53D}', category: 'content', defaultData: { title: '', body: '' } },
  { type: 'iconTextRow', name: 'Icon + Text', description: 'Icon paired with text', icon: '\u{1F524}', category: 'content', defaultData: { iconName: '', text: '' } },
  { type: 'columns', name: 'Columns', description: '2-3 side-by-side', icon: '\u{25A5}', category: 'layout', defaultData: { columns: [{ content: '' }, { content: '' }] } },
  { type: 'table', name: 'Table', description: 'Data grid with headers', icon: '\u{25A6}', category: 'layout', defaultData: { headers: ['', ''], rows: [['', '']] } },
  { type: 'imageGallery', name: 'Image Gallery', description: 'Multiple images', icon: '\u{1F5BC}', category: 'media', defaultData: { images: [{ url: '', altText: '' }], imageSize: 'medium' } },
];

const CATEGORIES = [
  { key: 'content' as const, label: 'Content' },
  { key: 'layout' as const, label: 'Layout' },
  { key: 'media' as const, label: 'Media' },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface AddSectionPaletteProps {
  onAdd: (type: ExtendedSlotType, defaultData: Record<string, unknown>) => void;
}

// ---------------------------------------------------------------------------
// AddSectionPalette
// ---------------------------------------------------------------------------

export function AddSectionPalette({ onAdd }: AddSectionPaletteProps) {
  const styles = useStyles();
  const [open, setOpen] = useState(false);

  const handleSelect = useCallback(
    (block: BlockDef) => {
      onAdd(block.type, { ...block.defaultData });
      setOpen(false);
    },
    [onAdd],
  );

  return (
    <Popover
      open={open}
      onOpenChange={(_e, data) => { setOpen(data.open); }}
      positioning="above-start"
    >
      <PopoverTrigger>
        <Button
          appearance="subtle"
          icon={<Add16Regular />}
          size="small"
        >
          Add Section
        </Button>
      </PopoverTrigger>
      <PopoverSurface>
        <div className={styles.palette}>
          {CATEGORIES.map((cat) => {
            const blocks = BLOCK_DEFS.filter((b) => b.category === cat.key);
            if (blocks.length === 0) return null;
            return (
              <div key={cat.key}>
                <Text className={styles.categoryLabel}>{cat.label}</Text>
                <div className={styles.grid}>
                  {blocks.map((block) => (
                    <Card
                      key={block.type}
                      className={styles.blockCard}
                      size="small"
                      onClick={() => { handleSelect(block); }}
                      role="button"
                      aria-label={`Add ${block.name} section`}
                    >
                      <CardHeader
                        image={<span>{block.icon}</span>}
                        header={<Text className={styles.blockName}>{block.name}</Text>}
                        description={<Text className={styles.blockDesc}>{block.description}</Text>}
                      />
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </PopoverSurface>
    </Popover>
  );
}
