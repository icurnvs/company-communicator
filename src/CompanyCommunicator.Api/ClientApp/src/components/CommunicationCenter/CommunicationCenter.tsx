import { useState, useCallback, lazy, Suspense } from 'react';
import { makeStyles, tokens } from '@fluentui/react-components';
import { ErrorBoundary } from '@/components/Layout/ErrorBoundary';
import { Sidebar } from '@/components/Sidebar/Sidebar';
import { MessageList } from '@/components/MessageList/MessageList';
import { DetailPanel } from '@/components/DetailPanel/DetailPanel';
import type { ComposeFormValues } from '@/lib/validators';
import type { NotificationTab, NotificationDto, KeyDetailPair, CustomVariable, AdvancedBlock, CardPreference } from '@/types';

const ComposePanel = lazy(() =>
  import('@/components/ComposePanel/ComposePanel').then((m) => ({
    default: m.ComposePanel,
  })),
);

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const useStyles = makeStyles({
  root: {
    display: 'grid',
    height: '100vh',
    overflow: 'hidden',
    position: 'relative', // anchor for overlay panels
    backgroundColor: tokens.colorNeutralBackground1,
    // Fixed 2-column grid — detail panel is overlayed, not a third column
    gridTemplateColumns: '200px 1fr',
  },
  messageListArea: {
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    position: 'relative', // anchor for the detail panel overlay
  },
  // Detail panel slides in from the right, overlaying the message list
  detailOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: '360px',
    maxWidth: '100%',
    zIndex: 50,
    boxShadow: tokens.shadow16,
    borderLeft: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CommunicationCenterState {
  selectedTab: NotificationTab;
  selectedMessageId: string | null;
  composeOpen: boolean;
  composeEditId: string | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CommunicationCenter() {
  const styles = useStyles();

  const [selectedTab, setSelectedTab] = useState<NotificationTab>('Sent');
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeEditId, setComposeEditId] = useState<string | null>(null);
  const [cloneValues, setCloneValues] = useState<Partial<ComposeFormValues> | null>(null);

  const handleTabChange = useCallback((tab: NotificationTab) => {
    setSelectedTab(tab);
    setSelectedMessageId(null);
  }, []);

  const handleSelectMessage = useCallback((id: string | null) => {
    setSelectedMessageId(id);
  }, []);

  const handleOpenCompose = useCallback((editId: string | null = null) => {
    setComposeEditId(editId);
    setCloneValues(null);
    setComposeOpen(true);
  }, []);

  const handleCloseCompose = useCallback(() => {
    setComposeOpen(false);
    setComposeEditId(null);
    setCloneValues(null);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelectedMessageId(null);
  }, []);

  const handleDeliveryDone = useCallback(() => {
    setComposeOpen(false);
    setComposeEditId(null);
    setCloneValues(null);
    setSelectedTab('Sent');
  }, []);

  // "Use as template" — opens compose pre-filled with an existing notification's
  // content as a new draft (no editId so it creates a new notification on save).
  const handleCloneToCompose = useCallback((notification: NotificationDto) => {
    const parseJson = <T,>(raw: string | null, fallback: T): T => {
      if (!raw) return fallback;
      try { return JSON.parse(raw) as T; }
      catch { return fallback; }
    };

    // Parse custom variables from Record<string,string> to name/value pairs
    const parsedCustomVars = notification.customVariables
      ? (() => {
          try {
            const obj = JSON.parse(notification.customVariables) as Record<string, string>;
            return Object.entries(obj).map(([name, value]) => ({ name, value }));
          } catch { return null; }
        })()
      : null;

    const values: Partial<ComposeFormValues> = {
      headline: notification.title,
      body: notification.summary ?? '',
      imageLink: notification.imageLink ?? '',
      keyDetails: parseJson<KeyDetailPair[] | null>(notification.keyDetails, null),
      buttonTitle: notification.buttonTitle ?? '',
      buttonLink: notification.buttonLink ?? '',
      secondaryText: notification.secondaryText ?? '',
      customVariables: parsedCustomVars as CustomVariable[] | null,
      cardPreference: (notification.cardPreference as CardPreference) ?? 'Standard',
      advancedBlocks: parseJson<AdvancedBlock[] | null>(notification.advancedBlocks, null),
    };

    setCloneValues(values);
    setComposeEditId(null); // New draft, not editing the original
    setComposeOpen(true);
  }, []);

  return (
    <div className={styles.root} role="main">
      {/* Zone 1 — Sidebar */}
      <Sidebar
        activeTab={selectedTab}
        onTabChange={handleTabChange}
        onComposeClick={() => { handleOpenCompose(); }}
      />

      {/* Zone 2 — Message list + Detail panel overlay */}
      <ErrorBoundary>
        <div className={styles.messageListArea}>
          <MessageList
            activeTab={selectedTab}
            selectedMessageId={selectedMessageId}
            onSelectMessage={handleSelectMessage}
          />

          {/* Detail panel — overlays message list from the right */}
          {selectedMessageId && (
            <div className={styles.detailOverlay}>
              <DetailPanel
                notificationId={selectedMessageId}
                onClose={handleCloseDetail}
                onEdit={handleOpenCompose}
                onCloneToCompose={handleCloneToCompose}
              />
            </div>
          )}
        </div>
      </ErrorBoundary>

      {/* Compose slide-over — covers the main area when open */}
      {composeOpen && (
        <Suspense fallback={null}>
          <ComposePanel
            editId={composeEditId}
            initialValues={cloneValues}
            onClose={handleCloseCompose}
            onDeliveryDone={handleDeliveryDone}
          />
        </Suspense>
      )}
    </div>
  );
}
