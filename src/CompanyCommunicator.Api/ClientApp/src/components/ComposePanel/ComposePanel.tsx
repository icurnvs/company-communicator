import { useCallback, useEffect, useRef, useState } from 'react';
import {
  makeStyles,
  tokens,
  Tab,
  TabList,
  Text,
  Button,
  Spinner,
} from '@fluentui/react-components';
import { Dismiss24Regular } from '@fluentui/react-icons';
import { useComposeForm } from './useComposeForm';
import { ActionBar } from './ActionBar';
import { ContentTab } from './ContentTab';
import { AudienceTab } from './AudienceTab';

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const SIDEBAR_WIDTH = 200; // px — matches the sidebar defined in CommunicationCenter

const useStyles = makeStyles({
  // Semi-transparent backdrop that sits behind the panel
  overlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: tokens.colorBackgroundOverlay,
    zIndex: 100,
    transition: 'opacity 300ms ease-out',
  },

  overlayVisible: {
    opacity: 1,
  },

  overlayHidden: {
    opacity: 0,
  },

  // The slide-over panel itself
  panel: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: `calc(100% - ${SIDEBAR_WIDTH}px)`,
    zIndex: 101,
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow64,
    transition: 'transform 300ms ease-out',
    overflow: 'hidden',
  },

  panelVisible: {
    transform: 'translateX(0)',
  },

  panelHidden: {
    transform: 'translateX(100%)',
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
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// ComposePanel
// ---------------------------------------------------------------------------

export function ComposePanel({ editId, onClose }: ComposePanelProps) {
  const styles = useStyles();

  // Mount-animation state: starts false, flips to true after the first
  // paint so the CSS transition fires on entry.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setMounted(true);
    });
    return () => { cancelAnimationFrame(raf); };
  }, []);

  // Active tab
  const [activeTab, setActiveTab] = useState<ComposePanelTab>('content');

  // ---------------------------------------------------------------------------
  // Form hook
  // ---------------------------------------------------------------------------

  const { form, isLoading, isSaving, saveDraft, isDirty, isEdit, notificationId, lastAutoSaved } =
    useComposeForm({ editId, onSaved: undefined });

  // Watch form values for the action bar (audience summary, headline-based enablement)
  const formValues = form.watch();
  const headline = formValues.headline;

  // ---------------------------------------------------------------------------
  // Close with dirty-check
  // ---------------------------------------------------------------------------

  const handleClose = useCallback(() => {
    if (isDirty) {
      const confirmed = window.confirm(
        'You have unsaved changes. Discard them and close?',
      );
      if (!confirmed) return;
    }
    onClose();
  }, [isDirty, onClose]);

  // Escape key handler
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('keydown', onKeyDown); };
  }, [handleClose]);

  // Trap focus inside the panel on mount
  useEffect(() => {
    if (mounted) {
      panelRef.current?.focus();
    }
  }, [mounted]);

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
        className={`${styles.overlay} ${mounted ? styles.overlayVisible : styles.overlayHidden}`}
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className={`${styles.panel} ${mounted ? styles.panelVisible : styles.panelHidden}`}
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
              onClick={handleClose}
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
          formValues={formValues}
          isSaving={isSaving}
          isEdit={isEdit}
          notificationId={notificationId}
          lastAutoSaved={lastAutoSaved}
          onSaveDraft={saveDraft}
        />
      </div>
    </>
  );
}
