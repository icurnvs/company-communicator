import { useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  makeStyles,
  tokens,
  Button,
  Spinner,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  MessageBarActions,
  Text,
  ProgressBar,
} from '@fluentui/react-components';
import {
  ArrowDownload24Regular,
  ArrowExportUp24Regular,
  Dismiss12Regular,
} from '@fluentui/react-icons';
import { dialog } from '@microsoft/teams-js';
import { useTranslation } from 'react-i18next';
import {
  useCreateExport,
  useExportJob,
  useExportDownload,
} from '@/api/exports';
import { ApiResponseError } from '@/api/client';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalL,
    padding: tokens.spacingHorizontalL,
    height: '100%',
  },
  header: {
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    paddingBottom: tokens.spacingVerticalM,
  },
  statusSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
    padding: tokens.spacingVerticalM,
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  statusRow: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
  },
  actions: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
    justifyContent: 'flex-end',
    paddingTop: tokens.spacingVerticalM,
  },
});

export function ExportManager() {
  const styles = useStyles();
  const { t } = useTranslation();
  const { notificationId } = useParams<{ notificationId: string }>();

  const [exportJobId, setExportJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const createExport = useCreateExport();

  const { data: exportJob } = useExportJob(exportJobId);

  const { data: downloadData } = useExportDownload(
    exportJob?.status === 'Completed' ? exportJobId : null,
  );

  const handleRequestExport = useCallback(async () => {
    if (!notificationId) return;
    setError(null);
    try {
      const job = await createExport.mutateAsync({ notificationId });
      setExportJobId(job.id);
    } catch (err) {
      setError(
        err instanceof ApiResponseError
          ? err.message
          : t('errors.generic'),
      );
    }
  }, [notificationId, createExport, t]);

  const handleDownload = useCallback(() => {
    if (downloadData?.downloadUri) {
      window.open(downloadData.downloadUri, '_blank', 'noopener,noreferrer');
    }
  }, [downloadData]);

  const handleClose = useCallback(() => {
    dialog.url.submit();
  }, []);

  const isInProgress =
    exportJob?.status === 'Queued' || exportJob?.status === 'InProgress';

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Text size={500} weight="semibold">
          {t('exportManager.title')}
        </Text>
        <Text
          size={300}
          block
          style={{ color: tokens.colorNeutralForeground3, marginTop: tokens.spacingVerticalXS }}
        >
          {t('exportManager.description')}
        </Text>
      </div>

      {error && (
        <MessageBar intent="error">
          <MessageBarBody>
            <MessageBarTitle>{t('app.error')}</MessageBarTitle>
            {error}
          </MessageBarBody>
          <MessageBarActions
            containerAction={
              <Button
                appearance="transparent"
                size="small"
                icon={<Dismiss12Regular />}
                onClick={() => setError(null)}
                aria-label="Dismiss error"
              />
            }
          />
        </MessageBar>
      )}

      {!exportJobId && !createExport.isPending && (
        <Button
          appearance="primary"
          icon={<ArrowExportUp24Regular />}
          onClick={() => void handleRequestExport()}
          disabled={createExport.isPending}
        >
          {t('exportManager.requestExport')}
        </Button>
      )}

      {createExport.isPending && (
        <div className={styles.statusRow}>
          <Spinner size="small" />
          <Text>{t('exportManager.requesting')}</Text>
        </div>
      )}

      {exportJob && (
        <div className={styles.statusSection}>
          <div className={styles.statusRow}>
            {isInProgress ? (
              <Spinner size="small" />
            ) : exportJob.status === 'Completed' ? (
              <ArrowDownload24Regular
                style={{ color: tokens.colorStatusSuccessForeground1 }}
              />
            ) : (
              <ArrowExportUp24Regular
                style={{ color: tokens.colorStatusDangerForeground1 }}
              />
            )}
            <Text>
              {t(`exportManager.status.${exportJob.status}`)}
            </Text>
          </div>

          {isInProgress && (
            <ProgressBar />
          )}

          {exportJob.status === 'Failed' && exportJob.errorMessage && (
            <MessageBar intent="error">
              <MessageBarBody>
                {t('exportManager.error', { message: exportJob.errorMessage })}
              </MessageBarBody>
            </MessageBar>
          )}

          {exportJob.status === 'Completed' && downloadData && (
            <Button
              appearance="primary"
              icon={<ArrowDownload24Regular />}
              onClick={handleDownload}
            >
              {t('exportManager.download')}
            </Button>
          )}
        </div>
      )}

      <div className={styles.actions}>
        <Button onClick={handleClose}>{t('app.close')}</Button>
      </div>
    </div>
  );
}
