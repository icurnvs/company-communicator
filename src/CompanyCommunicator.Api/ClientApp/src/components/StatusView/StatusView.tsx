import { useState, useCallback, type ReactNode } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  makeStyles,
  tokens,
  Button,
  Spinner,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  MessageBarActions,
  Text,
  Badge,
  ProgressBar,
  Divider,
  Dialog,
  DialogTrigger,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  DialogActions,
  Card,
  CardHeader,
} from '@fluentui/react-components';
import {
  ArrowLeft24Regular,
  Send24Regular,
  CheckmarkCircle24Regular,
  ErrorCircle24Regular,
  PersonQuestionMark24Regular,
  Dismiss24Regular,
  Dismiss12Regular,
  QuestionCircle24Regular,
  ArrowExportUp24Regular,
} from '@fluentui/react-icons';
import { dialog as teamsDialog } from '@microsoft/teams-js';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import {
  useNotification,
  useDeliveryStatus,
  useCancelNotification,
} from '@/api/notifications';
import { ApiResponseError } from '@/api/client';
import { TERMINAL_STATUSES } from '@/types';
import type { NotificationStatus } from '@/types';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalL}`,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    flexShrink: 0,
  },
  content: {
    flex: 1,
    overflow: 'auto',
    padding: `${tokens.spacingVerticalL} ${tokens.spacingHorizontalL}`,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalL,
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: tokens.spacingHorizontalM,
  },
  statCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: tokens.spacingVerticalXS,
    padding: tokens.spacingVerticalM,
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    textAlign: 'center',
  },
  statNumber: {
    fontSize: tokens.fontSizeHero700,
    fontWeight: tokens.fontWeightBold,
    fontVariantNumeric: 'tabular-nums',
    lineHeight: '1',
  },
  detailsSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
  },
  detailRow: {
    display: 'flex',
    gap: tokens.spacingHorizontalM,
  },
  detailLabel: {
    minWidth: '140px',
    color: tokens.colorNeutralForeground3,
    fontWeight: tokens.fontWeightSemibold,
    flexShrink: 0,
  },
  progressSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
  },
  progressHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  autoRefreshBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
  },
  actions: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
    flexWrap: 'wrap',
    paddingTop: tokens.spacingVerticalS,
  },
  errorMessage: {
    color: tokens.colorStatusDangerForeground1,
    backgroundColor: tokens.colorStatusDangerBackground1,
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalS}`,
    borderRadius: tokens.borderRadiusSmall,
    fontSize: tokens.fontSizeBase200,
    fontFamily: 'monospace',
  },
});

function statusToColor(
  status: NotificationStatus,
): 'success' | 'danger' | 'warning' | 'informative' | 'subtle' {
  switch (status) {
    case 'Sent': return 'success';
    case 'Failed': return 'danger';
    case 'Canceled': return 'subtle';
    case 'Scheduled': return 'warning';
    case 'Draft': return 'subtle';
    default: return 'informative';
  }
}

interface StatCardProps {
  icon: ReactNode;
  label: string;
  value: number;
  color?: string;
}

function StatCard({ icon, label, value, color }: StatCardProps) {
  const styles = useStyles();
  return (
    <div className={styles.statCard}>
      {icon}
      <Text className={styles.statNumber} style={color ? { color } : undefined}>
        {value.toLocaleString()}
      </Text>
      <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
        {label}
      </Text>
    </div>
  );
}

export function StatusView() {
  const styles = useStyles();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const {
    data: notification,
    isLoading: notifLoading,
    isError: notifError,
  } = useNotification(id ?? '');

  const { data: statusData } = useDeliveryStatus(id ?? '');

  const cancelMutation = useCancelNotification();

  const effectiveStatus = statusData?.status ?? notification?.status;
  const isTerminal = effectiveStatus
    ? TERMINAL_STATUSES.includes(effectiveStatus)
    : false;
  const canCancel =
    effectiveStatus === 'Scheduled' ||
    effectiveStatus === 'Queued' ||
    effectiveStatus === 'Sending';

  const totalCount =
    statusData?.totalRecipientCount ?? notification?.totalRecipientCount ?? 0;
  const succeededCount =
    statusData?.succeededCount ?? notification?.succeededCount ?? 0;
  const failedCount =
    statusData?.failedCount ?? notification?.failedCount ?? 0;
  const notFoundCount =
    statusData?.recipientNotFoundCount ??
    notification?.recipientNotFoundCount ??
    0;
  const canceledCount =
    statusData?.canceledCount ?? notification?.canceledCount ?? 0;
  const unknownCount =
    statusData?.unknownCount ?? notification?.unknownCount ?? 0;

  const deliveryProgress =
    totalCount > 0 ? succeededCount / totalCount : 0;

  const handleCancel = useCallback(async () => {
    if (!id) return;
    setActionError(null);
    try {
      await cancelMutation.mutateAsync(id);
      setCancelDialogOpen(false);
    } catch (err) {
      setActionError(
        err instanceof ApiResponseError
          ? err.message
          : t('errors.cancelFailed'),
      );
    }
  }, [id, cancelMutation, t]);

  const handleExport = useCallback(() => {
    if (!id) return;
    const baseUrl = window.location.origin;
    teamsDialog.url.open(
      {
        url: `${baseUrl}/clientapp/export/${id}`,
        title: t('exportManager.title'),
        size: { height: 400, width: 600 },
      },
      () => {
        // dialog closed
      },
    );
  }, [id, t]);

  if (notifLoading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
        }}
      >
        <Spinner label={t('app.loading')} />
      </div>
    );
  }

  if (notifError || !notification) {
    return (
      <MessageBar intent="error" style={{ margin: tokens.spacingHorizontalL }}>
        <MessageBarBody>
          <MessageBarTitle>{t('errors.generic')}</MessageBarTitle>
          {t('errors.notFound')}
        </MessageBarBody>
      </MessageBar>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <Button
          appearance="subtle"
          icon={<ArrowLeft24Regular />}
          onClick={() => void navigate('/')}
          aria-label="Back to notifications"
        />
        <div style={{ flex: 1 }}>
          <Text size={500} weight="semibold">
            {notification.title}
          </Text>
        </div>
        <Badge color={statusToColor(effectiveStatus ?? notification.status)} appearance="filled">
          {t(`status.${effectiveStatus ?? notification.status}`)}
        </Badge>
      </div>

      {/* Content */}
      <div className={styles.content}>
        {actionError && (
          <MessageBar intent="error">
            <MessageBarBody>{actionError}</MessageBarBody>
            <MessageBarActions
              containerAction={
                <Button
                  appearance="transparent"
                  size="small"
                  icon={<Dismiss12Regular />}
                  onClick={() => { setActionError(null); }}
                  aria-label="Dismiss error"
                />
              }
            />
          </MessageBar>
        )}

        {/* Auto-refresh indicator */}
        {!isTerminal && (
          <div className={styles.autoRefreshBadge}>
            <Spinner size="extra-tiny" />
            <Text size={200}>{t('statusView.autoRefresh')}</Text>
          </div>
        )}

        {/* Delivery progress */}
        {totalCount > 0 && (
          <Card>
            <CardHeader
              header={
                <Text weight="semibold">{t('statusView.progress')}</Text>
              }
            />
            <div
              style={{
                padding: `0 ${tokens.spacingHorizontalM} ${tokens.spacingVerticalM}`,
              }}
            >
              <div className={styles.progressHeader}>
                <Text size={200}>
                  {succeededCount.toLocaleString()} /{' '}
                  {totalCount.toLocaleString()}
                </Text>
                <Text size={200}>
                  {Math.round(deliveryProgress * 100)}%
                </Text>
              </div>
              <ProgressBar
                value={deliveryProgress}
                color={
                  effectiveStatus === 'Sent'
                    ? 'success'
                    : effectiveStatus === 'Failed'
                      ? 'error'
                      : 'brand'
                }
                style={{ marginTop: tokens.spacingVerticalXS }}
              />
            </div>
          </Card>
        )}

        {/* Stats grid */}
        <div className={styles.statsGrid}>
          <StatCard
            icon={<Send24Regular style={{ color: tokens.colorNeutralForeground3 }} />}
            label={t('statusView.stats.total')}
            value={totalCount}
          />
          <StatCard
            icon={
              <CheckmarkCircle24Regular
                style={{ color: tokens.colorStatusSuccessForeground1 }}
              />
            }
            label={t('statusView.stats.succeeded')}
            value={succeededCount}
            color={tokens.colorStatusSuccessForeground1}
          />
          <StatCard
            icon={
              <ErrorCircle24Regular
                style={{ color: tokens.colorStatusDangerForeground1 }}
              />
            }
            label={t('statusView.stats.failed')}
            value={failedCount}
            color={failedCount > 0 ? tokens.colorStatusDangerForeground1 : undefined}
          />
          <StatCard
            icon={
              <PersonQuestionMark24Regular
                style={{ color: tokens.colorNeutralForeground3 }}
              />
            }
            label={t('statusView.stats.notFound')}
            value={notFoundCount}
          />
          <StatCard
            icon={
              <Dismiss24Regular
                style={{ color: tokens.colorNeutralForeground3 }}
              />
            }
            label={t('statusView.stats.canceled')}
            value={canceledCount}
          />
          <StatCard
            icon={
              <QuestionCircle24Regular
                style={{ color: tokens.colorNeutralForeground3 }}
              />
            }
            label={t('statusView.stats.unknown')}
            value={unknownCount}
          />
        </div>

        <Divider />

        {/* Details */}
        <Card>
          <CardHeader
            header={<Text weight="semibold">{t('statusView.details.title')}</Text>}
          />
          <div
            style={{
              padding: `0 ${tokens.spacingHorizontalM} ${tokens.spacingVerticalM}`,
              display: 'flex',
              flexDirection: 'column',
              gap: tokens.spacingVerticalS,
            }}
          >
            {[
              {
                label: t('statusView.details.author'),
                value: notification.author ?? '—',
              },
              {
                label: t('statusView.details.createdDate'),
                value: format(new Date(notification.createdDate), 'PPPp'),
              },
              notification.sentDate && {
                label: t('statusView.details.sentDate'),
                value: format(new Date(notification.sentDate), 'PPPp'),
              },
              notification.scheduledDate && {
                label: t('statusView.details.scheduledDate'),
                value: format(new Date(notification.scheduledDate), 'PPPp'),
              },
              {
                label: t('statusView.details.allUsers'),
                value: notification.allUsers
                  ? t('statusView.details.allUsersValue')
                  : t('statusView.details.specificAudience'),
              },
            ]
              .filter(Boolean)
              .map((row) => {
                if (!row) return null;
                return (
                  <div key={row.label} className={styles.detailRow}>
                    <Text className={styles.detailLabel}>{row.label}</Text>
                    <Text>{row.value}</Text>
                  </div>
                );
              })}

            {notification.errorMessage && (
              <div className={styles.detailRow}>
                <Text className={styles.detailLabel}>
                  {t('statusView.details.title')}
                </Text>
                <code className={styles.errorMessage}>
                  {notification.errorMessage}
                </code>
              </div>
            )}
          </div>
        </Card>

        {/* Actions */}
        <div className={styles.actions}>
          {canCancel && (
            <Dialog
              open={cancelDialogOpen}
              onOpenChange={(_e, d) => { setCancelDialogOpen(d.open); }}
            >
              <DialogTrigger disableButtonEnhancement>
                <Button
                  appearance="secondary"
                  icon={<Dismiss24Regular />}
                  disabled={cancelMutation.isPending}
                >
                  {t('statusView.actions.cancel')}
                </Button>
              </DialogTrigger>
              <DialogSurface>
                <DialogBody>
                  <DialogTitle>
                    {t('statusView.confirmCancel.title')}
                  </DialogTitle>
                  <DialogContent>
                    {t('statusView.confirmCancel.message')}
                  </DialogContent>
                  <DialogActions>
                    <Button
                      appearance="secondary"
                      onClick={() => { setCancelDialogOpen(false); }}
                    >
                      {t('app.no')}
                    </Button>
                    <Button
                      appearance="primary"
                      onClick={() => void handleCancel()}
                      disabled={cancelMutation.isPending}
                    >
                      {cancelMutation.isPending
                        ? t('statusView.actions.canceling')
                        : t('statusView.confirmCancel.confirm')}
                    </Button>
                  </DialogActions>
                </DialogBody>
              </DialogSurface>
            </Dialog>
          )}

          {(effectiveStatus === 'Sent' || effectiveStatus === 'Failed') && (
            <Button
              appearance="secondary"
              icon={<ArrowExportUp24Regular />}
              onClick={handleExport}
            >
              {t('statusView.actions.export')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
