import { useCallback, useState } from 'react';
import {
  makeStyles,
  tokens,
  Button,
  Text,
  Badge,
  Caption1,
  Divider,
  MessageBar,
  MessageBarBody,
  Spinner,
} from '@fluentui/react-components';
import {
  Dismiss24Regular,
  Send16Regular,
  CheckmarkCircle16Regular,
} from '@fluentui/react-icons';
import { AdaptiveCardPreview } from '@/components/AdaptiveCardPreview/AdaptiveCardPreview';
import { buildCardPayload } from '@/lib/adaptiveCard';
import type { CardData } from '@/lib/adaptiveCard';
import type { ComposeFormValues } from '@/lib/validators';
import type { AudienceDto } from '@/types';
import { DeliveryTracker } from './DeliveryTracker';

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const useStyles = makeStyles({
  overlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: tokens.colorBackgroundOverlay,
    zIndex: 200,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  dialog: {
    width: '520px',
    maxWidth: '90%',
    maxHeight: '85vh',
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusXLarge,
    boxShadow: tokens.shadow64,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },

  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalL}`,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    flexShrink: 0,
  },

  body: {
    flex: 1,
    overflowY: 'auto',
    padding: tokens.spacingHorizontalL,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },

  previewContainer: {
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    padding: tokens.spacingHorizontalM,
    maxHeight: '300px',
    overflowY: 'auto',
    backgroundColor: tokens.colorNeutralBackground2,
  },

  audienceSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
  },

  audienceGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXXS,
  },

  chipRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: tokens.spacingHorizontalXS,
  },

  reachBox: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    padding: tokens.spacingHorizontalM,
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
  },

  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: tokens.spacingHorizontalS,
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalL}`,
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    flexShrink: 0,
  },
});

// ---------------------------------------------------------------------------
// Audience helpers
// ---------------------------------------------------------------------------

function categorizeAudiences(audiences: AudienceDto[] | null | undefined) {
  const list = audiences ?? [];
  const channelPosts = list.filter((a) => a.audienceType === 'Team');
  const individuals = list.filter((a) => a.audienceType !== 'Team');
  return { channelPosts, individuals };
}

function estimateReach(allUsers: boolean, audiences: AudienceDto[] | null | undefined): number | null {
  if (allUsers) return null;
  const list = audiences ?? [];
  if (list.length === 0) return null;
  return list.reduce((sum, a) => {
    if (a.audienceType === 'Team') return sum + 50;
    if (a.audienceType === 'Group') return sum + 30;
    return sum + 20;
  }, 0);
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ConfirmSendDialogProps {
  formValues: ComposeFormValues;
  notificationId: string | null;
  onSaveDraft: () => Promise<string | undefined>;
  onConfirmSend: (id: string) => Promise<void>;
  onClose: () => void;
  /** Called when delivery tracker hits Done — close compose and navigate to Sent. */
  onDeliveryDone: () => void;
}

// ---------------------------------------------------------------------------
// ConfirmSendDialog
// ---------------------------------------------------------------------------

type DialogPhase = 'review' | 'sending';

export function ConfirmSendDialog({
  formValues,
  notificationId,
  onSaveDraft,
  onConfirmSend,
  onClose,
  onDeliveryDone,
}: ConfirmSendDialogProps) {
  const styles = useStyles();
  const [phase, setPhase] = useState<DialogPhase>('review');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentNotificationId, setSentNotificationId] = useState<string | null>(null);

  const { channelPosts, individuals } = categorizeAudiences(formValues.audiences);
  const reach = estimateReach(formValues.allUsers, formValues.audiences);

  // Build card preview data
  const cardData: CardData = {
    title: formValues.headline ?? '',
    summary: formValues.body,
    imageLink: formValues.imageLink,
    keyDetails: formValues.keyDetails,
    buttonTitle: formValues.buttonTitle,
    buttonLink: formValues.buttonLink,
    secondaryText: formValues.secondaryText,
    customVariables: formValues.customVariables,
    advancedBlocks: formValues.advancedBlocks,
  };

  const handleConfirmSend = useCallback(async () => {
    setIsSending(true);
    setError(null);

    try {
      // Save the notification first (create or update)
      let id = notificationId;
      if (!id) {
        id = await onSaveDraft() ?? null;
      }
      if (!id) {
        setError('Failed to save notification before sending.');
        setIsSending(false);
        return;
      }

      // Trigger send
      await onConfirmSend(id);
      setSentNotificationId(id);
      setPhase('sending');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while sending.');
    } finally {
      setIsSending(false);
    }
  }, [notificationId, onSaveDraft, onConfirmSend]);

  // Prevent closing during send
  const handleOverlayClick = useCallback(() => {
    if (phase === 'review') {
      onClose();
    }
  }, [phase, onClose]);

  return (
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div
        className={styles.dialog}
        onClick={(e) => { e.stopPropagation(); }}
        role="dialog"
        aria-modal="true"
        aria-label={phase === 'review' ? 'Review & Send' : 'Sending...'}
      >
        {/* Header */}
        <div className={styles.header}>
          <Text weight="semibold" size={400}>
            {phase === 'review' ? 'Review & Send' : 'Sending...'}
          </Text>
          {phase === 'review' && (
            <Button
              appearance="subtle"
              icon={<Dismiss24Regular />}
              onClick={onClose}
              aria-label="Close"
            />
          )}
        </div>

        {/* Body */}
        <div className={styles.body}>
          {phase === 'review' ? (
            <>
              {/* Card Preview */}
              <div className={styles.previewContainer}>
                <AdaptiveCardPreview data={cardData} />
              </div>

              {/* Audience summary */}
              <div className={styles.audienceSection}>
                <Text weight="semibold" size={300}>Audience</Text>

                {formValues.allUsers ? (
                  <div className={styles.chipRow}>
                    <Badge appearance="tint" color="informative" size="medium">
                      All Users
                    </Badge>
                  </div>
                ) : (
                  <>
                    {channelPosts.length > 0 && (
                      <div className={styles.audienceGroup}>
                        <Caption1>Channel Posts:</Caption1>
                        <div className={styles.chipRow}>
                          {channelPosts.map((a) => (
                            <Badge key={a.audienceId} appearance="tint" color="brand" size="small">
                              {a.audienceId}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {individuals.length > 0 && (
                      <div className={styles.audienceGroup}>
                        <Caption1>Individual Messages:</Caption1>
                        <div className={styles.chipRow}>
                          {individuals.map((a) => (
                            <Badge key={a.audienceId} appearance="tint" color="subtle" size="small">
                              {a.audienceId} ({a.audienceType})
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Estimated reach */}
              <div className={styles.reachBox}>
                <CheckmarkCircle16Regular />
                <Text size={300}>
                  {formValues.allUsers
                    ? 'This message will reach all users in your organization'
                    : reach !== null
                      ? `This message will reach ~${reach.toLocaleString()} people`
                      : 'No audience selected'}
                </Text>
              </div>

              {/* Error */}
              {error && (
                <MessageBar intent="error">
                  <MessageBarBody>{error}</MessageBarBody>
                </MessageBar>
              )}
            </>
          ) : (
            /* Delivery Tracker */
            sentNotificationId && (
              <DeliveryTracker
                notificationId={sentNotificationId}
                onDone={onDeliveryDone}
              />
            )
          )}
        </div>

        {/* Footer — only in review phase */}
        {phase === 'review' && (
          <div className={styles.footer}>
            <Button appearance="secondary" onClick={onClose} disabled={isSending}>
              Cancel
            </Button>
            <Button
              appearance="primary"
              icon={isSending ? <Spinner size="tiny" /> : <Send16Regular />}
              onClick={() => { void handleConfirmSend(); }}
              disabled={isSending}
            >
              {isSending ? 'Sending...' : 'Confirm & Send'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
