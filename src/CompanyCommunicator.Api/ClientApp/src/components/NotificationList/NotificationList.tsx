import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  makeStyles,
  tokens,
  TabList,
  Tab,
  Spinner,
  MessageBar,
  MessageBarBody,
  Text,
  Badge,
  Button,
  Table,
  TableHeader,
  TableHeaderCell,
  TableBody,
  TableRow,
  TableCell,
  TableCellLayout,
  type SelectTabData,
  type SelectTabEvent,
} from '@fluentui/react-components';
import { dialog } from '@microsoft/teams-js';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { useNotifications } from '@/api/notifications';
import type { NotificationTab, NotificationSummaryDto, NotificationStatus } from '@/types';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  tabSection: {
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalL} 0`,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  tableSection: {
    flex: 1,
    overflow: 'auto',
    padding: tokens.spacingHorizontalL,
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: tokens.spacingVerticalXXL,
    gap: tokens.spacingVerticalM,
    color: tokens.colorNeutralForeground3,
  },
  pagination: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: `${tokens.spacingVerticalM} 0`,
  },
  clickableRow: {
    cursor: 'pointer',
    '&:hover': {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },
  statusBadge: {
    minWidth: '80px',
    display: 'inline-flex',
    justifyContent: 'center',
  },
  recipientCount: {
    fontVariantNumeric: 'tabular-nums',
  },
});

function statusToColor(
  status: NotificationStatus,
): 'success' | 'danger' | 'warning' | 'informative' | 'subtle' {
  switch (status) {
    case 'Sent':
      return 'success';
    case 'Failed':
      return 'danger';
    case 'Canceled':
      return 'subtle';
    case 'Scheduled':
      return 'warning';
    case 'Draft':
      return 'subtle';
    default:
      return 'informative';
  }
}

const PAGE_SIZE = 20;

interface NotificationListProps {
  initialTab?: NotificationTab;
}

export function NotificationList({
  initialTab = 'Draft',
}: NotificationListProps) {
  const styles = useStyles();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<NotificationTab>(initialTab);
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, error, refetch } = useNotifications({
    status: activeTab,
    page,
    pageSize: PAGE_SIZE,
  });

  const handleTabChange = useCallback(
    (_e: SelectTabEvent, d: SelectTabData) => {
      setActiveTab(d.value as NotificationTab);
      setPage(1);
    },
    [],
  );

  const handleRowClick = useCallback(
    (notification: NotificationSummaryDto) => {
      if (activeTab === 'Draft') {
        // Open edit form as Teams dialog
        const baseUrl = window.location.origin;
        dialog.url.open(
          {
            url: `${baseUrl}/clientapp/compose/${notification.id}`,
            title: t('notificationForm.editTitle'),
            size: { height: 700, width: 900 },
          },
          () => {
            void refetch();
          },
        );
      } else {
        void navigate(`/notifications/${notification.id}`);
      }
    },
    [activeTab, navigate, refetch, t],
  );

  const totalCount = data?.totalCount ?? 0;
  const items = data?.items ?? [];
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const from = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, totalCount);

  const emptyMessages: Record<NotificationTab, string> = {
    Draft: t('notificationList.empty.draft'),
    Sent: t('notificationList.empty.sent'),
    Scheduled: t('notificationList.empty.scheduled'),
  };

  return (
    <div className={styles.container}>
      <div className={styles.tabSection}>
        <TabList
          selectedValue={activeTab}
          onTabSelect={handleTabChange}
          aria-label={t('notificationList.title')}
        >
          <Tab value="Draft">{t('notificationList.tabs.draft')}</Tab>
          <Tab value="Sent">{t('notificationList.tabs.sent')}</Tab>
          <Tab value="Scheduled">{t('notificationList.tabs.scheduled')}</Tab>
        </TabList>
      </div>

      <div className={styles.tableSection}>
        {isLoading ? (
          <div className={styles.emptyState}>
            <Spinner label={t('app.loading')} />
          </div>
        ) : isError ? (
          <MessageBar intent="error">
            <MessageBarBody>
              {error instanceof Error
                ? error.message
                : t('errors.loadFailed')}
            </MessageBarBody>
          </MessageBar>
        ) : items.length === 0 ? (
          <div className={styles.emptyState}>
            <Text size={400}>{emptyMessages[activeTab]}</Text>
          </div>
        ) : (
          <>
            <Table
              aria-label={`${activeTab} notifications`}
              sortable
            >
              <TableHeader>
                <TableRow>
                  <TableHeaderCell>
                    {t('notificationList.columns.title')}
                  </TableHeaderCell>
                  <TableHeaderCell>
                    {t('notificationList.columns.author')}
                  </TableHeaderCell>
                  <TableHeaderCell>
                    {t('notificationList.columns.date')}
                  </TableHeaderCell>
                  <TableHeaderCell>
                    {t('notificationList.columns.status')}
                  </TableHeaderCell>
                  {activeTab === 'Sent' && (
                    <>
                      <TableHeaderCell>
                        {t('notificationList.columns.succeeded')}
                      </TableHeaderCell>
                      <TableHeaderCell>
                        {t('notificationList.columns.failed')}
                      </TableHeaderCell>
                    </>
                  )}
                  {activeTab !== 'Draft' && (
                    <TableHeaderCell>
                      {t('notificationList.columns.recipients')}
                    </TableHeaderCell>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((notification) => (
                  <TableRow
                    key={notification.id}
                    className={styles.clickableRow}
                    onClick={() => handleRowClick(notification)}
                    aria-label={`${notification.title} - ${notification.status}`}
                  >
                    <TableCell>
                      <TableCellLayout>
                        <Text weight="semibold">{notification.title}</Text>
                      </TableCellLayout>
                    </TableCell>
                    <TableCell>
                      <TableCellLayout>
                        {notification.author ?? '—'}
                      </TableCellLayout>
                    </TableCell>
                    <TableCell>
                      <TableCellLayout>
                        {notification.sentDate
                          ? format(new Date(notification.sentDate), 'PP p')
                          : notification.scheduledDate
                            ? format(
                                new Date(notification.scheduledDate),
                                'PP p',
                              )
                            : format(
                                new Date(notification.createdDate),
                                'PP p',
                              )}
                      </TableCellLayout>
                    </TableCell>
                    <TableCell>
                      <TableCellLayout>
                        <Badge
                          className={styles.statusBadge}
                          color={statusToColor(notification.status)}
                          appearance="filled"
                        >
                          {t(`status.${notification.status}`)}
                        </Badge>
                      </TableCellLayout>
                    </TableCell>
                    {activeTab === 'Sent' && (
                      <>
                        <TableCell>
                          <TableCellLayout>
                            <Text
                              className={styles.recipientCount}
                              style={{ color: tokens.colorStatusSuccessForeground1 }}
                            >
                              {notification.succeededCount.toLocaleString()}
                            </Text>
                          </TableCellLayout>
                        </TableCell>
                        <TableCell>
                          <TableCellLayout>
                            <Text
                              className={styles.recipientCount}
                              style={{
                                color:
                                  notification.failedCount > 0
                                    ? tokens.colorStatusDangerForeground1
                                    : tokens.colorNeutralForeground1,
                              }}
                            >
                              {notification.failedCount.toLocaleString()}
                            </Text>
                          </TableCellLayout>
                        </TableCell>
                      </>
                    )}
                    {activeTab !== 'Draft' && (
                      <TableCell>
                        <TableCellLayout>
                          <Text className={styles.recipientCount}>
                            {notification.totalRecipientCount.toLocaleString()}
                          </Text>
                        </TableCellLayout>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {totalPages > 1 && (
              <div className={styles.pagination}>
                <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                  {t('notificationList.pagination.showing', {
                    from,
                    to,
                    total: totalCount,
                  })}
                </Text>
                <div style={{ display: 'flex', gap: tokens.spacingHorizontalS }}>
                  <Button
                    size="small"
                    disabled={page === 1}
                    onClick={() => setPage((p) => p - 1)}
                    aria-label={t('notificationList.pagination.previous')}
                  >
                    {t('notificationList.pagination.previous')}
                  </Button>
                  <Button
                    size="small"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    aria-label={t('notificationList.pagination.next')}
                  >
                    {t('notificationList.pagination.next')}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
