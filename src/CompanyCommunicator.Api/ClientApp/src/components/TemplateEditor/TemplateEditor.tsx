// components/TemplateEditor/TemplateEditor.tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  makeStyles,
  tokens,
  Text,
  Button,
  Spinner,
  Dialog,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  DialogActions,
  MessageBar,
  MessageBarBody,
} from '@fluentui/react-components';
import { Dismiss24Regular, Save24Regular } from '@fluentui/react-icons';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useTemplateEditor } from './useTemplateEditor';
import { SlotListPanel } from './SlotListPanel';
import { SlotConfigPanel } from './SlotConfigPanel';
import { TemplatePreviewPanel } from './TemplatePreviewPanel';
import { TemplateMetadataForm } from './TemplateMetadataForm';

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

  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: tokens.spacingVerticalM,
    paddingBottom: tokens.spacingVerticalM,
    paddingLeft: tokens.spacingHorizontalL,
    paddingRight: tokens.spacingHorizontalL,
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: tokens.colorNeutralStroke2,
    flexShrink: 0,
    gap: tokens.spacingHorizontalM,
    minHeight: '56px',
  },

  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    flex: 1,
    overflow: 'hidden',
  },

  headerTitle: {
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase400,
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

  body: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
    minHeight: 0,
  },

  leftPanel: {
    flex: '0 0 220px',
    borderRightWidth: '1px',
    borderRightStyle: 'solid',
    borderRightColor: tokens.colorNeutralStroke2,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },

  centerPanel: {
    flex: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },

  rightPanel: {
    flex: '0 0 320px',
    borderLeftWidth: '1px',
    borderLeftStyle: 'solid',
    borderLeftColor: tokens.colorNeutralStroke2,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },

  spinnerContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
});

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface TemplateEditorProps {
  /** Template ID to edit (null = create new). */
  editId?: string | null;
  /** Called when the editor should close. */
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TemplateEditor({ editId, onClose }: TemplateEditorProps) {
  const styles = useStyles();
  const panelRef = useRef<HTMLDivElement>(null);

  // All hooks must be declared before any early return
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);

  const editor = useTemplateEditor({
    editId,
    onSaved: onClose,
  });

  // Focus trap for the panel (always called — hook activation is controlled by the `active` param)
  useFocusTrap(panelRef, !editor.isLoading);

  // Close with dirty-check
  const requestClose = useCallback(() => {
    if (editor.isDirty) {
      setShowDiscardDialog(true);
    } else {
      onClose();
    }
  }, [editor.isDirty, onClose]);

  // Escape key handler
  useEffect(() => {
    if (editor.isLoading) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showDiscardDialog) return;
        requestClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('keydown', onKeyDown); };
  }, [editor.isLoading, requestClose, showDiscardDialog]);

  // Focus panel on mount (after loading completes)
  useEffect(() => {
    if (!editor.isLoading) {
      panelRef.current?.focus();
    }
  }, [editor.isLoading]);

  // Gate on loading — prevent user from interacting with blank form while data loads
  if (editor.isLoading) {
    return (
      <div className={styles.overlay}>
        <div
          className={styles.panel}
          role="dialog"
          aria-modal="true"
          aria-label="Loading template..."
        >
          <div className={styles.spinnerContainer}>
            <Spinner label="Loading template..." />
          </div>
        </div>
      </div>
    );
  }

  const panelTitle = editor.isEdit
    ? `Edit Template: ${editor.template.name || 'Untitled'}`
    : 'Create Template';

  return (
    <>
      <div
        className={styles.overlay}
        onClick={(e) => { if (e.target === e.currentTarget) requestClose(); }}
      >
        <div
          ref={panelRef}
          className={styles.panel}
          role="dialog"
          aria-modal="true"
          aria-label={panelTitle}
          tabIndex={-1}
        >
          {/* Header */}
          <div className={styles.header}>
            <div className={styles.headerLeft}>
              <Text className={styles.headerTitle}>{panelTitle}</Text>
            </div>
            <div className={styles.headerActions}>
              {editor.isSaving && <Spinner size="tiny" label="Saving..." labelPosition="before" />}
              <Button
                appearance="primary"
                icon={<Save24Regular />}
                onClick={() => { void editor.save(); }}
                disabled={editor.isSaving || !editor.template.name.trim()}
              >
                Save
              </Button>
              <Button
                appearance="subtle"
                icon={<Dismiss24Regular />}
                onClick={requestClose}
                aria-label="Close template editor"
              />
            </div>
          </div>

          {editor.saveError && (
            <MessageBar intent="error" style={{ flexShrink: 0 }}>
              <MessageBarBody>{editor.saveError}</MessageBarBody>
            </MessageBar>
          )}

          {/* Three-panel body */}
          <div className={styles.body}>
            {/* Left: Slot list */}
            <div className={styles.leftPanel}>
              <SlotListPanel
                slots={editor.template.slots}
                selectedSlotId={editor.selectedSlotId}
                onSelectSlot={editor.selectSlot}
                onAddSlot={editor.addSlot}
                onRemoveSlot={editor.removeSlot}
                onReorderSlots={editor.reorderSlots}
              />
            </div>

            {/* Center: Slot config + template metadata */}
            <div className={styles.centerPanel}>
              <TemplateMetadataForm
                name={editor.template.name}
                description={editor.template.description}
                iconName={editor.template.iconName}
                category={editor.template.category}
                accentColor={editor.template.accentColor}
                onNameChange={editor.setName}
                onDescriptionChange={editor.setDescription}
                onIconNameChange={editor.setIconName}
                onCategoryChange={editor.setCategory}
                onAccentColorChange={editor.setAccentColor}
              />
              <SlotConfigPanel
                slot={editor.template.slots.find((s) => s.id === editor.selectedSlotId) ?? null}
                onUpdate={(updates) => {
                  if (editor.selectedSlotId) {
                    editor.updateSlot(editor.selectedSlotId, updates);
                  }
                }}
              />
            </div>

            {/* Right: Preview */}
            <div className={styles.rightPanel}>
              <TemplatePreviewPanel template={editor.template} />
            </div>
          </div>
        </div>
      </div>

      {/* Discard dialog */}
      <Dialog
        open={showDiscardDialog}
        onOpenChange={(_e, data) => { setShowDiscardDialog(data.open); }}
      >
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Unsaved changes</DialogTitle>
            <DialogContent>
              You have unsaved changes. Discard them and close?
            </DialogContent>
            <DialogActions>
              <Button appearance="primary" onClick={() => { setShowDiscardDialog(false); }}>
                Keep editing
              </Button>
              <Button
                appearance="secondary"
                onClick={() => {
                  setShowDiscardDialog(false);
                  onClose();
                }}
              >
                Discard
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </>
  );
}
