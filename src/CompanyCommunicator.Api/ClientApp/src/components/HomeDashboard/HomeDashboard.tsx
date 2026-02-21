import { memo, useCallback } from 'react';
import { makeStyles, tokens, Text, Button, Spinner, mergeClasses } from '@fluentui/react-components';
import {
  Send24Regular,
  Edit24Regular,
  Clock24Regular,
  ArrowRight16Regular,
} from '@fluentui/react-icons';
import { useTranslation } from 'react-i18next';
import { formatDistanceToNow } from 'date-fns';
import { useNotifications } from '@/api/notifications';
import type { NotificationTab, NotificationSummaryDto, SidebarView } from '@/types';

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'auto',
    padding: '24px',
    gap: '24px',
  },

  // Header
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: tokens.fontSizeBase500,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
  },

  // Stat cards row
  statsRow: {
    display: 'flex',
    gap: '16px',
    flexWrap: 'wrap',
  },

  statCard: {
    flex: '1 1 180px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '20px',
    borderRadius: tokens.borderRadiusLarge,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
    cursor: 'pointer',
    transitionProperty: 'box-shadow, border-color',
    transitionDuration: '0.15s',
    transitionTimingFunction: 'ease',
    ':hover': {
      boxShadow: tokens.shadow4,
      borderTopColor: tokens.colorBrandStroke1,
      borderRightColor: tokens.colorBrandStroke1,
      borderBottomColor: tokens.colorBrandStroke1,
      borderLeftColor: tokens.colorBrandStroke1,
    },
    ':focus-visible': {
      outlineWidth: '2px',
      outlineStyle: 'solid',
      outlineColor: tokens.colorBrandStroke1,
      outlineOffset: '2px',
    },
  },

  statCardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: tokens.colorNeutralForeground3,
  },
  statCardIcon: {
    fontSize: '20px',
  },
  statCardLabel: {
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorNeutralForeground3,
  },
  statCardCount: {
    fontSize: '32px',
    fontWeight: tokens.fontWeightBold,
    color: tokens.colorNeutralForeground1,
    lineHeight: '1',
  },
  statCardLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorBrandForeground1,
  },

  // Recent messages section
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: tokens.fontSizeBase400,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
  },

  // Reuse card grid for recent messages
  recentGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '16px',
  },

  // Compact recent card
  recentCard: {
    display: 'flex',
    flexDirection: 'column',
    padding: '16px',
    borderRadius: tokens.borderRadiusLarge,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
    cursor: 'pointer',
    transitionProperty: 'box-shadow, border-color',
    transitionDuration: '0.15s',
    transitionTimingFunction: 'ease',
    ':hover': {
      boxShadow: tokens.shadow4,
      borderTopColor: tokens.colorBrandStroke1,
      borderRightColor: tokens.colorBrandStroke1,
      borderBottomColor: tokens.colorBrandStroke1,
      borderLeftColor: tokens.colorBrandStroke1,
    },
    ':focus-visible': {
      outlineWidth: '2px',
      outlineStyle: 'solid',
      outlineColor: tokens.colorBrandStroke1,
      outlineOffset: '2px',
    },
  },
  recentCardTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
  },
  recentCardTitle: {
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorNeutralForeground1,
  },
  recentCardDate: {
    flexShrink: 0,
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorNeutralForeground3,
  },
  recentCardSummary: {
    marginTop: '4px',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
    lineHeight: tokens.lineHeightBase200,
  },
  recentCardFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '8px',
  },
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: tokens.fontSizeBase100,
    fontWeight: tokens.fontWeightSemibold,
    lineHeight: tokens.lineHeightBase100,
  },
  statusDot: {
    width: '6px',
    height: '6px',
    borderRadius: tokens.borderRadiusCircular,
    flexShrink: 0,
  },
  deliveryCount: {
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorNeutralForeground3,
  },

  // Empty state
  emptyState: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px',
    color: tokens.colorNeutralForeground3,
    gridColumn: '1 / -1',
  },
});

// ---------------------------------------------------------------------------
// Stat card icons
// ---------------------------------------------------------------------------

const STAT_ICONS: Record<NotificationTab, React.ComponentType<{ className?: string }>> = {
  Sent: Send24Regular,
  Draft: Edit24Regular,
  Scheduled: Clock24Regular,
};

const STAT_LABEL_KEYS: Record<NotificationTab, string> = {
  Sent: 'dashboard.sentCount',
  Draft: 'dashboard.draftCount',
  Scheduled: 'dashboard.scheduledCount',
};

// ---------------------------------------------------------------------------
// useTabCount hook (same pattern as Sidebar)
// ---------------------------------------------------------------------------

function useTabCount(status: NotificationTab): number {
  const { data } = useNotifications({ status, page: 1, pageSize: 1 });
  return data?.totalCount ?? 0;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatCard({
  tab,
  onNavigate,
}: {
  tab: NotificationTab;
  onNavigate: (view: SidebarView) => void;
}) {
  const styles = useStyles();
  const { t } = useTranslation();
  const count = useTabCount(tab);
  const Icon = STAT_ICONS[tab];

  return (
    <div
      role="button"
      tabIndex={0}
      className={styles.statCard}
      onClick={() => { onNavigate(tab); }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onNavigate(tab);
        }
      }}
      aria-label={`${t(STAT_LABEL_KEYS[tab])}: ${count}`}
    >
      <div className={styles.statCardHeader}>
        <Icon className={styles.statCardIcon} />
        <span className={styles.statCardLabel}>{t(STAT_LABEL_KEYS[tab])}</span>
      </div>
      <span className={styles.statCardCount}>{count}</span>
      <span className={styles.statCardLink}>
        {t('dashboard.viewAll')} <ArrowRight16Regular />
      </span>
    </div>
  );
}

const RecentCard = memo(function RecentCard({
  notification,
  onClick,
}: {
  notification: NotificationSummaryDto;
  onClick: () => void;
}) {
  const styles = useStyles();

  const relDate = notification.sentDate
    ? (() => {
        try {
          return formatDistanceToNow(new Date(notification.sentDate), { addSuffix: true });
        } catch {
          return '';
        }
      })()
    : '';

  return (
    <div
      role="button"
      tabIndex={0}
      className={styles.recentCard}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      aria-label={notification.title}
    >
      <div className={styles.recentCardTop}>
        <span className={styles.recentCardTitle} title={notification.title}>
          {notification.title}
        </span>
        {relDate && <span className={styles.recentCardDate}>{relDate}</span>}
      </div>
      {notification.summary && (
        <div className={styles.recentCardSummary}>{notification.summary}</div>
      )}
      <div className={styles.recentCardFooter}>
        <span
          className={styles.statusBadge}
          style={{ color: tokens.colorPaletteGreenForeground1 }}
        >
          <span
            className={styles.statusDot}
            style={{ backgroundColor: tokens.colorPaletteGreenForeground1 }}
            aria-hidden="true"
          />
          {notification.status}
        </span>
        {notification.totalRecipientCount > 0 && (
          <span className={styles.deliveryCount}>
            {notification.succeededCount}/{notification.totalRecipientCount} delivered
          </span>
        )}
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface HomeDashboardProps {
  onNavigate: (view: SidebarView) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function HomeDashboard({ onNavigate }: HomeDashboardProps) {
  const styles = useStyles();
  const { t } = useTranslation();

  const { data: recentData, isLoading } = useNotifications({
    status: 'Sent',
    page: 1,
    pageSize: 5,
  });

  const recentMessages = recentData?.items ?? [];

  const handleRecentClick = useCallback(() => {
    onNavigate('Sent');
  }, [onNavigate]);

  const TABS: NotificationTab[] = ['Sent', 'Draft', 'Scheduled'];

  return (
    <div className={styles.root}>
      {/* Header */}
      <div className={styles.header}>
        <Text className={styles.headerTitle}>{t('dashboard.title')}</Text>
      </div>

      {/* Stat cards */}
      <div className={styles.statsRow}>
        {TABS.map((tab) => (
          <StatCard key={tab} tab={tab} onNavigate={onNavigate} />
        ))}
      </div>

      {/* Recent messages */}
      <div>
        <div className={styles.sectionHeader}>
          <Text className={styles.sectionTitle}>{t('dashboard.recentMessages')}</Text>
          {recentMessages.length > 0 && (
            <Button
              appearance="subtle"
              size="small"
              onClick={() => { onNavigate('Sent'); }}
            >
              {t('dashboard.viewAll')}
            </Button>
          )}
        </div>
        <div className={mergeClasses(styles.recentGrid)} style={{ marginTop: '12px' }}>
          {isLoading ? (
            <div className={styles.emptyState}>
              <Spinner size="small" />
            </div>
          ) : recentMessages.length === 0 ? (
            <div className={styles.emptyState}>
              <Text size={300}>{t('dashboard.noRecent')}</Text>
            </div>
          ) : (
            recentMessages.map((msg) => (
              <RecentCard
                key={msg.id}
                notification={msg}
                onClick={handleRecentClick}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
