import { useState, useCallback, useEffect, lazy, Suspense } from 'react';
import { makeStyles, tokens } from '@fluentui/react-components';
import { ErrorBoundary } from '@/components/Layout/ErrorBoundary';
import { Sidebar } from '@/components/Sidebar/Sidebar';
import { MessageList } from '@/components/MessageList/MessageList';
import { HomeDashboard } from '@/components/HomeDashboard/HomeDashboard';
import { DetailPanel } from '@/components/DetailPanel/DetailPanel';
import type { ComposeFormValues } from '@/lib/validators';
import type { SidebarView, NotificationDto, KeyDetailPair, CustomVariable, AdvancedBlock, CardPreference } from '@/types';

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
    position: 'relative',
    backgroundColor: tokens.colorNeutralBackground1,
    gridTemplateColumns: '200px 1fr',
    maxWidth: '1400px',
    marginLeft: 'auto',
    marginRight: 'auto',
    boxShadow: tokens.shadow16,
  },
  contentArea: {
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  // Centered dialog backdrop for the detail panel
  detailBackdrop: {
    position: 'fixed',
    inset: 0,
    zIndex: 50,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorBackgroundOverlay,
    backdropFilter: 'blur(4px)',
    animationName: {
      from: { opacity: 0 },
      to: { opacity: 1 },
    },
    animationDuration: '200ms',
    animationTimingFunction: 'ease-out',
    animationFillMode: 'both',
  },
  // Centered dialog for the detail panel
  detailDialog: {
    position: 'relative',
    width: 'calc(100% - 48px)',
    maxWidth: '600px',
    maxHeight: '70vh',
    borderRadius: tokens.borderRadiusXLarge,
    boxShadow: tokens.shadow64,
    backgroundColor: tokens.colorNeutralBackground1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    animationName: {
      from: { opacity: 0, transform: 'scale(0.97)' },
      to: { opacity: 1, transform: 'scale(1)' },
    },
    animationDuration: '220ms',
    animationTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
    animationFillMode: 'both',
  },
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CommunicationCenter() {
  const styles = useStyles();

  const [activeView, setActiveView] = useState<SidebarView>('Home');
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeEditId, setComposeEditId] = useState<string | null>(null);
  const [cloneValues, setCloneValues] = useState<Partial<ComposeFormValues> | null>(null);

  const handleViewChange = useCallback((view: SidebarView) => {
    setActiveView(view);
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

  // Escape key closes the detail dialog (skip when compose is open — it has its own handler)
  useEffect(() => {
    if (!selectedMessageId || composeOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleCloseDetail();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('keydown', onKeyDown); };
  }, [selectedMessageId, composeOpen, handleCloseDetail]);

  const handleDeliveryDone = useCallback(() => {
    setComposeOpen(false);
    setComposeEditId(null);
    setCloneValues(null);
    setActiveView('Sent');
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

  // Determine whether to show Home or a message list tab
  const isHome = activeView === 'Home';

  return (
    <div className={styles.root} role="main">
      {/* Zone 1 — Sidebar */}
      <Sidebar
        activeView={activeView}
        onViewChange={handleViewChange}
        onComposeClick={() => { handleOpenCompose(); }}
      />

      {/* Zone 2 — Content area */}
      <ErrorBoundary>
        <div className={styles.contentArea}>
          {isHome ? (
            <HomeDashboard onNavigate={handleViewChange} />
          ) : (
            <MessageList
              activeTab={activeView}
              selectedMessageId={selectedMessageId}
              onSelectMessage={handleSelectMessage}
            />
          )}

          {/* Detail panel — centered dialog */}
          {selectedMessageId && (
            <div
              className={styles.detailBackdrop}
              onClick={(e) => { if (e.target === e.currentTarget) handleCloseDetail(); }}
              aria-hidden="true"
            >
              <div className={styles.detailDialog} role="dialog" aria-modal="true" aria-label="Message details">
                <DetailPanel
                  notificationId={selectedMessageId}
                  onClose={handleCloseDetail}
                  onEdit={handleOpenCompose}
                  onCloneToCompose={handleCloneToCompose}
                />
              </div>
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
