import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import {
  makeStyles,
  tokens,
  Input,
  Text,
  Button,
  Spinner,
  MessageBar,
  MessageBarBody,
  mergeClasses,
} from '@fluentui/react-components';
import { SearchRegular } from '@fluentui/react-icons';
import { useTranslation } from 'react-i18next';
import { formatDistanceToNow } from 'date-fns';
import { useNotifications } from '@/api/notifications';
import type { NotificationSummaryDto, NotificationStatus, NotificationTab } from '@/types';
import { IN_PROGRESS_STATUSES } from '@/types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface MessageListProps {
  activeTab: NotificationTab;
  selectedMessageId: string | null;
  onSelectMessage: (id: string | null) => void;
}

// ---------------------------------------------------------------------------
// Avatar color palette — deterministic per title, using Fluent palette tokens
// ---------------------------------------------------------------------------

const AVATAR_PALETTE: string[] = [
  tokens.colorPaletteBlueBorderActive,
  tokens.colorPaletteGreenBorderActive,
  tokens.colorPalettePurpleBorderActive,
  tokens.colorPaletteCranberryBorderActive,
  tokens.colorPaletteTealBorderActive,
  tokens.colorPaletteGoldBorderActive,
  tokens.colorPaletteMagentaBorderActive,
  tokens.colorPaletteMarigoldBorderActive,
  tokens.colorPaletteSteelBorderActive,
  tokens.colorPaletteBerryBorderActive,
];

function getAvatarColor(title: string): string {
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = title.charCodeAt(i) + ((hash << 5) - hash);
    hash |= 0; // Convert to 32-bit integer
  }
  const index = Math.abs(hash) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[index] ?? AVATAR_PALETTE[0]!;
}

function getAvatarInitials(title: string): string {
  const words = title.trim().split(/\s+/);
  if (words.length >= 2 && words[0] && words[1]) {
    return ((words[0][0] ?? '') + (words[1][0] ?? '')).toUpperCase();
  }
  return title.slice(0, 2).toUpperCase();
}

// ---------------------------------------------------------------------------
// Date formatting helpers
// ---------------------------------------------------------------------------

function getRelevantDate(
  notification: NotificationSummaryDto,
  tab: NotificationTab,
): string {
  if (tab === 'Sent' && notification.sentDate) {
    return notification.sentDate;
  }
  if (tab === 'Scheduled' && notification.scheduledDate) {
    return notification.scheduledDate;
  }
  return notification.createdDate;
}

function formatRelativeDate(isoDate: string): string {
  try {
    return formatDistanceToNow(new Date(isoDate), { addSuffix: true });
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------
// Status badge helpers
// ---------------------------------------------------------------------------

type StatusDisplay = {
  label: string;
  colorVar: string;
  isPulsing: boolean;
};

function getStatusDisplay(
  status: NotificationStatus,
  t: (key: string) => string,
): StatusDisplay {
  const label = t(`status.${status}`);
  const isInProgress = IN_PROGRESS_STATUSES.includes(status);

  switch (status) {
    case 'Sent':
      return { label, colorVar: tokens.colorPaletteGreenForeground1, isPulsing: false };
    case 'Sending':
    case 'Queued':
    case 'SyncingRecipients':
    case 'InstallingApp':
      return { label, colorVar: tokens.colorBrandForeground1, isPulsing: isInProgress };
    case 'Scheduled':
      return { label, colorVar: tokens.colorPalettePeachForeground2, isPulsing: false };
    case 'Failed':
      return { label, colorVar: tokens.colorPaletteRedForeground1, isPulsing: false };
    case 'Draft':
    case 'Canceled':
    default:
      return { label, colorVar: tokens.colorNeutralForeground3, isPulsing: false };
  }
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
    backgroundColor: tokens.colorNeutralBackground1,
  },

  // Search bar
  searchBar: {
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    flexShrink: 0,
  },
  searchInput: {
    width: '100%',
  },

  // Card grid area
  listArea: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '16px',
    padding: '16px',
    alignContent: 'start',
  },

  // Empty / loading / error states
  centerState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: tokens.spacingHorizontalXL,
    gap: tokens.spacingVerticalM,
    color: tokens.colorNeutralForeground3,
    textAlign: 'center',
    gridColumn: '1 / -1',
    minHeight: '200px',
  },

  // Card
  card: {
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
  cardSelected: {
    borderColor: tokens.colorBrandStroke1,
    boxShadow: tokens.shadow8,
    ':hover': {
      borderTopColor: tokens.colorBrandStroke1,
      borderRightColor: tokens.colorBrandStroke1,
      borderBottomColor: tokens.colorBrandStroke1,
      borderLeftColor: tokens.colorBrandStroke1,
      boxShadow: tokens.shadow8,
    },
  },

  // Card top row: avatar + title + date
  cardTop: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },

  // Avatar circle (slightly smaller for cards)
  avatar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    borderRadius: tokens.borderRadiusCircular,
    flexShrink: 0,
    color: tokens.colorNeutralForegroundInverted,
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
    userSelect: 'none',
  },

  cardTitle: {
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorNeutralForeground1,
    lineHeight: tokens.lineHeightBase300,
  },

  cardDate: {
    flexShrink: 0,
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorNeutralForeground3,
    whiteSpace: 'nowrap',
  },

  // Card body: preview text
  cardBody: {
    marginTop: '8px',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
    lineHeight: tokens.lineHeightBase200,
    minHeight: `calc(${tokens.lineHeightBase200} * 2)`,
  },

  // Card footer: status + delivery count
  cardFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 'auto',
    paddingTop: '12px',
  },

  deliveryCount: {
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorNeutralForeground3,
  },

  // Status badge — inline text with colored dot
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

  // Pulsing dot animation for in-progress statuses
  '@keyframes pulse': {
    '0%, 100%': { opacity: 1 },
    '50%': { opacity: 0.3 },
  },
  statusDotPulsing: {
    animationName: 'pulse',
    animationDuration: '1.4s',
    animationTimingFunction: 'ease-in-out',
    animationIterationCount: 'infinite',
  },

  // Indeterminate progress bar for in-progress cards
  '@keyframes indeterminate': {
    '0%': { transform: 'translateX(-100%)' },
    '100%': { transform: 'translateX(400%)' },
  },
  progressBarTrack: {
    height: '2px',
    backgroundColor: tokens.colorNeutralBackground3,
    overflow: 'hidden',
    borderRadius: `0 0 ${tokens.borderRadiusLarge} ${tokens.borderRadiusLarge}`,
    marginTop: '12px',
    marginLeft: '-16px',
    marginRight: '-16px',
    marginBottom: '-16px',
  },
  progressBarFill: {
    height: '100%',
    width: '25%',
    backgroundColor: tokens.colorBrandBackground,
    animationName: 'indeterminate',
    animationDuration: '1.6s',
    animationTimingFunction: 'ease-in-out',
    animationIterationCount: 'infinite',
  },

  // Pagination footer
  pagination: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    flexShrink: 0,
    gap: tokens.spacingHorizontalS,
  },
  paginationInfo: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase100,
    whiteSpace: 'nowrap',
  },
  paginationButtons: {
    display: 'flex',
    gap: tokens.spacingHorizontalXS,
    flexShrink: 0,
  },
});

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface StatusBadgeProps {
  status: NotificationStatus;
  t: (key: string) => string;
  styles: ReturnType<typeof useStyles>;
}

function StatusBadge({ status, t, styles }: StatusBadgeProps) {
  const { label, colorVar, isPulsing } = getStatusDisplay(status, t);

  return (
    <span className={styles.statusBadge} style={{ color: colorVar }}>
      <span
        className={mergeClasses(
          styles.statusDot,
          isPulsing ? styles.statusDotPulsing : undefined,
        )}
        style={{ backgroundColor: colorVar }}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}

interface MessageCardProps {
  notification: NotificationSummaryDto;
  tab: NotificationTab;
  isSelected: boolean;
  onSelect: (notification: NotificationSummaryDto) => void;
  styles: ReturnType<typeof useStyles>;
  t: (key: string) => string;
}

const MessageCard = memo(function MessageCard({
  notification,
  tab,
  isSelected,
  onSelect,
  styles,
  t,
}: MessageCardProps) {
  const isInProgress = IN_PROGRESS_STATUSES.includes(notification.status);
  const avatarColor = getAvatarColor(notification.title);
  const initials = getAvatarInitials(notification.title);
  const relDate = formatRelativeDate(getRelevantDate(notification, tab));
  const preview = notification.summary
    ? notification.summary.slice(0, 120)
    : '';

  return (
    <div
      role="button"
      tabIndex={0}
      className={mergeClasses(styles.card, isSelected ? styles.cardSelected : undefined)}
      onClick={() => { onSelect(notification); }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(notification);
        }
      }}
      aria-pressed={isSelected}
      aria-label={`${notification.title} — ${t(`status.${notification.status}`)}`}
    >
      {/* Top row: avatar + title + date */}
      <div className={styles.cardTop}>
        <div
          className={styles.avatar}
          style={{ backgroundColor: avatarColor }}
          aria-hidden="true"
        >
          {initials}
        </div>
        <span className={styles.cardTitle} title={notification.title}>
          {notification.title}
        </span>
        {relDate && (
          <span className={styles.cardDate}>{relDate}</span>
        )}
      </div>

      {/* Body: preview text */}
      <div className={styles.cardBody}>
        {preview}
      </div>

      {/* Footer: status badge + delivery count */}
      <div className={styles.cardFooter}>
        <StatusBadge status={notification.status} t={t} styles={styles} />
        {tab === 'Sent' && notification.totalRecipientCount > 0 && (
          <span className={styles.deliveryCount}>
            {notification.succeededCount}/{notification.totalRecipientCount} delivered
          </span>
        )}
      </div>

      {/* In-progress indeterminate progress bar */}
      {isInProgress && (
        <div className={styles.progressBarTrack} aria-hidden="true">
          <div className={styles.progressBarFill} />
        </div>
      )}
    </div>
  );
});

// ---------------------------------------------------------------------------
// Main MessageList component
// ---------------------------------------------------------------------------

const PAGE_SIZE = 20;

export function MessageList({
  activeTab,
  selectedMessageId,
  onSelectMessage,
}: MessageListProps) {
  const styles = useStyles();
  const { t } = useTranslation();

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Reset page and search when tab changes
  useEffect(() => {
    setPage(1);
    setSearchInput('');
    setDebouncedSearch('');
  }, [activeTab]);

  // 300ms debounce on the search input
  useEffect(() => {
    const timerId = setTimeout(() => {
      setDebouncedSearch(searchInput);
      // Reset to page 1 on new search term
      setPage(1);
    }, 300);
    return () => { clearTimeout(timerId); };
  }, [searchInput]);

  const { data, isLoading, isError, error } = useNotifications({
    status: activeTab,
    page,
    pageSize: PAGE_SIZE,
  });

  const allItems = data?.items ?? [];
  const totalCount = data?.totalCount ?? 0;

  // Client-side filter on title using the debounced value
  const filteredItems = useMemo(() => {
    if (!debouncedSearch.trim()) return allItems;
    const lower = debouncedSearch.toLowerCase();
    return allItems.filter((n) => n.title.toLowerCase().includes(lower));
  }, [allItems, debouncedSearch]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const from = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, totalCount);

  const handleSelect = useCallback(
    (notification: NotificationSummaryDto) => {
      onSelectMessage(notification.id);
    },
    [onSelectMessage],
  );

  const emptyMessages: Record<NotificationTab, string> = {
    Draft: t('messageList.empty.draft'),
    Sent: t('messageList.empty.sent'),
    Scheduled: t('messageList.empty.scheduled'),
  };

  // Determine body content
  let bodyContent: React.ReactNode;

  if (isLoading) {
    bodyContent = (
      <div className={styles.centerState}>
        <Spinner label={t('app.loading')} />
      </div>
    );
  } else if (isError) {
    bodyContent = (
      <div className={styles.centerState}>
        <MessageBar intent="error">
          <MessageBarBody>
            {error instanceof Error ? error.message : t('errors.loadFailed')}
          </MessageBarBody>
        </MessageBar>
      </div>
    );
  } else if (allItems.length === 0) {
    bodyContent = (
      <div className={styles.centerState}>
        <Text size={400}>{emptyMessages[activeTab]}</Text>
      </div>
    );
  } else if (filteredItems.length === 0) {
    bodyContent = (
      <div className={styles.centerState}>
        <Text size={400}>{t('app.noResults')}</Text>
      </div>
    );
  } else {
    bodyContent = filteredItems.map((notification) => (
      <MessageCard
        key={notification.id}
        notification={notification}
        tab={activeTab}
        isSelected={notification.id === selectedMessageId}
        onSelect={handleSelect}
        styles={styles}
        t={t}
      />
    ));
  }

  return (
    <div className={styles.root}>
      {/* Search bar */}
      <div className={styles.searchBar}>
        <Input
          className={styles.searchInput}
          contentBefore={<SearchRegular />}
          placeholder={t('app.search') + ' messages...'}
          value={searchInput}
          onChange={(_e, d) => { setSearchInput(d.value); }}
          aria-label={t('app.search')}
          size="medium"
          appearance="outline"
        />
      </div>

      {/* Card grid */}
      <div className={styles.listArea} role="list" aria-label={t('messageList.title')}>
        {bodyContent}
      </div>

      {/* Pagination footer — only shown when there are multiple pages */}
      {totalPages > 1 && !isLoading && !isError && (
        <div className={styles.pagination}>
          <Text className={styles.paginationInfo}>
            {t('messageList.pagination.showing', { from, to, total: totalCount })}
          </Text>
          <div className={styles.paginationButtons}>
            <Button
              size="small"
              appearance="subtle"
              disabled={page === 1}
              onClick={() => { setPage((p) => p - 1); }}
              aria-label={t('messageList.pagination.previous')}
            >
              {t('messageList.pagination.previous')}
            </Button>
            <Button
              size="small"
              appearance="subtle"
              disabled={page >= totalPages}
              onClick={() => { setPage((p) => p + 1); }}
              aria-label={t('messageList.pagination.next')}
            >
              {t('messageList.pagination.next')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
