import { makeStyles, mergeClasses, tokens, Button, CounterBadge, Text } from '@fluentui/react-components';
import {
  Add24Regular,
  Send24Regular,
  Send24Filled,
  Edit24Regular,
  Edit24Filled,
  Clock24Regular,
  Clock24Filled,
} from '@fluentui/react-icons';
import { useTranslation } from 'react-i18next';
import { useNotifications } from '@/api/notifications';
import type { NotificationTab } from '@/types';

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    width: '200px',
    backgroundColor: tokens.colorNeutralBackground3,
    borderRight: `1px solid ${tokens.colorNeutralStroke2}`,
    overflow: 'hidden',
    flexShrink: 0,
  },
  composeWrapper: {
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalM}`,
    flexShrink: 0,
  },
  composeButton: {
    width: '100%',
    justifyContent: 'flex-start',
  },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    gap: tokens.spacingVerticalXS,
    padding: `0 ${tokens.spacingHorizontalS}`,
    overflowY: 'auto',
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    padding: `8px 12px`,
    cursor: 'pointer',
    borderRadius: tokens.borderRadiusMedium,
    border: 'none',
    backgroundColor: 'transparent',
    textAlign: 'left',
    width: '100%',
    color: tokens.colorNeutralForeground1,
    ':hover': {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },
  navItemActive: {
    backgroundColor: tokens.colorNeutralBackground1Selected,
    color: tokens.colorBrandForeground1,
    ':hover': {
      backgroundColor: tokens.colorNeutralBackground1Selected,
    },
  },
  navItemLabel: {
    flex: 1,
    userSelect: 'none',
  },
  navItemLabelActive: {
    color: tokens.colorBrandForeground1,
    fontWeight: tokens.fontWeightSemibold,
  },
});

// ---------------------------------------------------------------------------
// Lightweight count hook — fetches page 1 with pageSize 1 just for totalCount
// ---------------------------------------------------------------------------

function useTabCount(status: NotificationTab): number {
  const { data } = useNotifications({ status, page: 1, pageSize: 1 });
  return data?.totalCount ?? 0;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SidebarProps {
  activeTab: NotificationTab;
  onTabChange: (tab: NotificationTab) => void;
  onComposeClick: () => void;
}

// ---------------------------------------------------------------------------
// Nav item definition
// ---------------------------------------------------------------------------

interface NavItemDef {
  tab: NotificationTab;
  labelKey: string;
  IconRegular: React.ComponentType<{ className?: string }>;
  IconFilled: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItemDef[] = [
  {
    tab: 'Sent',
    labelKey: 'sidebar.sent',
    IconRegular: Send24Regular,
    IconFilled: Send24Filled,
  },
  {
    tab: 'Draft',
    labelKey: 'sidebar.drafts',
    IconRegular: Edit24Regular,
    IconFilled: Edit24Filled,
  },
  {
    tab: 'Scheduled',
    labelKey: 'sidebar.scheduled',
    IconRegular: Clock24Regular,
    IconFilled: Clock24Filled,
  },
];

// ---------------------------------------------------------------------------
// Individual nav item (own hook call per item)
// ---------------------------------------------------------------------------

function NavItem({
  item,
  isActive,
  onSelect,
}: {
  item: NavItemDef;
  isActive: boolean;
  onSelect: () => void;
}) {
  const styles = useStyles();
  const { t } = useTranslation();
  const count = useTabCount(item.tab);

  const Icon = isActive ? item.IconFilled : item.IconRegular;
  const label = t(item.labelKey);

  return (
    <button
      type="button"
      className={mergeClasses(styles.navItem, isActive ? styles.navItemActive : undefined)}
      onClick={onSelect}
      aria-current={isActive ? 'page' : undefined}
      aria-label={`${label}${count > 0 ? `, ${count} items` : ''}`}
    >
      <Icon />
      <Text
        size={300}
        className={mergeClasses(styles.navItemLabel, isActive ? styles.navItemLabelActive : undefined)}
      >
        {label}
      </Text>
      {count > 0 && (
        <CounterBadge
          count={count}
          size="small"
          appearance={isActive ? 'filled' : 'ghost'}
          color={isActive ? 'brand' : 'informative'}
        />
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

export function Sidebar({ activeTab, onTabChange, onComposeClick }: SidebarProps) {
  const styles = useStyles();
  const { t } = useTranslation();

  return (
    <nav className={styles.root} aria-label={t('nav.notifications')}>
      <div className={styles.composeWrapper}>
        <Button
          appearance="primary"
          icon={<Add24Regular />}
          className={styles.composeButton}
          onClick={onComposeClick}
          aria-label={t('sidebar.compose')}
        >
          {t('sidebar.compose')}
        </Button>
      </div>

      <div className={styles.nav} role="list">
        {NAV_ITEMS.map((item) => (
          <NavItem
            key={item.tab}
            item={item}
            isActive={activeTab === item.tab}
            onSelect={() => onTabChange(item.tab)}
          />
        ))}
      </div>
    </nav>
  );
}
