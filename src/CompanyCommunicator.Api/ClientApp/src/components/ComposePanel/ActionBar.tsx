import { useCallback, useEffect, useRef, useState } from 'react';
import {
  makeStyles,
  tokens,
  Button,
  Text,
  Badge,
  Popover,
  PopoverSurface,
  PopoverTrigger,
  Dialog,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogActions,
  DialogContent,
  Field,
  Input,
  Textarea,
  Menu,
  MenuTrigger,
  MenuPopover,
  MenuList,
  MenuItem,
  MenuButton,
  Tooltip,
  mergeClasses,
} from '@fluentui/react-components';
import {
  SaveRegular,
  SendRegular,
  CalendarRegular,
  ChevronRightRegular,
  MoreHorizontalRegular,
  DocumentCopyRegular,
} from '@fluentui/react-icons';
import { DatePicker } from '@fluentui/react-datepicker-compat';
import type { UseFormReturn } from 'react-hook-form';
import { useScheduleNotification, usePreviewNotification } from '@/api/notifications';
import { useCreateTemplate } from '@/api/templates';
import type { CardSchema } from '@/types';
import type { ComposeFormValues } from '@/lib/validators';
import { buildAudienceSummary, estimateReach } from '@/lib/audienceUtils';

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const useStyles = makeStyles({
  root: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalL}`,
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    flexShrink: 0,
    gap: tokens.spacingHorizontalM,
    minHeight: '56px',
    backgroundColor: tokens.colorNeutralBackground1,
  },

  leftSide: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
  },

  audienceChips: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    flexWrap: 'nowrap',
    overflow: 'hidden',
  },

  reachText: {
    color: tokens.colorNeutralForeground3,
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },

  noAudienceText: {
    color: tokens.colorNeutralForeground4,
  },

  rightSide: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    flexShrink: 0,
  },

  autoSavedText: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
    transition: 'opacity 500ms ease-out',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },

  autoSavedVisible: {
    opacity: 1,
  },

  autoSavedHidden: {
    opacity: 0,
  },

  schedulePopover: {
    padding: tokens.spacingVerticalL,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
    minWidth: '280px',
  },

  scheduleActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: tokens.spacingHorizontalS,
    marginTop: tokens.spacingVerticalS,
  },

  templateDialogField: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
  },
});

// ---------------------------------------------------------------------------
// Auto-saved indicator sub-component
// ---------------------------------------------------------------------------

interface AutoSavedIndicatorProps {
  lastAutoSaved: Date | null;
}

function AutoSavedIndicator({ lastAutoSaved }: AutoSavedIndicatorProps) {
  const styles = useStyles();
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevSavedRef = useRef<Date | null>(null);

  useEffect(() => {
    if (!lastAutoSaved || lastAutoSaved === prevSavedRef.current) return;
    prevSavedRef.current = lastAutoSaved;

    setVisible(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { setVisible(false); }, 3_000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [lastAutoSaved]);

  if (!lastAutoSaved) return null;

  return (
    <Text
      size={200}
      className={mergeClasses(
        styles.autoSavedText,
        visible ? styles.autoSavedVisible : styles.autoSavedHidden,
      )}
    >
      Auto-saved
    </Text>
  );
}

// ---------------------------------------------------------------------------
// Schedule popover sub-component
// ---------------------------------------------------------------------------

interface SchedulePopoverProps {
  notificationId: string | null;
  isSaving: boolean;
  onSaveDraft: () => Promise<string | undefined>;
}

function SchedulePopover({ notificationId, isSaving, onSaveDraft }: SchedulePopoverProps) {
  const styles = useStyles();
  const [open, setOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null | undefined>(null);
  const [selectedTime, setSelectedTime] = useState('09:00');
  const scheduleMutation = useScheduleNotification();

  const handleSchedule = useCallback(async () => {
    if (!selectedDate) return;

    try {
      // Combine date + time
      const [hours, minutes] = selectedTime.split(':').map(Number);
      const combined = new Date(selectedDate);
      combined.setHours(hours ?? 9, minutes ?? 0, 0, 0);

      let id = notificationId;
      if (!id) {
        id = await onSaveDraft() ?? null;
      }
      if (!id) return;

      await scheduleMutation.mutateAsync({
        id,
        body: { scheduledDate: combined.toISOString() },
      });
      setOpen(false);
      setSelectedDate(null);
      setSelectedTime('09:00');
    } catch {
      // Error is surfaced via scheduleMutation.error
    }
  }, [selectedDate, selectedTime, notificationId, onSaveDraft, scheduleMutation]);

  const minDate = new Date();
  minDate.setMinutes(minDate.getMinutes() + 5); // At least 5 minutes in the future

  return (
    <Popover open={open} onOpenChange={(_e, data) => { setOpen(data.open); }} positioning="above-end">
      <PopoverTrigger>
        <Button
          appearance="secondary"
          size="small"
          icon={<CalendarRegular />}
          aria-label="Schedule send"
        >
          Schedule
        </Button>
      </PopoverTrigger>
      <PopoverSurface>
        <div className={styles.schedulePopover}>
          <Text weight="semibold">Schedule send</Text>
          <DatePicker
            placeholder="Select a date..."
            value={selectedDate ?? null}
            onSelectDate={(date) => { setSelectedDate(date); }}
            minDate={minDate}
          />
          <Field label="Time">
            <Input
              type="time"
              value={selectedTime}
              onChange={(_e, data) => { setSelectedTime(data.value); }}
            />
          </Field>
          <div className={styles.scheduleActions}>
            <Button
              appearance="secondary"
              size="small"
              onClick={() => {
                setOpen(false);
                setSelectedDate(null);
                setSelectedTime('09:00');
              }}
            >
              Cancel
            </Button>
            <Button
              appearance="primary"
              size="small"
              disabled={!selectedDate || isSaving || scheduleMutation.isPending}
              onClick={() => { void handleSchedule(); }}
            >
              Schedule
            </Button>
          </div>
        </div>
      </PopoverSurface>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// Save as Template dialog sub-component
// ---------------------------------------------------------------------------

interface SaveTemplateDialogProps {
  open: boolean;
  onClose: () => void;
  form: UseFormReturn<ComposeFormValues>;
}

function SaveTemplateDialog({ open, onClose, form }: SaveTemplateDialogProps) {
  const styles = useStyles();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const createTemplate = useCreateTemplate();

  const handleSave = useCallback(async () => {
    if (!name.trim()) return;

    // Snapshot at save time (not render time) to avoid stale values
    const formValues = form.getValues();

    const cardSchema: CardSchema = {
      headline: formValues.headline,
      body: formValues.body,
      imageLink: formValues.imageLink,
      keyDetails: formValues.keyDetails ?? undefined,
      buttonTitle: formValues.buttonTitle,
      buttonLink: formValues.buttonLink,
      secondaryText: formValues.secondaryText,
      advancedBlocks: formValues.advancedBlocks ?? undefined,
      cardPreference: formValues.cardPreference ?? undefined,
    };

    // Include Phase C structural data in the schema
    const extendedSchema = {
      ...cardSchema,
      additionalSlots: formValues.additionalSlots ?? undefined,
      advancedOverrides: formValues.advancedOverrides ?? undefined,
      cardSettings: formValues.cardSettings ?? undefined,
      slotOrder: formValues.slotOrder ?? undefined,
      slotVisibility: formValues.slotVisibility ?? undefined,
      templateId: formValues.templateId ?? undefined,
      themeId: formValues.themeId ?? undefined,
    };

    await createTemplate.mutateAsync({
      name: name.trim(),
      description: description.trim() || null,
      cardSchema: JSON.stringify(extendedSchema),
    });

    setName('');
    setDescription('');
    onClose();
  }, [name, description, form, createTemplate, onClose]);

  const handleClose = useCallback(() => {
    setName('');
    setDescription('');
    onClose();
  }, [onClose]);

  return (
    <Dialog open={open} onOpenChange={(_e, data) => { if (!data.open) handleClose(); }}>
      <DialogSurface>
        <DialogTitle>Save as Template</DialogTitle>
        <DialogBody>
          <DialogContent>
            <div className={styles.templateDialogField}>
              <Field label="Template name" required>
                <Input
                  value={name}
                  onChange={(_e, data) => { setName(data.value); }}
                  placeholder="e.g. Monthly Update"
                  autoFocus
                />
              </Field>
              <Field label="Description (optional)">
                <Textarea
                  value={description}
                  onChange={(_e, data) => { setDescription(data.value); }}
                  placeholder="What is this template for?"
                  rows={3}
                />
              </Field>
            </div>
          </DialogContent>
          <DialogActions>
            <Button appearance="secondary" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              appearance="primary"
              disabled={!name.trim() || createTemplate.isPending}
              onClick={() => { void handleSave(); }}
            >
              Save Template
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// ActionBar props
// ---------------------------------------------------------------------------

export interface ActionBarProps {
  /** The form instance — ActionBar watches values internally to avoid re-rendering the parent. */
  form: UseFormReturn<ComposeFormValues>;
  /** Whether a save is currently in progress. */
  isSaving: boolean;
  /** Whether the form is in edit mode (has an existing notification). */
  isEdit: boolean;
  /** The current notification ID, if saved. */
  notificationId: string | null;
  /** Timestamp of last auto-save, for the indicator. */
  lastAutoSaved: Date | null;
  /** Manually triggers a save-draft operation. */
  onSaveDraft: () => Promise<string | undefined>;
  /** Opens the pre-send confirmation dialog. */
  onReview: () => void;
  /** Whether advanced mode is active. */
  advancedMode?: boolean;
}

// ---------------------------------------------------------------------------
// ActionBar
// ---------------------------------------------------------------------------

export function ActionBar({
  form,
  isSaving,
  isEdit,
  notificationId,
  lastAutoSaved,
  onSaveDraft,
  onReview,
  advancedMode = false,
}: ActionBarProps) {
  const styles = useStyles();
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const previewMutation = usePreviewNotification();

  // Watch only the fields ActionBar needs — avoids re-renders from every keystroke.
  const allUsers = form.watch('allUsers');
  const audiences = form.watch('audiences');
  const headline = form.watch('headline');

  // Audience summary
  const { chipTypes } = buildAudienceSummary(allUsers, audiences);
  const reach = estimateReach(allUsers, audiences);
  const hasAudience = allUsers || (audiences ?? []).length > 0;

  // Send Preview is only meaningful in edit mode with a saved draft
  const canPreview = isEdit && Boolean(notificationId);

  const handleSaveDraft = useCallback(() => {
    void onSaveDraft();
  }, [onSaveDraft]);

  const handlePreview = useCallback(() => {
    if (!notificationId) return;
    void previewMutation.mutateAsync(notificationId);
  }, [notificationId, previewMutation]);

  return (
    <div className={styles.root}>
      {/* Left: audience summary */}
      <div className={styles.leftSide}>
        {hasAudience ? (
          <>
            <div className={styles.audienceChips}>
              {allUsers ? (
                <Badge appearance="tint" color="informative" size="small">
                  All Users
                </Badge>
              ) : (
                chipTypes.map((chip) => (
                  <Badge key={chip} appearance="tint" color="subtle" size="small">
                    {chip}
                  </Badge>
                ))
              )}
            </div>
            {reach !== null && (
              <Text size={200} className={styles.reachText}>
                ~{reach.toLocaleString()} people
              </Text>
            )}
          </>
        ) : (
          <Text size={200} className={styles.noAudienceText}>
            No audience selected
          </Text>
        )}

        <AutoSavedIndicator lastAutoSaved={lastAutoSaved} />
      </div>

      {/* Right: action buttons */}
      <div className={styles.rightSide}>
        {/* Save Draft + Save as Template menu */}
        <Menu>
          <MenuTrigger>
            <MenuButton
              appearance="secondary"
              size="small"
              icon={<SaveRegular />}
              disabled={isSaving}
              menuIcon={<MoreHorizontalRegular />}
              onClick={handleSaveDraft}
            >
              Save Draft
            </MenuButton>
          </MenuTrigger>
          <MenuPopover>
            <MenuList>
              {advancedMode && (
                <MenuItem
                  icon={<DocumentCopyRegular />}
                  onClick={() => { setTemplateDialogOpen(true); }}
                >
                  Save as Template
                </MenuItem>
              )}
            </MenuList>
          </MenuPopover>
        </Menu>

        {/* Send Preview */}
        <Button
          appearance="subtle"
          size="small"
          icon={<SendRegular />}
          disabled={!canPreview || previewMutation.isPending}
          onClick={handlePreview}
          aria-label="Send preview to yourself"
        >
          Send Preview
        </Button>

        {/* Schedule */}
        <SchedulePopover
          notificationId={notificationId}
          isSaving={isSaving}
          onSaveDraft={onSaveDraft}
        />

        {/* Review → opens pre-send confirmation dialog */}
        <Tooltip
          content={
            !headline?.trim()
              ? 'Add a headline to continue'
              : !hasAudience
                ? 'Select an audience to continue'
                : ''
          }
          relationship="description"
          visible={(!headline?.trim() || !hasAudience) ? undefined : false}
        >
          <Button
            appearance="primary"
            size="small"
            icon={<ChevronRightRegular />}
            iconPosition="after"
            disabled={!hasAudience || !headline?.trim()}
            onClick={onReview}
          >
            Review
          </Button>
        </Tooltip>
      </div>

      {/* Save as Template dialog */}
      <SaveTemplateDialog
        open={templateDialogOpen}
        onClose={() => { setTemplateDialogOpen(false); }}
        form={form}
      />
    </div>
  );
}
