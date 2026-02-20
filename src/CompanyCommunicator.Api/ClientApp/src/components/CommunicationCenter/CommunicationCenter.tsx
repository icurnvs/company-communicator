import { useState } from 'react';
import { makeStyles, tokens } from '@fluentui/react-components';
import { ErrorBoundary } from '@/components/Layout/ErrorBoundary';
import { Sidebar } from '@/components/Sidebar/Sidebar';
import type { NotificationTab } from '@/types';

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const useStyles = makeStyles({
  root: {
    display: 'grid',
    height: '100vh',
    overflow: 'hidden',
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
  placeholder: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: tokens.colorNeutralForeground3,
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
          {/*
           * Task 7 will replace this placeholder with <MessageList />.
           * Props to pass:
           *   activeTab={selectedTab}
           *   selectedMessageId={selectedMessageId}
           *   onSelectMessage={actions.onSelectMessage}
           *   composeOpen={composeOpen}
           *   composeEditId={composeEditId}
           *   onCloseCompose={actions.onCloseCompose}
           *   onOpenCompose={actions.onOpenCompose}
           */}
          <div className={styles.placeholder}>
            Message list — Task 7
          </div>
        </div>
      </ErrorBoundary>

      {/* Zone 3 — Detail panel (only rendered when a message is selected) */}
      {hasDetail && (
        <ErrorBoundary>
          <div className={styles.detailPanelArea}>
            {/*
             * Task 8 will replace this placeholder with <DetailPanel />.
             * Props to pass:
             *   notificationId={selectedMessageId}
             *   onClose={() => actions.onSelectMessage(null)}
             *   onEdit={(id) => actions.onOpenCompose(id)}
             */}
            <div className={styles.placeholder}>
              Detail panel — Task 8
            </div>
          </div>
        </ErrorBoundary>
      )}

      {/*
       * Task 9 will add the compose slide-over here, conditionally rendered
       * when composeOpen is true and covering Zones 2 + 3.
       * State available: composeOpen={composeOpen}, composeEditId={composeEditId}
       * Actions: onClose={actions.onCloseCompose}
       */}
    </div>
  );
}
