import { useState, useCallback } from 'react';
import { makeStyles, tokens } from '@fluentui/react-components';
import { ErrorBoundary } from '@/components/Layout/ErrorBoundary';
import { Sidebar } from '@/components/Sidebar/Sidebar';
import { MessageList } from '@/components/MessageList/MessageList';
import { DetailPanel } from '@/components/DetailPanel/DetailPanel';
import { ComposePanel } from '@/components/ComposePanel/ComposePanel';
import type { NotificationTab, NotificationDto } from '@/types';

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
      setComposeOpen(true);
    },
    onCloseCompose: () => {
      setComposeOpen(false);
      setComposeEditId(null);
    },
  };

  // "Use as template" — opens compose pre-filled with an existing notification's
  // content as a new draft (no editId so it creates a new notification on save).
  const handleCloneToCompose = useCallback((_notification: NotificationDto) => {
    // For now, open a new compose. Task 18 will implement full content cloning.
    actions.onOpenCompose(null);
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
