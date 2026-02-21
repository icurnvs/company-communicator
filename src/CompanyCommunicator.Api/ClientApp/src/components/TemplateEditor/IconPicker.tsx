// components/TemplateEditor/IconPicker.tsx
import { useState, useMemo } from 'react';
import type { ComponentType } from 'react';
import {
  makeStyles,
  mergeClasses,
  tokens,
  Button,
  Input,
  Popover,
  PopoverSurface,
  PopoverTrigger,
} from '@fluentui/react-components';
import type { FluentIconsProps } from '@fluentui/react-icons';
import {
  DocumentOnePage20Regular,
  MegaphoneRegular,
  CalendarRegular,
  AlertUrgentRegular,
  LinkRegular,
  ClipboardTaskRegular,
  PeopleRegular,
  ShieldCheckmarkRegular,
  StarRegular,
  HeartRegular,
  RocketRegular,
  LightbulbRegular,
  BookRegular,
  BriefcaseRegular,
  GlobeRegular,
  ChatRegular,
  MailRegular,
  FlagRegular,
  CheckmarkCircleRegular,
  InfoRegular,
  TargetRegular,
  SparkleRegular,
  HandshakeRegular,
  BuildingRegular,
} from '@fluentui/react-icons';

// ---------------------------------------------------------------------------
// Icon registry
// ---------------------------------------------------------------------------

export const TEMPLATE_ICON_MAP: Record<string, ComponentType<FluentIconsProps>> = {
  DocumentOnePage: DocumentOnePage20Regular,
  Megaphone: MegaphoneRegular,
  Calendar: CalendarRegular,
  AlertUrgent: AlertUrgentRegular,
  Link: LinkRegular,
  ClipboardTask: ClipboardTaskRegular,
  People: PeopleRegular,
  ShieldCheckmark: ShieldCheckmarkRegular,
  Star: StarRegular,
  Heart: HeartRegular,
  Rocket: RocketRegular,
  Lightbulb: LightbulbRegular,
  Book: BookRegular,
  Briefcase: BriefcaseRegular,
  Globe: GlobeRegular,
  Chat: ChatRegular,
  Mail: MailRegular,
  Flag: FlagRegular,
  CheckmarkCircle: CheckmarkCircleRegular,
  Info: InfoRegular,
  Target: TargetRegular,
  Sparkle: SparkleRegular,
  Handshake: HandshakeRegular,
  Building: BuildingRegular,
};

export function resolveTemplateIcon(iconName: string): ComponentType<FluentIconsProps> {
  return TEMPLATE_ICON_MAP[iconName] ?? DocumentOnePage20Regular;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const useStyles = makeStyles({
  trigger: {
    minWidth: '40px',
    height: '32px',
    paddingTop: '4px',
    paddingBottom: '4px',
    paddingLeft: '8px',
    paddingRight: '8px',
  },

  popover: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
    padding: tokens.spacingHorizontalM,
    width: '260px',
  },

  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(6, 1fr)',
    gap: '4px',
    maxHeight: '200px',
    overflowY: 'auto',
  },

  iconCell: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '36px',
    height: '36px',
    borderRadius: tokens.borderRadiusMedium,
    cursor: 'pointer',
    border: 'none',
    backgroundColor: 'transparent',
    color: tokens.colorNeutralForeground1,
    fontSize: '20px',
    ':hover': {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },

  iconCellSelected: {
    backgroundColor: tokens.colorBrandBackground,
    color: tokens.colorNeutralForegroundOnBrand,
    ':hover': {
      backgroundColor: tokens.colorBrandBackgroundHover,
    },
  },
});

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface IconPickerProps {
  selectedIcon: string;
  onSelect: (iconName: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function IconPicker({ selectedIcon, onSelect }: IconPickerProps) {
  const styles = useStyles();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const iconEntries = useMemo(() => Object.entries(TEMPLATE_ICON_MAP), []);

  const filtered = useMemo(() => {
    if (!search.trim()) return iconEntries;
    const q = search.toLowerCase();
    return iconEntries.filter(([name]) => name.toLowerCase().includes(q));
  }, [iconEntries, search]);

  const SelectedIcon = resolveTemplateIcon(selectedIcon);

  return (
    <Popover open={open} onOpenChange={(_e, data) => { setOpen(data.open); }}>
      <PopoverTrigger>
        <Button
          appearance="outline"
          className={styles.trigger}
          icon={<SelectedIcon />}
          aria-label={`Selected icon: ${selectedIcon}`}
        />
      </PopoverTrigger>
      <PopoverSurface>
        <div className={styles.popover}>
          <Input
            placeholder="Search icons..."
            value={search}
            onChange={(_e, data) => { setSearch(data.value); }}
            size="small"
          />
          <div className={styles.grid}>
            {filtered.map(([name, Icon]) => (
              <button
                key={name}
                type="button"
                className={mergeClasses(styles.iconCell, name === selectedIcon && styles.iconCellSelected)}
                onClick={() => {
                  onSelect(name);
                  setOpen(false);
                }}
                aria-label={name}
                title={name}
              >
                <Icon />
              </button>
            ))}
          </div>
        </div>
      </PopoverSurface>
    </Popover>
  );
}
