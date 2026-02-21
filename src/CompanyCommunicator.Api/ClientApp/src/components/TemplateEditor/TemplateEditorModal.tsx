// components/TemplateEditor/TemplateEditorModal.tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { TemplateListView } from './TemplateListView';
import { TemplateEditor } from './TemplateEditor';

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const useStyles = makeStyles({
  overlay: {
    position: 'fixed',
    inset: 0,
    // z-index 200 so this stacks above ComposePanel (100) when opened from TemplatePicker
    zIndex: 200,
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

  panel: {
    position: 'relative',
    width: 'calc(100% - 48px)',
    maxWidth: '960px',
    height: 'calc(100vh - 80px)',
    maxHeight: '85vh',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusXLarge,
    boxShadow: tokens.shadow64,
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
// Props
// ---------------------------------------------------------------------------

export interface TemplateEditorModalProps {
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type EditorMode = { view: 'list' } | { view: 'editor'; editId: string | null };

export function TemplateEditorModal({ onClose }: TemplateEditorModalProps) {
  const styles = useStyles();
  const panelRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<EditorMode>({ view: 'list' });
  useFocusTrap(panelRef, mode.view === 'list');

  // Escape key closes (only in list mode — editor handles its own Escape).
  // stopImmediatePropagation prevents ComposePanel's document-level Escape
  // handler from also firing when the template editor is open on top of it.
  useEffect(() => {
    if (mode.view !== 'list') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('keydown', onKeyDown); };
  }, [mode.view, onClose]);

  const handleCreateNew = useCallback(() => {
    setMode({ view: 'editor', editId: null });
  }, []);

  const handleEdit = useCallback((templateId: string) => {
    setMode({ view: 'editor', editId: templateId });
  }, []);

  const handleBackToList = useCallback(() => {
    setMode({ view: 'list' });
  }, []);

  // When in editor mode, render the TemplateEditor directly (it has its own overlay)
  if (mode.view === 'editor') {
    return (
      <TemplateEditor
        editId={mode.editId}
        onClose={handleBackToList}
      />
    );
  }

  // List mode — show within the modal
  return (
    <div
      className={styles.overlay}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={panelRef}
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-label="Manage Templates"
        tabIndex={-1}
      >
        <TemplateListView
          onCreateNew={handleCreateNew}
          onEdit={handleEdit}
          onClose={onClose}
        />
      </div>
    </div>
  );
}
