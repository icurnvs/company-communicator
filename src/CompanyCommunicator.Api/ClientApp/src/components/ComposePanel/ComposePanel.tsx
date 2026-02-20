import { useCallback, useEffect, useRef, useState } from 'react';
import {
  makeStyles,
  tokens,
  Tab,
  TabList,
  Text,
  Button,
  Spinner,
  Dialog,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@fluentui/react-components';
import { Dismiss24Regular } from '@fluentui/react-icons';
import { useSendNotification } from '@/api/notifications';
import { useComposeForm } from './useComposeForm';
import { ActionBar } from './ActionBar';
import { ContentTab } from './ContentTab';
import { AudienceTab } from './AudienceTab';
import { ConfirmSendDialog } from './ConfirmSendDialog';

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const SIDEBAR_WIDTH = 200; // px — matches the sidebar defined in CommunicationCenter
const MAX_PANEL_WIDTH = 1200; // px — prevent over-stretching on ultra-wide monitors

const useStyles = makeStyles({
  // Semi-transparent backdrop that sits behind the panel
  overlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: tokens.colorBackgroundOverlay,
    zIndex: 100,
  },

  // The slide-over panel itself
  panel: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: `calc(100% - ${SIDEBAR_WIDTH}px)`,
    maxWidth: `${MAX_PANEL_WIDTH}px`,
    zIndex: 101,
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow64,
    overflow: 'hidden',
  },

  // Panel header
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalL}`,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    flexShrink: 0,
    gap: tokens.spacingHorizontalM,
    minHeight: '56px',
  },

  headerTitle: {
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase400,
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: tokens.colorNeutralForeground1,
  },

  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    flexShrink: 0,
  },

  // Tab bar below the header
  tabBar: {
    padding: `0 ${tokens.spacingHorizontalL}`,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    flexShrink: 0,
  },

  // Scrollable body that grows to fill available height
  body: {
    flex: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
  },
});

// ---------------------------------------------------------------------------
// Tab type
// ---------------------------------------------------------------------------

type ComposePanelTab = 'content' | 'audience';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ComposePanelProps {
  editId?: string | null;
  /** Pre-fill the form with cloned content (used for "Use as template"). */
  initialValues?: Partial<import('@/lib/validators').ComposeFormValues> | null;
  onClose: () => void;
  /** Called after delivery is done — close compose and navigate to Sent tab. */
  onDeliveryDone?: () => void;
}

// ---------------------------------------------------------------------------
// ComposePanel
// ---------------------------------------------------------------------------

export function ComposePanel({ editId, initialValues, onClose, onDeliveryDone }: ComposePanelProps) {
  const styles = useStyles();

  // Active tab
  const [activeTab, setActiveTab] = useState<ComposePanelTab>('content');

  // Confirm send dialog state
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Discard-changes dialog state (replaces window.confirm which is blocked in Teams)
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);

  // ---------------------------------------------------------------------------
  // Form hook
  // ---------------------------------------------------------------------------

  const { form, isLoading, isSaving, saveDraft, isDirty, isEdit, notificationId, lastAutoSaved } =
    useComposeForm({ editId, onSaved: undefined, initialValues });

  // Only watch headline for the panel title — ActionBar watches everything it
  // needs internally, so ComposePanel doesn't re-render on every keystroke (M4).
  const headline = form.watch('headline');

  // Send mutation
  const sendMutation = useSendNotification();

  // ---------------------------------------------------------------------------
  // Close with dirty-check
  // ---------------------------------------------------------------------------

  const requestClose = useCallback(() => {
    if (isDirty) {
      setShowDiscardDialog(true);
    } else {
      onClose();
    }
  }, [isDirty, onClose]);

  // Escape key handler
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showConfirmDialog || showDiscardDialog) return;
        requestClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('keydown', onKeyDown); };
  }, [requestClose, showConfirmDialog, showDiscardDialog]);

  // Focus panel on mount
  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  // ---------------------------------------------------------------------------
  // Confirm & Send handlers
  // ---------------------------------------------------------------------------

  const handleReview = useCallback(() => {
    setShowConfirmDialog(true);
  }, []);

  const handleConfirmSend = useCallback(async (id: string) => {
    await sendMutation.mutateAsync(id);
  }, [sendMutation]);

  const handleDeliveryDone = useCallback(() => {
    setShowConfirmDialog(false);
    onDeliveryDone?.();
    onClose();
  }, [onDeliveryDone, onClose]);

  // ---------------------------------------------------------------------------
  // Derive title
  // ---------------------------------------------------------------------------

  const panelTitle = isEdit && headline
    ? `Edit: ${headline}`
    : isEdit
    ? 'Edit Message'
    : 'New Message';

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      {/* Overlay */}
      <div
        className={styles.overlay}
        onClick={requestClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-label={panelTitle}
        tabIndex={-1}
      >
        {/* Header */}
        <div className={styles.header}>
          <Text className={styles.headerTitle} title={panelTitle}>
            {panelTitle}
          </Text>

          <div className={styles.headerActions}>
            {isSaving && <Spinner size="tiny" label="Saving..." labelPosition="before" />}
            <Button
              appearance="subtle"
              icon={<Dismiss24Regular />}
              onClick={requestClose}
              aria-label="Close compose panel"
            />
          </div>
        </div>

        {/* Tab bar */}
        <div className={styles.tabBar}>
          <TabList
            selectedValue={activeTab}
            onTabSelect={(_e, data) => {
              setActiveTab(data.value as ComposePanelTab);
            }}
            aria-label="Compose sections"
          >
            <Tab value="content">Content</Tab>
            <Tab value="audience">Audience</Tab>
          </TabList>
        </div>

        {/* Body */}
        <div className={styles.body}>
          {isLoading ? (
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Spinner label="Loading message..." />
            </div>
          ) : (
            <>
              {activeTab === 'content' && <ContentTab form={form} isEdit={isEdit} />}

              {activeTab === 'audience' && <AudienceTab form={form} />}
            </>
          )}
        </div>

        {/* Action bar */}
        <ActionBar
          form={form}
          isSaving={isSaving}
          isEdit={isEdit}
          notificationId={notificationId}
          lastAutoSaved={lastAutoSaved}
          onSaveDraft={saveDraft}
          onReview={handleReview}
        />

        {/* Confirm Send Dialog — snapshot form values at render time */}
        {showConfirmDialog && (
          <ConfirmSendDialog
            formValues={form.getValues()}
            notificationId={notificationId}
            onSaveDraft={saveDraft}
            onConfirmSend={handleConfirmSend}
            onClose={() => { setShowConfirmDialog(false); }}
            onDeliveryDone={handleDeliveryDone}
          />
        )}
      </div>

      {/* Discard changes dialog (replaces window.confirm which is blocked in Teams iframes) */}
      <Dialog
        open={showDiscardDialog}
        onOpenChange={(_e, data) => { setShowDiscardDialog(data.open); }}
      >
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Unsaved changes</DialogTitle>
            <DialogContent>
              You have unsaved changes. Discard them and close?
            </DialogContent>
            <DialogActions>
              <Button
                appearance="secondary"
                onClick={() => { setShowDiscardDialog(false); }}
              >
                Keep editing
              </Button>
              <Button
                appearance="primary"
                onClick={() => {
                  setShowDiscardDialog(false);
                  onClose();
                }}
              >
                Discard
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </>
  );
}
