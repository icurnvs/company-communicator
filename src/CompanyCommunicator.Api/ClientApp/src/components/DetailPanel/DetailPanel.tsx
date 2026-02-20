import { useState, useCallback, type ReactNode } from 'react';
import {
  makeStyles,
  tokens,
  Button,
  Badge,
  Text,
  Spinner,
  ProgressBar,
  Divider,
  MessageBar,
  MessageBarBody,
  MessageBarActions,
  Dialog,
  DialogTrigger,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@fluentui/react-components';
import {
  Dismiss20Regular,
  Dismiss12Regular,
  CheckmarkCircle20Regular,
  ErrorCircle20Regular,
  Clock20Regular,
  Person20Regular,
  Edit20Regular,
  Copy20Regular,
  ArrowExportUp20Regular,
  PeopleTeam20Regular,
  People20Regular,
} from '@fluentui/react-icons';
import { useTranslation } from 'react-i18next';
import { format, parseISO } from 'date-fns';
import {
  useNotification,
  useDeliveryStatus,
  useCancelNotification,
} from '@/api/notifications';
import { ApiResponseError } from '@/api/client';
import {
  TERMINAL_STATUSES,
  IN_PROGRESS_STATUSES,
  type NotificationDto,
  type NotificationStatus,
  type AudienceDto,
} from '@/types';

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
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: tokens.spacingHorizontalS,
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalM}`,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    flexShrink: 0,
  },
  headerContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
    minWidth: 0,
  },
  headerTitle: {
    wordBreak: 'break-word',
  },
  headerClose: {
    flexShrink: 0,
    marginTop: `-${tokens.spacingVerticalXS}`,
  },
  scrollArea: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalM}`,
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
  },
  sectionLabel: {
    color: tokens.colorNeutralForeground3,
    fontWeight: tokens.fontWeightSemibold,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: tokens.spacingHorizontalS,
  },
  statCell: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: tokens.spacingVerticalXXS,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalS}`,
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
  statLabel: {
    color: tokens.colorNeutralForeground3,
  },
  progressHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  audienceChipRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: tokens.spacingHorizontalXS,
    marginTop: tokens.spacingVerticalXS,
  },
  audienceGroupLabel: {
    color: tokens.colorNeutralForeground3,
    marginTop: tokens.spacingVerticalXS,
  },
  timestampRow: {
    display: 'flex',
    gap: tokens.spacingHorizontalM,
    alignItems: 'baseline',
  },
  timestampLabel: {
    color: tokens.colorNeutralForeground3,
    fontWeight: tokens.fontWeightSemibold,
    minWidth: '72px',
    flexShrink: 0,
  },
  actions: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalM,
  },
  actionRow: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
    flexWrap: 'wrap',
  },
  errorBox: {
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalS}`,
    backgroundColor: tokens.colorStatusDangerBackground1,
    border: `1px solid ${tokens.colorStatusDangerBorder1}`,
    borderRadius: tokens.borderRadiusMedium,
    wordBreak: 'break-word',
  },
  loadingCenter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
  allUsersBadge: {
    display: 'inline-flex',
  },
  autoRefreshRow: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    color: tokens.colorNeutralForeground3,
  },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function formatTimestamp(iso: string): string {
  return format(parseISO(iso), 'MMM d, yyyy h:mm a');
}

function truncateId(id: string, maxLen = 20): string {
  return id.length > maxLen ? `${id.slice(0, maxLen)}…` : id;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface StatCellProps {
  icon: ReactNode;
  label: string;
  value: number;
  color?: string;
}

function StatCell({ icon, label, value, color }: StatCellProps) {
  const styles = useStyles();
  return (
    <div className={styles.statCell}>
      {icon}
      <Text
        className={styles.statNumber}
        style={color ? { color } : undefined}
      >
        {value.toLocaleString()}
      </Text>
      <Text size={100} className={styles.statLabel}>
        {label}
      </Text>
    </div>
  );
}

interface AudienceChipProps {
  audience: AudienceDto;
}

function AudienceChip({ audience }: AudienceChipProps) {
  const isTeam = audience.audienceType === 'Team';
  const color = isTeam ? 'informative' : 'important';
  const label = audience.displayName ?? truncateId(audience.audienceId);

  return (
    <Badge
      appearance="tint"
      color={color}
      title={audience.displayName ?? audience.audienceId}
      aria-label={`${audience.audienceType}: ${audience.displayName ?? audience.audienceId}`}
    >
      {isTeam ? (
        <PeopleTeam20Regular style={{ fontSize: '12px', marginRight: '2px' }} />
      ) : (
        <People20Regular style={{ fontSize: '12px', marginRight: '2px' }} />
      )}
      {label}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DetailPanelProps {
  notificationId: string;
  onClose: () => void;
  onEdit: (id: string) => void;
  onCloneToCompose: (notification: NotificationDto) => void;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function DetailPanel({
  notificationId,
  onClose,
  onEdit,
  onCloneToCompose,
}: DetailPanelProps) {
  const styles = useStyles();
  const { t } = useTranslation();

  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const {
    data: notification,
    isLoading: notifLoading,
    isError: notifError,
  } = useNotification(notificationId);

  const { data: statusData } = useDeliveryStatus(notificationId);

  const cancelMutation = useCancelNotification();

  // Merge live polling data over the base notification snapshot
  const effectiveStatus: NotificationStatus =
    statusData?.status ?? notification?.status ?? 'Draft';
  const totalCount =
    statusData?.totalRecipientCount ?? notification?.totalRecipientCount ?? 0;
  const succeededCount =
    statusData?.succeededCount ?? notification?.succeededCount ?? 0;
  const failedCount =
    statusData?.failedCount ?? notification?.failedCount ?? 0;
  const canceledCount =
    statusData?.canceledCount ?? notification?.canceledCount ?? 0;

  const pendingCount = Math.max(
    0,
    totalCount - succeededCount - failedCount - canceledCount,
  );

  const deliveryProgress =
    totalCount > 0 ? succeededCount / totalCount : 0;
  const deliveryPercent = Math.round(deliveryProgress * 100);

  const isDraft = effectiveStatus === 'Draft';
  const isInProgress = IN_PROGRESS_STATUSES.includes(effectiveStatus);
  const isTerminal = TERMINAL_STATUSES.includes(effectiveStatus);
  const canEdit = isDraft;
  const canCancel =
    isInProgress || effectiveStatus === 'Scheduled';
  const canExport =
    effectiveStatus === 'Sent' || effectiveStatus === 'Failed';
  const showStats = !isDraft;
  const showProgress = isInProgress || isTerminal;

  const handleCancel = useCallback(async () => {
    setCancelError(null);
    try {
      await cancelMutation.mutateAsync(notificationId);
      setCancelDialogOpen(false);
    } catch (err) {
      setCancelError(
        err instanceof ApiResponseError
          ? err.message
          : t('errors.cancelFailed'),
      );
    }
  }, [notificationId, cancelMutation, t]);

  const handleExport = useCallback(() => {
    window.open(`/export/${notificationId}`, '_blank');
  }, [notificationId]);

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------

  if (notifLoading) {
    return (
      <div className={styles.root}>
        <div className={styles.loadingCenter}>
          <Spinner label={t('app.loading')} />
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Error state
  // ---------------------------------------------------------------------------

  if (notifError || !notification) {
    return (
      <div className={styles.root}>
        <div className={styles.header}>
          <div className={styles.headerContent} />
          <Button
            className={styles.headerClose}
            appearance="subtle"
            size="small"
            icon={<Dismiss20Regular />}
            onClick={onClose}
            aria-label={t('app.close')}
          />
        </div>
        <div className={styles.scrollArea}>
          <MessageBar intent="error">
            <MessageBarBody>{t('errors.loadFailed')}</MessageBarBody>
          </MessageBar>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Audience split
  // ---------------------------------------------------------------------------

  const channelAudiences = notification.audiences.filter(
    (a) => a.audienceType === 'Team',
  );
  const individualAudiences = notification.audiences.filter(
    (a) => a.audienceType === 'Roster' || a.audienceType === 'Group',
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className={styles.root} role="region" aria-label={notification.title}>
      {/* ------------------------------------------------------------------ */}
      {/* Header                                                               */}
      {/* ------------------------------------------------------------------ */}
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <Text
            size={400}
            weight="semibold"
            className={styles.headerTitle}
            as="h2"
          >
            {notification.title}
          </Text>
          <Badge
            color={statusToColor(effectiveStatus)}
            appearance="filled"
            aria-label={`Status: ${t(`status.${effectiveStatus}`)}`}
          >
            {t(`status.${effectiveStatus}`)}
          </Badge>
        </div>
        <Button
          className={styles.headerClose}
          appearance="subtle"
          size="small"
          icon={<Dismiss20Regular />}
          onClick={onClose}
          aria-label={t('app.close')}
        />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Scrollable body                                                      */}
      {/* ------------------------------------------------------------------ */}
      <div className={styles.scrollArea}>
        {/* Error message bar */}
        {notification.errorMessage && (
          <MessageBar intent="error">
            <MessageBarBody>
              <div className={styles.errorBox}>
                <Text size={200} font="monospace">
                  {notification.errorMessage}
                </Text>
              </div>
            </MessageBarBody>
          </MessageBar>
        )}

        {/* Auto-refresh indicator */}
        {isInProgress && (
          <div className={styles.autoRefreshRow} aria-live="polite">
            <Spinner size="extra-tiny" />
            <Text size={100}>{t('statusView.autoRefresh')}</Text>
          </div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Delivery stats — 2x2 grid                                         */}
        {/* ---------------------------------------------------------------- */}
        {showStats && (
          <div className={styles.section}>
            <Text size={100} className={styles.sectionLabel}>
              Delivery
            </Text>
            <div className={styles.statsGrid}>
              <StatCell
                icon={
                  <CheckmarkCircle20Regular
                    style={{ color: tokens.colorStatusSuccessForeground1 }}
                  />
                }
                label="Delivered"
                value={succeededCount}
                color={tokens.colorStatusSuccessForeground1}
              />
              <StatCell
                icon={
                  <ErrorCircle20Regular
                    style={{
                      color:
                        failedCount > 0
                          ? tokens.colorStatusDangerForeground1
                          : tokens.colorNeutralForeground3,
                    }}
                  />
                }
                label="Failed"
                value={failedCount}
                color={
                  failedCount > 0
                    ? tokens.colorStatusDangerForeground1
                    : undefined
                }
              />
              <StatCell
                icon={
                  <Clock20Regular
                    style={{ color: tokens.colorStatusWarningForeground1 }}
                  />
                }
                label="Pending"
                value={pendingCount}
                color={
                  pendingCount > 0
                    ? tokens.colorStatusWarningForeground1
                    : undefined
                }
              />
              <StatCell
                icon={
                  <Person20Regular
                    style={{ color: tokens.colorNeutralForeground3 }}
                  />
                }
                label="Total"
                value={totalCount}
              />
            </div>
          </div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Progress bar                                                       */}
        {/* ---------------------------------------------------------------- */}
        {showProgress && totalCount > 0 && (
          <div className={styles.section}>
            <div className={styles.progressHeader}>
              <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                {succeededCount.toLocaleString()} / {totalCount.toLocaleString()} delivered
              </Text>
              <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                {deliveryPercent}%
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
              aria-label={`Delivery progress: ${deliveryPercent}%`}
            />
          </div>
        )}

        {(showStats || showProgress) && <Divider />}

        {/* ---------------------------------------------------------------- */}
        {/* Audience section                                                   */}
        {/* ---------------------------------------------------------------- */}
        <div className={styles.section}>
          <Text size={100} className={styles.sectionLabel}>
            Audience
          </Text>

          {notification.allUsers ? (
            <div className={styles.allUsersBadge}>
              <Badge appearance="tint" color="brand" size="large">
                <People20Regular style={{ fontSize: '14px', marginRight: '4px' }} />
                All Users
              </Badge>
            </div>
          ) : notification.audiences.length === 0 ? (
            <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
              No audience selected
            </Text>
          ) : (
            <>
              {channelAudiences.length > 0 && (
                <>
                  <Text size={200} className={styles.audienceGroupLabel}>
                    Channel Posts
                  </Text>
                  <div className={styles.audienceChipRow}>
                    {channelAudiences.map((a) => (
                      <AudienceChip key={`${a.audienceType}-${a.audienceId}`} audience={a} />
                    ))}
                  </div>
                </>
              )}
              {individualAudiences.length > 0 && (
                <>
                  <Text size={200} className={styles.audienceGroupLabel}>
                    Individual Messages
                  </Text>
                  <div className={styles.audienceChipRow}>
                    {individualAudiences.map((a) => (
                      <AudienceChip key={`${a.audienceType}-${a.audienceId}`} audience={a} />
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>

        <Divider />

        {/* ---------------------------------------------------------------- */}
        {/* Timestamps                                                         */}
        {/* ---------------------------------------------------------------- */}
        <div className={styles.section}>
          <Text size={100} className={styles.sectionLabel}>
            Dates
          </Text>

          <div className={styles.timestampRow}>
            <Text size={200} className={styles.timestampLabel}>
              Created
            </Text>
            <Text size={200}>
              {formatTimestamp(notification.createdDate)}
            </Text>
          </div>

          {notification.sentDate && (
            <div className={styles.timestampRow}>
              <Text size={200} className={styles.timestampLabel}>
                Sent
              </Text>
              <Text size={200}>
                {formatTimestamp(notification.sentDate)}
              </Text>
            </div>
          )}

          {notification.scheduledDate && (
            <div className={styles.timestampRow}>
              <Text size={200} className={styles.timestampLabel}>
                Scheduled
              </Text>
              <Text size={200}>
                {formatTimestamp(notification.scheduledDate)}
              </Text>
            </div>
          )}

          {notification.createdBy && (
            <div className={styles.timestampRow}>
              <Text size={200} className={styles.timestampLabel}>
                Author
              </Text>
              <Text size={200}>{notification.author ?? notification.createdBy}</Text>
            </div>
          )}
        </div>

        <Divider />

        {/* ---------------------------------------------------------------- */}
        {/* Actions                                                            */}
        {/* ---------------------------------------------------------------- */}
        <div className={styles.actions}>
          <Text size={100} className={styles.sectionLabel}>
            Actions
          </Text>

          {cancelError && (
            <MessageBar intent="error">
              <MessageBarBody>{cancelError}</MessageBarBody>
              <MessageBarActions
                containerAction={
                  <Button
                    appearance="transparent"
                    size="small"
                    icon={<Dismiss12Regular />}
                    onClick={() => { setCancelError(null); }}
                    aria-label="Dismiss error"
                  />
                }
              />
            </MessageBar>
          )}

          <div className={styles.actionRow}>
            {/* Edit — Draft only */}
            {canEdit && (
              <Button
                appearance="secondary"
                icon={<Edit20Regular />}
                onClick={() => { onEdit(notificationId); }}
              >
                Edit
              </Button>
            )}

            {/* Cancel — in-progress or scheduled */}
            {canCancel && (
              <Dialog
                open={cancelDialogOpen}
                onOpenChange={(_e, d) => { setCancelDialogOpen(d.open); }}
              >
                <DialogTrigger disableButtonEnhancement>
                  <Button
                    appearance="secondary"
                    icon={<Dismiss20Regular />}
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
                        onClick={() => { void handleCancel(); }}
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

            {/* Export — Sent or Failed */}
            {canExport && (
              <Button
                appearance="secondary"
                icon={<ArrowExportUp20Regular />}
                onClick={handleExport}
              >
                {t('statusView.actions.export')}
              </Button>
            )}
          </div>

          {/* Use as template — always available */}
          <div className={styles.actionRow}>
            <Button
              appearance="subtle"
              icon={<Copy20Regular />}
              onClick={() => { onCloneToCompose(notification); }}
            >
              Use as template
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
