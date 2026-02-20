import { useRef, useEffect } from 'react';
import {
  makeStyles,
  tokens,
  Caption1,
} from '@fluentui/react-components';
import * as AdaptiveCards from 'adaptivecards';
import type { TeamsTheme, ThemeDefinition } from '@/types';
import { buildThemedHostConfig } from '@/lib/themeEngine';

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
    height: '100%',
    overflow: 'auto',
  },

  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXXS,
  },

  label: {
    color: tokens.colorNeutralForeground3,
    paddingLeft: tokens.spacingHorizontalXS,
  },

  previewContainer: {
    minHeight: 0,
    overflow: 'hidden',
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    padding: tokens.spacingHorizontalM,
  },

  previewLight: {
    backgroundColor: '#FFFFFF',
  },

  previewDark: {
    backgroundColor: '#1F1F1F',
  },

  previewContrast: {
    backgroundColor: '#000000',
  },

  emptyState: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    minHeight: '120px',
    color: tokens.colorNeutralForeground3,
  },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Remove all child nodes from an element (safe alternative to innerHTML = ''). */
function clearChildren(el: HTMLElement) {
  while (el.firstChild) {
    el.removeChild(el.firstChild);
  }
}

/** Render an Adaptive Card into a container element with the given theme. */
function renderCardInto(
  container: HTMLElement,
  cardPayload: object,
  recipientTheme: TeamsTheme,
  cardTheme: ThemeDefinition,
) {
  try {
    clearChildren(container);
    const hostConfig = buildThemedHostConfig(recipientTheme, cardTheme);
    const card = new AdaptiveCards.AdaptiveCard();
    card.hostConfig = new AdaptiveCards.HostConfig(hostConfig);
    card.onExecuteAction = () => {};
    card.parse(cardPayload);
    const rendered = card.render();
    if (rendered) {
      container.appendChild(rendered);
    }
  } catch (err) {
    clearChildren(container);
    const errEl = document.createElement('div');
    errEl.style.cssText = 'color: red; padding: 8px; font-size: 12px; font-family: monospace;';
    errEl.textContent = `Card render error: ${String(err)}`;
    container.appendChild(errEl);
  }
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CardPreviewPanelProps {
  /** The Adaptive Card JSON payload (theme-independent). */
  cardPayload: object | null;
  /** The card color theme — used to build recipient-theme-aware host config. */
  cardTheme: ThemeDefinition;
}

// ---------------------------------------------------------------------------
// CardPreviewPanel
// ---------------------------------------------------------------------------

export function CardPreviewPanel({ cardPayload, cardTheme }: CardPreviewPanelProps) {
  const styles = useStyles();
  const lightRef = useRef<HTMLDivElement>(null);
  const darkRef = useRef<HTMLDivElement>(null);
  const contrastRef = useRef<HTMLDivElement>(null);

  // Render the Adaptive Card into all 3 theme containers
  useEffect(() => {
    const refs: { el: HTMLDivElement | null; theme: TeamsTheme }[] = [
      { el: lightRef.current, theme: 'default' },
      { el: darkRef.current, theme: 'dark' },
      { el: contrastRef.current, theme: 'contrast' },
    ];

    for (const { el, theme } of refs) {
      if (!el) continue;
      if (!cardPayload) {
        clearChildren(el);
      } else {
        renderCardInto(el, cardPayload, theme, cardTheme);
      }
    }
  }, [cardPayload, cardTheme]);

  if (!cardPayload) {
    return (
      <div className={styles.root}>
        <div className={styles.emptyState}>
          <Caption1>Select a template to see a preview</Caption1>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <div className={styles.section}>
        <Caption1 className={styles.label}>Light</Caption1>
        <div className={`${styles.previewContainer} ${styles.previewLight}`} ref={lightRef} />
      </div>

      <div className={styles.section}>
        <Caption1 className={styles.label}>Dark</Caption1>
        <div className={`${styles.previewContainer} ${styles.previewDark}`} ref={darkRef} />
      </div>

      <div className={styles.section}>
        <Caption1 className={styles.label}>High Contrast</Caption1>
        <div className={`${styles.previewContainer} ${styles.previewContrast}`} ref={contrastRef} />
      </div>
    </div>
  );
}
