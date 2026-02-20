import {
  makeStyles,
  tokens,
  Button,
  Text,
  Caption1,
  ProgressBar,
} from '@fluentui/react-components';
import {
  CheckmarkCircle24Regular,
  DismissCircle24Regular,
} from '@fluentui/react-icons';
import { useDeliveryStatus } from '@/api/notifications';
import { TERMINAL_STATUSES } from '@/types';
import type { NotificationStatus } from '@/types';

// ---------------------------------------------------------------------------
// Status label mapping
// ---------------------------------------------------------------------------

const STATUS_LABELS: Record<NotificationStatus, string> = {
  Draft: 'Preparing...',
  Queued: 'Queuing...',
  Scheduled: 'Scheduled',
  SyncingRecipients: 'Syncing recipients...',
  InstallingApp: 'Installing app...',
  Sending: 'Sending...',
  Sent: 'Delivered',
  Canceled: 'Canceled',
  Failed: 'Delivery failed',
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: tokens.spacingVerticalL,
    padding: tokens.spacingVerticalXL,
  },

  progressRing: {
    position: 'relative',
    width: '120px',
    height: '120px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  svgRing: {
    position: 'absolute',
    inset: 0,
  },

  percentText: {
    fontSize: '28px',
    fontWeight: tokens.fontWeightBold,
    lineHeight: 1,
  },

  counters: {
    display: 'flex',
    gap: tokens.spacingHorizontalXL,
    justifyContent: 'center',
  },

  counter: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: tokens.spacingVerticalXXS,
  },

  counterValue: {
    fontSize: tokens.fontSizeBase500,
    fontWeight: tokens.fontWeightSemibold,
  },

  statusRow: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
  },

  successIcon: {
    color: tokens.colorPaletteGreenForeground1,
  },

  failIcon: {
    color: tokens.colorPaletteRedForeground1,
  },

  // Fallback progress bar for indeterminate states
  linearProgress: {
    width: '100%',
    maxWidth: '300px',
  },
});

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DeliveryTrackerProps {
  notificationId: string;
  onDone: () => void;
}

// ---------------------------------------------------------------------------
// DeliveryTracker
// ---------------------------------------------------------------------------

export function DeliveryTracker({ notificationId, onDone }: DeliveryTrackerProps) {
  const styles = useStyles();
  const { data: status } = useDeliveryStatus(notificationId);

  const total = status?.totalRecipientCount ?? 0;
  const succeeded = status?.succeededCount ?? 0;
  const failed = status?.failedCount ?? 0;
  const remaining = Math.max(0, total - succeeded - failed);
  const percentage = total > 0 ? Math.round((succeeded / total) * 100) : 0;

  const currentStatus = status?.status ?? 'Queued';
  const isTerminal = TERMINAL_STATUSES.includes(currentStatus);
  const isSent = currentStatus === 'Sent';
  const isFailed = currentStatus === 'Failed';

  // Ring SVG constants
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  // Ring color
  const ringColor = isFailed
    ? tokens.colorPaletteRedBorder1
    : isSent
      ? tokens.colorPaletteGreenBorder1
      : tokens.colorBrandStroke1;

  return (
    <div className={styles.root}>
      {/* Progress ring */}
      <div className={styles.progressRing}>
        <svg className={styles.svgRing} viewBox="0 0 120 120">
          {/* Background circle */}
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke={tokens.colorNeutralStroke2}
            strokeWidth="8"
          />
          {/* Progress circle */}
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke={ringColor}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            transform="rotate(-90 60 60)"
            style={{ transition: 'stroke-dashoffset 500ms ease, stroke 300ms ease' }}
          />
        </svg>
        <Text className={styles.percentText}>{percentage}%</Text>
      </div>

      {/* Counters */}
      <div className={styles.counters}>
        <div className={styles.counter}>
          <Text className={styles.counterValue} style={{ color: tokens.colorPaletteGreenForeground1 }}>
            {succeeded.toLocaleString()}
          </Text>
          <Caption1>Delivered</Caption1>
        </div>
        <div className={styles.counter}>
          <Text className={styles.counterValue} style={{ color: tokens.colorPaletteRedForeground1 }}>
            {failed.toLocaleString()}
          </Text>
          <Caption1>Failed</Caption1>
        </div>
        <div className={styles.counter}>
          <Text className={styles.counterValue}>
            {remaining.toLocaleString()}
          </Text>
          <Caption1>Remaining</Caption1>
        </div>
      </div>

      {/* Status label */}
      <div className={styles.statusRow}>
        {isSent && <CheckmarkCircle24Regular className={styles.successIcon} />}
        {isFailed && <DismissCircle24Regular className={styles.failIcon} />}
        <Text size={400} weight={isTerminal ? 'semibold' : 'regular'}>
          {isSent
            ? `Delivered to ${succeeded.toLocaleString()} people`
            : STATUS_LABELS[currentStatus] ?? currentStatus}
        </Text>
      </div>

      {/* Linear progress for non-terminal, non-percentage states */}
      {!isTerminal && total === 0 && (
        <ProgressBar className={styles.linearProgress} />
      )}

      {/* Done button — appears when terminal */}
      {isTerminal && (
        <Button
          appearance="primary"
          onClick={onDone}
          size="large"
        >
          Done
        </Button>
      )}
    </div>
  );
}
