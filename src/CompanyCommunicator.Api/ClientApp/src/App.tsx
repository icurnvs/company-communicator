import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Spinner } from '@fluentui/react-components';
import { AppLayout } from '@/components/Layout/AppLayout';

// Lazy load pages for code splitting
const NotificationList = lazy(() =>
  import('@/components/NotificationList/NotificationList').then((m) => ({
    default: m.NotificationList,
  })),
);

const StatusView = lazy(() =>
  import('@/components/StatusView/StatusView').then((m) => ({
    default: m.StatusView,
  })),
);

const NotificationForm = lazy(() =>
  import('@/components/NotificationForm/NotificationForm').then((m) => ({
    default: m.NotificationForm,
  })),
);

const ExportManager = lazy(() =>
  import('@/components/ExportManager/ExportManager').then((m) => ({
    default: m.ExportManager,
  })),
);

function PageLoader() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        minHeight: '200px',
      }}
    >
      <Spinner label="Loading..." />
    </div>
  );
}

export function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Main-frame routes (shown in the Teams tab) */}
        <Route
          path="/"
          element={
            <AppLayout>
              <NotificationList />
            </AppLayout>
          }
        />
        <Route
          path="/notifications/:id"
          element={
            <AppLayout showNewButton={false}>
              <StatusView />
            </AppLayout>
          }
        />

        {/* Dialog routes (opened via Teams dialog.url.open()) */}
        <Route path="/compose" element={<NotificationForm />} />
        <Route path="/compose/:id" element={<NotificationForm />} />
        <Route
          path="/export/:notificationId"
          element={<ExportManager />}
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
