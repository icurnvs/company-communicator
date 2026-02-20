import { useState, useEffect, useCallback, useMemo } from 'react';
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
  onOpenCompose: (editId?: string | null) => void;
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
  return AVATAR_PALETTE[index];
}

function getAvatarInitials(title: string): string {
  const words = title.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
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

  // Scrollable list area
  listArea: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
  },

  // Empty / loading / error states
  centerState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    padding: tokens.spacingHorizontalXL,
    gap: tokens.spacingVerticalM,
    color: tokens.colorNeutralForeground3,
    textAlign: 'center',
  },

  // Message row — outer wrapper (position relative for progress bar)
  rowWrapper: {
    position: 'relative',
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },

  row: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    cursor: 'pointer',
    minHeight: '64px',
    backgroundColor: tokens.colorNeutralBackground1,
    transition: 'background-color 0.1s ease',
    ':hover': {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
    // Remove default button styles if ever rendered as button
    border: 'none',
    width: '100%',
    textAlign: 'left',
  },

  rowSelected: {
    backgroundColor: tokens.colorNeutralBackground1Selected,
    ':hover': {
      backgroundColor: tokens.colorNeutralBackground1Selected,
    },
  },

  // Avatar circle
  avatar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '40px',
    height: '40px',
    borderRadius: tokens.borderRadiusCircular,
    flexShrink: 0,
    color: tokens.colorNeutralForeground1InvertedAccessible,
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightSemibold,
    userSelect: 'none',
  },

  // Row body (text content)
  rowBody: {
    flex: 1,
    minWidth: 0, // Allow text truncation
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXXS,
  },

  rowTopLine: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacingHorizontalS,
  },

  rowTitle: {
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

  rowDate: {
    flexShrink: 0,
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorNeutralForeground3,
    whiteSpace: 'nowrap',
  },

  rowPreview: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
    lineHeight: tokens.lineHeightBase200,
  },

  rowBottomLine: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
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

  // Indeterminate progress bar for in-progress rows
  '@keyframes indeterminate': {
    '0%': { transform: 'translateX(-100%)' },
    '100%': { transform: 'translateX(400%)' },
  },
  progressBarTrack: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '2px',
    backgroundColor: tokens.colorNeutralBackground3,
    overflow: 'hidden',
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

interface MessageRowProps {
  notification: NotificationSummaryDto;
  tab: NotificationTab;
  isSelected: boolean;
  onSelect: (notification: NotificationSummaryDto) => void;
  styles: ReturnType<typeof useStyles>;
  t: (key: string) => string;
}

function MessageRow({
  notification,
  tab,
  isSelected,
  onSelect,
  styles,
  t,
}: MessageRowProps) {
  const isInProgress = IN_PROGRESS_STATUSES.includes(notification.status);
  const avatarColor = getAvatarColor(notification.title);
  const initials = getAvatarInitials(notification.title);
  const relDate = formatRelativeDate(getRelevantDate(notification, tab));
  const preview = notification.summary
    ? notification.summary.slice(0, 80)
    : '';

  return (
    <div className={styles.rowWrapper}>
      <div
        role="button"
        tabIndex={0}
        className={mergeClasses(styles.row, isSelected ? styles.rowSelected : undefined)}
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
        {/* Avatar */}
        <div
          className={styles.avatar}
          style={{ backgroundColor: avatarColor }}
          aria-hidden="true"
        >
          {initials}
        </div>

        {/* Body */}
        <div className={styles.rowBody}>
          {/* Top line: title + date */}
          <div className={styles.rowTopLine}>
            <span className={styles.rowTitle} title={notification.title}>
              {notification.title}
            </span>
            {relDate && (
              <span className={styles.rowDate}>{relDate}</span>
            )}
          </div>

          {/* Bottom line: preview + status */}
          <div className={styles.rowBottomLine}>
            <span className={styles.rowPreview} title={preview || undefined}>
              {preview}
            </span>
            <StatusBadge status={notification.status} t={t} styles={styles} />
          </div>
        </div>
      </div>

      {/* In-progress indeterminate progress bar */}
      {isInProgress && (
        <div className={styles.progressBarTrack} aria-hidden="true">
          <div className={styles.progressBarFill} />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main MessageList component
// ---------------------------------------------------------------------------

const PAGE_SIZE = 20;

export function MessageList({
  activeTab,
  selectedMessageId,
  onSelectMessage,
  onOpenCompose,
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
      if (notification.status === 'Draft') {
        onOpenCompose(notification.id);
      }
    },
    [onSelectMessage, onOpenCompose],
  );

  const emptyMessages: Record<NotificationTab, string> = {
    Draft: t('notificationList.empty.draft'),
    Sent: t('notificationList.empty.sent'),
    Scheduled: t('notificationList.empty.scheduled'),
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
      <div style={{ padding: tokens.spacingHorizontalM }}>
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
      <MessageRow
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

      {/* Scrollable list */}
      <div className={styles.listArea} role="list" aria-label={t('notificationList.title')}>
        {bodyContent}
      </div>

      {/* Pagination footer — only shown when there are multiple pages */}
      {totalPages > 1 && !isLoading && !isError && (
        <div className={styles.pagination}>
          <Text className={styles.paginationInfo}>
            {t('notificationList.pagination.showing', { from, to, total: totalCount })}
          </Text>
          <div className={styles.paginationButtons}>
            <Button
              size="small"
              appearance="subtle"
              disabled={page === 1}
              onClick={() => { setPage((p) => p - 1); }}
              aria-label={t('notificationList.pagination.previous')}
            >
              {t('notificationList.pagination.previous')}
            </Button>
            <Button
              size="small"
              appearance="subtle"
              disabled={page >= totalPages}
              onClick={() => { setPage((p) => p + 1); }}
              aria-label={t('notificationList.pagination.next')}
            >
              {t('notificationList.pagination.next')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
