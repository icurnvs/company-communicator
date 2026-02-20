import { useState, useCallback } from 'react';
import { makeStyles, tokens } from '@fluentui/react-components';
import { ErrorBoundary } from '@/components/Layout/ErrorBoundary';
import { Sidebar } from '@/components/Sidebar/Sidebar';
import { MessageList } from '@/components/MessageList/MessageList';
import { DetailPanel } from '@/components/DetailPanel/DetailPanel';
import { ComposePanel } from '@/components/ComposePanel/ComposePanel';
import type { ComposeFormValues } from '@/lib/validators';
import type { NotificationTab, NotificationDto, KeyDetailPair, CustomVariable, AdvancedBlock, CardPreference } from '@/types';

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const useStyles = makeStyles({
  root: {
    display: 'grid',
    height: '100vh',
    overflow: 'hidden',
    position: 'relative', // anchor for compose slide-over absolute positioning
    backgroundColor: tokens.colorNeutralBackground1,
    // Default: sidebar + message list only; detail panel added dynamically via
    // inline style when a message is selected.
    gridTemplateColumns: '200px 1fr',
  },
  rootWithDetail: {
    gridTemplateColumns: '200px 1fr 320px',
  },
  messageListArea: {
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    borderRight: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  detailPanelArea: {
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

// Callback props exposed so child components wired in Tasks 7–9 can drive
// top-level state without prop-drilling through the layout.
export interface CommunicationCenterActions {
  onTabChange: (tab: NotificationTab) => void;
  onSelectMessage: (id: string | null) => void;
  onOpenCompose: (editId?: string | null) => void;
  onCloseCompose: () => void;
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

  const hasDetail = selectedMessageId !== null;

  // Actions passed down to child zones
  const actions: CommunicationCenterActions = {
    onTabChange: (tab) => {
      setSelectedTab(tab);
      // Clear selection when switching tabs so the detail panel collapses.
      setSelectedMessageId(null);
    },
    onSelectMessage: (id) => {
      setSelectedMessageId(id);
    },
    onOpenCompose: (editId = null) => {
      setComposeEditId(editId ?? null);
      setCloneValues(null);
      setComposeOpen(true);
    },
    onCloseCompose: () => {
      setComposeOpen(false);
      setComposeEditId(null);
      setCloneValues(null);
    },
  };

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
    <div
      className={hasDetail ? `${styles.root} ${styles.rootWithDetail}` : styles.root}
      role="main"
    >
      {/* Zone 1 — Sidebar */}
      <Sidebar
        activeTab={selectedTab}
        onTabChange={actions.onTabChange}
        onComposeClick={() => actions.onOpenCompose()}
      />

      {/* Zone 2 — Message list */}
      <ErrorBoundary>
        <div className={styles.messageListArea}>
          <MessageList
            activeTab={selectedTab}
            selectedMessageId={selectedMessageId}
            onSelectMessage={actions.onSelectMessage}
            onOpenCompose={actions.onOpenCompose}
          />
        </div>
      </ErrorBoundary>

      {/* Zone 3 — Detail panel (only rendered when a message is selected) */}
      {hasDetail && selectedMessageId && (
        <ErrorBoundary>
          <div className={styles.detailPanelArea}>
            <DetailPanel
              notificationId={selectedMessageId}
              onClose={() => actions.onSelectMessage(null)}
              onEdit={(id) => actions.onOpenCompose(id)}
              onCloneToCompose={handleCloneToCompose}
            />
          </div>
        </ErrorBoundary>
      )}

      {/* Compose slide-over — covers Zones 2 + 3 when open */}
      {composeOpen && (
        <ComposePanel
          editId={composeEditId}
          initialValues={cloneValues}
          onClose={actions.onCloseCompose}
          onDeliveryDone={() => {
            actions.onCloseCompose();
            setSelectedTab('Sent');
          }}
        />
      )}
    </div>
  );
}
