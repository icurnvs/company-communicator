import { type ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  makeStyles,
  tokens,
  Text,
  Toolbar,
  ToolbarButton,
} from '@fluentui/react-components';
import { Add24Regular, Chat24Regular } from '@fluentui/react-icons';
import { useTranslation } from 'react-i18next';
import { ErrorBoundary } from './ErrorBoundary';
import { dialog } from '@microsoft/teams-js';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    backgroundColor: tokens.colorNeutralBackground1,
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalL}`,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
    minHeight: '48px',
    flexShrink: 0,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
  },
  headerTitle: {
    fontWeight: tokens.fontWeightSemibold,
  },
  content: {
    flex: 1,
    overflow: 'auto',
  },
});

interface AppLayoutProps {
  children: ReactNode;
  showNewButton?: boolean;
}

export function AppLayout({ children, showNewButton = true }: AppLayoutProps) {
  const styles = useStyles();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const handleNewNotification = () => {
    // Open the compose form as a Teams dialog
    const baseUrl = window.location.origin;
    dialog.url.open(
      {
        url: `${baseUrl}/clientapp/compose`,
        title: t('notificationForm.title'),
        size: { height: 700, width: 900 },
      },
      () => {
        // Refresh when dialog closes
        void navigate(location.pathname, { replace: true });
      },
    );
  };

  return (
    <div className={styles.root}>
      <header className={styles.header} role="banner">
        <div className={styles.headerLeft}>
          <Chat24Regular />
          <Text size={400} className={styles.headerTitle}>
            {t('app.title')}
          </Text>
        </div>
        {showNewButton && (
          <Toolbar>
            <ToolbarButton
              appearance="primary"
              icon={<Add24Regular />}
              onClick={handleNewNotification}
              aria-label={t('notificationList.newButton')}
            >
              {t('notificationList.newButton')}
            </ToolbarButton>
          </Toolbar>
        )}
      </header>
      <main className={styles.content} role="main">
        <ErrorBoundary>{children}</ErrorBoundary>
      </main>
    </div>
  );
}
