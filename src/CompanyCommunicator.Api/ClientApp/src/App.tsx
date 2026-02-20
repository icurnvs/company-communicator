import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Spinner } from '@fluentui/react-components';
import { CommunicationCenter } from '@/components/CommunicationCenter/CommunicationCenter';

// Lazy load dialog pages for code splitting
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
        {/* Main Teams tab — Communication Center layout */}
        <Route path="/" element={<CommunicationCenter />} />

        {/* Dialog route — opened via Teams dialog.url.open() for CSV export */}
        <Route path="/export/:notificationId" element={<ExportManager />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
