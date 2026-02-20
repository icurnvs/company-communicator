import { useRef, useEffect, useDeferredValue, memo } from 'react';
import { makeStyles, tokens, Text } from '@fluentui/react-components';
import { useTranslation } from 'react-i18next';
import { buildCardPayload, renderCard } from '@/lib/adaptiveCard';
import type { CardData } from '@/lib/adaptiveCard';
import type { TeamsTheme } from '@/hooks/useTeamsContext';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
    height: '100%',
  },
  label: {
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground3,
    textTransform: 'uppercase',
    fontSize: tokens.fontSizeBase200,
    letterSpacing: '0.05em',
  },
  previewBox: {
    flex: 1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    padding: tokens.spacingHorizontalM,
    overflow: 'auto',
    backgroundColor: tokens.colorNeutralBackground2,
    minHeight: '200px',
    maxWidth: '460px', // Adaptive Cards are designed for ~400px in Teams
    position: 'relative',
  },
  placeholder: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    minHeight: '150px',
    color: tokens.colorNeutralForeground3,
  },
  cardContainer: {
    '& .ac-container': {
      fontFamily: "'Segoe UI', system-ui, sans-serif",
    },
  },
});

interface AdaptiveCardPreviewProps {
  data: CardData;
  theme?: TeamsTheme;
}

export const AdaptiveCardPreview = memo(function AdaptiveCardPreview({
  data,
  theme = 'default',
}: AdaptiveCardPreviewProps) {
  const styles = useStyles();
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);

  // Defer expensive card rendering to avoid blocking the form inputs
  const deferredData = useDeferredValue(data);
  const deferredTheme = useDeferredValue(theme);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (!deferredData.title) {
      container.innerHTML = '';
      return;
    }

    const payload = buildCardPayload(deferredData);
    const cleanup = renderCard(container, payload, deferredTheme);

    return cleanup;
  }, [deferredData, deferredTheme]);

  const hasTitle = Boolean(data.title);

  return (
    <div className={styles.container}>
      <Text className={styles.label}>{t('content.preview')}</Text>
      <div className={styles.previewBox}>
        {!hasTitle ? (
          <div className={styles.placeholder}>
            <Text size={300} style={{ color: tokens.colorNeutralForeground3 }}>
              Enter a title to see the card preview
            </Text>
          </div>
        ) : null}
        <div
          ref={containerRef}
          className={styles.cardContainer}
          aria-label="Adaptive card preview"
        />
      </div>
    </div>
  );
});
