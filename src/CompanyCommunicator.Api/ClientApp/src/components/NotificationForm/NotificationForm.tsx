import { useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  makeStyles,
  tokens,
  Button,
  Field,
  Input,
  Textarea,
  Spinner,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  MessageBarActions,
  Text,
  Divider,
  Dialog,
  DialogTrigger,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@fluentui/react-components';
import { DatePicker } from '@fluentui/react-datepicker-compat';
import { Dismiss12Regular } from '@fluentui/react-icons';
import { dialog } from '@microsoft/teams-js';
import { useTranslation } from 'react-i18next';
import {
  notificationFormSchema,
  type NotificationFormValues,
  formValuesToCreateRequest,
} from '@/lib/validators';
import {
  useNotification,
  useCreateNotification,
  useUpdateNotification,
  useSendNotification,
  useScheduleNotification,
  usePreviewNotification,
} from '@/api/notifications';
import { AdaptiveCardPreview } from '@/components/AdaptiveCardPreview/AdaptiveCardPreview';
import { AudiencePicker } from '@/components/AudiencePicker/AudiencePicker';
import { ApiResponseError } from '@/api/client';
import type { AudienceDto } from '@/types';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    overflow: 'hidden',
  },
  header: {
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalL}`,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    flexShrink: 0,
  },
  stepIndicator: {
    display: 'flex',
    gap: tokens.spacingHorizontalM,
    alignItems: 'center',
  },
  stepItem: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
  },
  stepNumber: {
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightBold,
  },
  content: {
    flex: 1,
    overflow: 'hidden',
    display: 'flex',
  },
  formPanel: {
    flex: 1,
    overflow: 'auto',
    padding: tokens.spacingHorizontalL,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
    minWidth: 0,
  },
  previewPanel: {
    width: '340px',
    borderLeft: `1px solid ${tokens.colorNeutralStroke2}`,
    padding: tokens.spacingHorizontalM,
    overflow: 'auto',
    flexShrink: 0,
  },
  footer: {
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalL}`,
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacingHorizontalS,
    flexShrink: 0,
  },
  footerRight: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
    alignItems: 'center',
  },
  errorBar: {
    marginBottom: tokens.spacingVerticalS,
  },
});

type FormStep = 'content' | 'audience';

export function NotificationForm() {
  const styles = useStyles();
  const { t } = useTranslation();
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);

  const [step, setStep] = useState<FormStep>('content');
  const [apiError, setApiError] = useState<string | null>(null);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [scheduleDate, setScheduleDate] = useState<Date | null>(null);
  const [scheduleDateError, setScheduleDateError] = useState<string | null>(null);
  const [previewSent, setPreviewSent] = useState(false);

  // Load existing notification for edit mode
  const { data: existingNotification, isLoading: loadingExisting } =
    useNotification(id ?? '', {
      enabled: isEdit,
    });

  const form = useForm<NotificationFormValues>({
    resolver: zodResolver(notificationFormSchema),
    defaultValues: existingNotification
      ? {
          title: existingNotification.title,
          summary: existingNotification.summary ?? '',
          imageLink: existingNotification.imageLink ?? '',
          buttonTitle: existingNotification.buttonTitle ?? '',
          buttonLink: existingNotification.buttonLink ?? '',
          allUsers: existingNotification.allUsers,
          audiences: existingNotification.audiences,
        }
      : {
          title: '',
          summary: '',
          imageLink: '',
          buttonTitle: '',
          buttonLink: '',
          allUsers: false,
          audiences: [],
        },
  });

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
    setValue,
    trigger,
  } = form;

  const watchedValues = watch();

  const createMutation = useCreateNotification();
  const updateMutation = useUpdateNotification();
  const sendMutation = useSendNotification();
  const scheduleMutation = useScheduleNotification();
  const previewMutation = usePreviewNotification();

  const isBusy =
    isSubmitting ||
    createMutation.isPending ||
    updateMutation.isPending ||
    sendMutation.isPending ||
    scheduleMutation.isPending ||
    previewMutation.isPending;

  const clearError = () => { setApiError(null); };

  // Save the notification (create or update), returns the notification ID
  const saveNotification = useCallback(
    async (values: NotificationFormValues): Promise<string> => {
      const body = formValuesToCreateRequest(values);

      if (isEdit && id) {
        const updated = await updateMutation.mutateAsync({ id, body });
        return updated.id;
      } else {
        const created = await createMutation.mutateAsync(body);
        return created.id;
      }
    },
    [isEdit, id, createMutation, updateMutation],
  );

  const handleSaveDraft = handleSubmit(async (values) => {
    clearError();
    try {
      await saveNotification(values);
      dialog.url.submit();
    } catch (err) {
      setApiError(
        err instanceof ApiResponseError
          ? err.message
          : t('errors.saveFailed'),
      );
    }
  });

  const handleSendNow = handleSubmit(async (values) => {
    clearError();
    try {
      const savedId = await saveNotification(values);
      await sendMutation.mutateAsync(savedId);
      dialog.url.submit();
    } catch (err) {
      setApiError(
        err instanceof ApiResponseError
          ? err.message
          : t('errors.sendFailed'),
      );
    }
  });

  const handleScheduleConfirm = handleSubmit(async (values) => {
    if (!scheduleDate) {
      setScheduleDateError(t('notificationForm.schedule.dateRequired'));
      return;
    }
    if (scheduleDate <= new Date()) {
      setScheduleDateError(t('notificationForm.schedule.dateFuture'));
      return;
    }
    clearError();
    setScheduleDateError(null);
    try {
      const savedId = await saveNotification(values);
      await scheduleMutation.mutateAsync({
        id: savedId,
        body: { scheduledDate: scheduleDate.toISOString() },
      });
      setScheduleDialogOpen(false);
      dialog.url.submit();
    } catch (err) {
      setApiError(
        err instanceof ApiResponseError
          ? err.message
          : t('errors.saveFailed'),
      );
    }
  });

  const handleSendPreview = useCallback(async () => {
    clearError();
    if (!id) {
      setApiError('Save as draft first before sending a preview.');
      return;
    }
    try {
      await previewMutation.mutateAsync(id);
      setPreviewSent(true);
      setTimeout(() => { setPreviewSent(false); }, 5000);
    } catch (err) {
      setApiError(
        err instanceof ApiResponseError
          ? err.message
          : t('notificationForm.preview.error'),
      );
    }
  }, [id, previewMutation, t]);

  const handleNextStep = async () => {
    // Validate content fields before advancing
    const contentFields: (keyof NotificationFormValues)[] = [
      'title',
      'summary',
      'imageLink',
      'buttonTitle',
      'buttonLink',
    ];
    const valid = await trigger(contentFields);
    if (valid) setStep('audience');
  };

  if (isEdit && loadingExisting) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
        }}
      >
        <Spinner label={t('app.loading')} />
      </div>
    );
  }

  return (
    <div className={styles.root}>
      {/* Header with step indicator */}
      <div className={styles.header}>
        <div className={styles.stepIndicator}>
          <div className={styles.stepItem}>
            <div
              className={styles.stepNumber}
              style={{
                backgroundColor:
                  step === 'content'
                    ? tokens.colorBrandBackground
                    : tokens.colorNeutralBackground3,
                color:
                  step === 'content'
                    ? tokens.colorNeutralForegroundOnBrand
                    : tokens.colorNeutralForeground1,
              }}
            >
              1
            </div>
            <Text weight={step === 'content' ? 'semibold' : 'regular'}>
              {t('notificationForm.steps.content')}
            </Text>
          </div>
          <Text style={{ color: tokens.colorNeutralForeground3 }}>›</Text>
          <div className={styles.stepItem}>
            <div
              className={styles.stepNumber}
              style={{
                backgroundColor:
                  step === 'audience'
                    ? tokens.colorBrandBackground
                    : tokens.colorNeutralBackground3,
                color:
                  step === 'audience'
                    ? tokens.colorNeutralForegroundOnBrand
                    : tokens.colorNeutralForeground1,
              }}
            >
              2
            </div>
            <Text weight={step === 'audience' ? 'semibold' : 'regular'}>
              {t('notificationForm.steps.audience')}
            </Text>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className={styles.content}>
        <div className={styles.formPanel}>
          {apiError && (
            <MessageBar intent="error" className={styles.errorBar}>
              <MessageBarBody>
                <MessageBarTitle>{t('app.error')}</MessageBarTitle>
                {apiError}
              </MessageBarBody>
              <MessageBarActions
                containerAction={
                  <Button
                    appearance="transparent"
                    size="small"
                    icon={<Dismiss12Regular />}
                    onClick={clearError}
                    aria-label="Dismiss error"
                  />
                }
              />
            </MessageBar>
          )}

          {previewSent && (
            <MessageBar intent="success" className={styles.errorBar}>
              <MessageBarBody>{t('notificationForm.preview.sent')}</MessageBarBody>
            </MessageBar>
          )}

          {/* Step 1: Content */}
          {step === 'content' && (
            <>
              <Controller
                name="title"
                control={control}
                render={({ field }) => (
                  <Field
                    label={t('notificationForm.fields.title.label')}
                    required
                    validationMessage={errors.title?.message}
                    validationState={errors.title ? 'error' : 'none'}
                  >
                    <Input
                      {...field}
                      placeholder={t(
                        'notificationForm.fields.title.placeholder',
                      )}
                      maxLength={200}
                      aria-required="true"
                    />
                  </Field>
                )}
              />

              <Controller
                name="summary"
                control={control}
                render={({ field }) => (
                  <Field
                    label={t('notificationForm.fields.summary.label')}
                    validationMessage={errors.summary?.message}
                    validationState={errors.summary ? 'error' : 'none'}
                  >
                    <Textarea
                      {...field}
                      value={field.value ?? ''}
                      placeholder={t(
                        'notificationForm.fields.summary.placeholder',
                      )}
                      rows={4}
                      resize="vertical"
                    />
                  </Field>
                )}
              />

              <Controller
                name="imageLink"
                control={control}
                render={({ field }) => (
                  <Field
                    label={t('notificationForm.fields.imageLink.label')}
                    validationMessage={errors.imageLink?.message}
                    validationState={errors.imageLink ? 'error' : 'none'}
                    hint="Optional. Use a publicly accessible HTTPS image URL."
                  >
                    <Input
                      {...field}
                      value={field.value ?? ''}
                      placeholder={t(
                        'notificationForm.fields.imageLink.placeholder',
                      )}
                      type="url"
                    />
                  </Field>
                )}
              />

              <Divider />

              <Controller
                name="buttonTitle"
                control={control}
                render={({ field }) => (
                  <Field
                    label={t('notificationForm.fields.buttonTitle.label')}
                    validationMessage={errors.buttonTitle?.message}
                    validationState={errors.buttonTitle ? 'error' : 'none'}
                  >
                    <Input
                      {...field}
                      value={field.value ?? ''}
                      placeholder={t(
                        'notificationForm.fields.buttonTitle.placeholder',
                      )}
                    />
                  </Field>
                )}
              />

              <Controller
                name="buttonLink"
                control={control}
                render={({ field }) => (
                  <Field
                    label={t('notificationForm.fields.buttonLink.label')}
                    validationMessage={errors.buttonLink?.message}
                    validationState={errors.buttonLink ? 'error' : 'none'}
                  >
                    <Input
                      {...field}
                      value={field.value ?? ''}
                      placeholder={t(
                        'notificationForm.fields.buttonLink.placeholder',
                      )}
                      type="url"
                    />
                  </Field>
                )}
              />
            </>
          )}

          {/* Step 2: Audience */}
          {step === 'audience' && (
            <Controller
              name="audiences"
              control={control}
              render={({ field }) => (
                <AudiencePicker
                  value={(field.value as AudienceDto[] | undefined) ?? []}
                  allUsers={watchedValues.allUsers}
                  onAllUsersChange={(v) => { setValue('allUsers', v); }}
                  onAudiencesChange={(audiences) =>
                    { field.onChange(audiences); }
                  }
                  error={errors.audiences?.message ?? errors.allUsers?.message}
                />
              )}
            />
          )}
        </div>

        {/* Preview panel (only on content step) */}
        {step === 'content' && (
          <div className={styles.previewPanel}>
            <AdaptiveCardPreview
              data={{
                title: watchedValues.title,
                summary: watchedValues.summary,
                imageLink: watchedValues.imageLink,
                buttonTitle: watchedValues.buttonTitle,
                buttonLink: watchedValues.buttonLink,
              }}
            />
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className={styles.footer}>
        <div>
          {step === 'audience' && (
            <Button
              onClick={() => { setStep('content'); }}
              disabled={isBusy}
            >
              {t('app.back')}
            </Button>
          )}
        </div>

        <div className={styles.footerRight}>
          {isBusy && <Spinner size="tiny" />}

          {step === 'content' ? (
            <>
              {isEdit && id && (
                <Button
                  appearance="subtle"
                  onClick={() => void handleSendPreview()}
                  disabled={isBusy || !watchedValues.title}
                >
                  {previewMutation.isPending
                    ? t('notificationForm.preview.sending')
                    : t('notificationForm.actions.preview')}
                </Button>
              )}
              <Button
                appearance="secondary"
                onClick={() => void handleSaveDraft()}
                disabled={isBusy}
              >
                {createMutation.isPending || updateMutation.isPending
                  ? t('notificationForm.actions.saving')
                  : t('notificationForm.actions.saveDraft')}
              </Button>
              <Button
                appearance="primary"
                onClick={() => void handleNextStep()}
                disabled={isBusy}
              >
                {t('app.next')}
              </Button>
            </>
          ) : (
            <>
              <Button
                appearance="secondary"
                onClick={() => void handleSaveDraft()}
                disabled={isBusy}
              >
                {t('notificationForm.actions.saveDraft')}
              </Button>

              <Dialog
                open={scheduleDialogOpen}
                onOpenChange={(_e, d) => { setScheduleDialogOpen(d.open); }}
              >
                <DialogTrigger disableButtonEnhancement>
                  <Button appearance="secondary" disabled={isBusy}>
                    {t('notificationForm.actions.schedule')}
                  </Button>
                </DialogTrigger>
                <DialogSurface>
                  <DialogBody>
                    <DialogTitle>
                      {t('notificationForm.schedule.title')}
                    </DialogTitle>
                    <DialogContent>
                      <Field
                        label={t('notificationForm.schedule.dateLabel')}
                        required
                        validationMessage={scheduleDateError ?? undefined}
                        validationState={scheduleDateError ? 'error' : 'none'}
                      >
                        <DatePicker
                          value={scheduleDate}
                          onSelectDate={(date) => {
                            setScheduleDate(date ?? null);
                            setScheduleDateError(null);
                          }}
                          minDate={new Date()}
                          placeholder="Select a date..."
                        />
                      </Field>
                    </DialogContent>
                    <DialogActions>
                      <Button
                        appearance="secondary"
                        onClick={() => { setScheduleDialogOpen(false); }}
                      >
                        {t('app.cancel')}
                      </Button>
                      <Button
                        appearance="primary"
                        onClick={() => void handleScheduleConfirm()}
                        disabled={isBusy || !scheduleDate}
                      >
                        {scheduleMutation.isPending
                          ? t('notificationForm.actions.scheduling')
                          : t('notificationForm.schedule.confirm')}
                      </Button>
                    </DialogActions>
                  </DialogBody>
                </DialogSurface>
              </Dialog>

              <Button
                appearance="primary"
                onClick={() => void handleSendNow()}
                disabled={isBusy}
              >
                {sendMutation.isPending
                  ? t('notificationForm.actions.sending')
                  : t('notificationForm.actions.sendNow')}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
