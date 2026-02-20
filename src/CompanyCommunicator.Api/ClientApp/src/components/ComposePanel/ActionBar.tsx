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
import { useScheduleNotification, usePreviewNotification } from '@/api/notifications';
import { useCreateTemplate } from '@/api/templates';
import type { AudienceDto, CardSchema } from '@/types';
import type { ComposeFormValues } from '@/lib/validators';

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
// Audience summary helpers
// ---------------------------------------------------------------------------

function buildAudienceSummary(
  allUsers: boolean,
  audiences: AudienceDto[] | null | undefined,
): { label: string; chipTypes: string[] } {
  if (allUsers) {
    return { label: 'All Users', chipTypes: ['All Users'] };
  }

  const list = audiences ?? [];
  if (list.length === 0) {
    return { label: '', chipTypes: [] };
  }

  const typeCounts: Record<string, number> = {};
  for (const a of list) {
    typeCounts[a.audienceType] = (typeCounts[a.audienceType] ?? 0) + 1;
  }

  const chips: string[] = [];
  if (typeCounts['Team']) chips.push(`${typeCounts['Team']} team${typeCounts['Team'] > 1 ? 's' : ''}`);
  if (typeCounts['Roster']) chips.push(`${typeCounts['Roster']} roster${typeCounts['Roster'] > 1 ? 's' : ''}`);
  if (typeCounts['Group']) chips.push(`${typeCounts['Group']} group${typeCounts['Group'] > 1 ? 's' : ''}`);

  return { label: chips.join(', '), chipTypes: chips };
}

// Rough reach estimate: teams ~50, groups ~30, rosters ~20 members each
function estimateReach(allUsers: boolean, audiences: AudienceDto[] | null | undefined): number | null {
  if (allUsers) return null; // Can't estimate for all users
  const list = audiences ?? [];
  if (list.length === 0) return null;
  return list.reduce((sum, a) => {
    if (a.audienceType === 'Team') return sum + 50;
    if (a.audienceType === 'Group') return sum + 30;
    return sum + 20; // Roster
  }, 0);
}

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
  const scheduleMutation = useScheduleNotification();

  const handleSchedule = useCallback(async () => {
    if (!selectedDate) return;

    let id = notificationId;
    if (!id) {
      id = await onSaveDraft() ?? null;
    }
    if (!id) return;

    await scheduleMutation.mutateAsync({
      id,
      body: { scheduledDate: selectedDate.toISOString() },
    });
    setOpen(false);
    setSelectedDate(null);
  }, [selectedDate, notificationId, onSaveDraft, scheduleMutation]);

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
          <div className={styles.scheduleActions}>
            <Button
              appearance="secondary"
              size="small"
              onClick={() => {
                setOpen(false);
                setSelectedDate(null);
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
  formValues: ComposeFormValues;
}

function SaveTemplateDialog({ open, onClose, formValues }: SaveTemplateDialogProps) {
  const styles = useStyles();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const createTemplate = useCreateTemplate();

  const handleSave = useCallback(async () => {
    if (!name.trim()) return;

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

    await createTemplate.mutateAsync({
      name: name.trim(),
      description: description.trim() || null,
      cardSchema: JSON.stringify(cardSchema),
    });

    setName('');
    setDescription('');
    onClose();
  }, [name, description, formValues, createTemplate, onClose]);

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
  /** Current form values (watched from the parent so this stays reactive). */
  formValues: ComposeFormValues;
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
}

// ---------------------------------------------------------------------------
// ActionBar
// ---------------------------------------------------------------------------

export function ActionBar({
  formValues,
  isSaving,
  isEdit,
  notificationId,
  lastAutoSaved,
  onSaveDraft,
}: ActionBarProps) {
  const styles = useStyles();
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const previewMutation = usePreviewNotification();

  // Audience summary
  const { chipTypes } = buildAudienceSummary(formValues.allUsers, formValues.audiences);
  const reach = estimateReach(formValues.allUsers, formValues.audiences);
  const hasAudience = formValues.allUsers || (formValues.audiences ?? []).length > 0;

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
              {formValues.allUsers ? (
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
              <MenuItem
                icon={<DocumentCopyRegular />}
                onClick={() => { setTemplateDialogOpen(true); }}
              >
                Save as Template
              </MenuItem>
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

        {/* Review — placeholder for Task 15 */}
        <Button
          appearance="primary"
          size="small"
          icon={<ChevronRightRegular />}
          iconPosition="after"
          disabled={!hasAudience || !formValues.headline?.trim()}
        >
          Review
        </Button>
      </div>

      {/* Save as Template dialog */}
      <SaveTemplateDialog
        open={templateDialogOpen}
        onClose={() => { setTemplateDialogOpen(false); }}
        formValues={formValues}
      />
    </div>
  );
}
