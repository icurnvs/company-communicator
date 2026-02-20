import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  makeStyles,
  tokens,
  Button,
  Text,
  Badge,
  Caption1,
  MessageBar,
  MessageBarBody,
  Spinner,
} from '@fluentui/react-components';
import {
  Dismiss24Regular,
  Send16Regular,
  CheckmarkCircle16Regular,
} from '@fluentui/react-icons';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import type { ComposeFormValues } from '@/lib/validators';
import { estimateReach } from '@/lib/audienceUtils';
import type { AudienceDto } from '@/types';
import { getTemplateById } from '@/lib/templateDefinitions';
import { BUILTIN_TEMPLATE_DEFINITIONS } from '@/lib/templateDefinitions';
import { getThemeById, DEFAULT_THEME_ID } from '@/lib/builtinThemes';
import { formValuesToCardDocument } from '@/lib/formBridge';
import { buildCardFromDocument } from '@/lib/cardPipeline';
import { CardPreviewPanel } from './CardPreviewPanel';
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

  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, true);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  const { channelPosts, individuals } = categorizeAudiences(formValues.audiences);
  const reach = estimateReach(formValues.allUsers, formValues.audiences);

  // Build card preview via the new pipeline
  const template = useMemo(
    () => getTemplateById(formValues.templateId ?? '') ?? BUILTIN_TEMPLATE_DEFINITIONS[0]!,
    [formValues.templateId],
  );
  const cardTheme = useMemo(
    () => getThemeById(formValues.themeId ?? DEFAULT_THEME_ID),
    [formValues.themeId],
  );
  const previewResult = useMemo(() => {
    const doc = formValuesToCardDocument(
      formValues,
      template,
      formValues.themeId,
      formValues.slotVisibility,
    );
    const customVars = formValues.customVariables
      ?.filter((v) => v.name)
      .map((v) => ({ name: v.name, value: v.value || `{{${v.name}}}` }));
    try {
      return buildCardFromDocument(doc, customVars);
    } catch {
      return null;
    }
  }, [formValues, template]);

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

  const handleOverlayClick = useCallback(() => {
    if (phase === 'review') {
      onClose();
    }
    // During sending phase, allow closing — delivery continues in background
    if (phase === 'sending') {
      onDeliveryDone();
    }
  }, [phase, onClose, onDeliveryDone]);

  return (
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div
        ref={dialogRef}
        className={styles.dialog}
        onClick={(e) => { e.stopPropagation(); }}
        role="dialog"
        aria-modal="true"
        aria-label={phase === 'review' ? 'Review & Send' : 'Sending...'}
        tabIndex={-1}
      >
        {/* Header */}
        <div className={styles.header}>
          <Text weight="semibold" size={400}>
            {phase === 'review' ? 'Review & Send' : 'Sending...'}
          </Text>
          <Button
            appearance="subtle"
            icon={<Dismiss24Regular />}
            onClick={phase === 'review' ? onClose : onDeliveryDone}
            aria-label="Close"
          />
        </div>

        {/* Body */}
        <div className={styles.body}>
          {phase === 'review' ? (
            <>
              {/* Card Preview */}
              <div className={styles.previewContainer}>
                <CardPreviewPanel
                  cardPayload={previewResult?.cardPayload ?? null}
                  cardTheme={cardTheme}
                />
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
                              {a.displayName ?? a.audienceId}
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
                              {a.displayName ?? a.audienceId} ({a.audienceType})
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
