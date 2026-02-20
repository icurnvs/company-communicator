import { useRef, useEffect, useState, useCallback } from 'react';
import {
  makeStyles,
  tokens,
  ToggleButton,
  Caption1,
} from '@fluentui/react-components';
import {
  WeatherSunny20Regular,
  WeatherMoon20Regular,
  Accessibility20Regular,
} from '@fluentui/react-icons';
import * as AdaptiveCards from 'adaptivecards';
import type { TeamsTheme, ThemeDefinition } from '@/types';
import { buildThemedHostConfig } from '@/lib/themeEngine';

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'cc-preview-theme';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
    height: '100%',
  },

  toolbar: {
    display: 'flex',
    gap: tokens.spacingHorizontalXS,
    justifyContent: 'center',
  },

  previewContainer: {
    flex: 1,
    minHeight: 0,
    overflow: 'auto',
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

function getInitialTheme(): TeamsTheme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'dark' || stored === 'contrast') return stored;
  } catch { /* localStorage unavailable */ }
  return 'default';
}

export function CardPreviewPanel({ cardPayload, cardTheme }: CardPreviewPanelProps) {
  const styles = useStyles();
  const containerRef = useRef<HTMLDivElement>(null);
  const [recipientTheme, setRecipientTheme] = useState<TeamsTheme>(getInitialTheme);

  const handleThemeChange = useCallback((theme: TeamsTheme) => {
    setRecipientTheme(theme);
    try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* ok */ }
  }, []);

  // Render the Adaptive Card whenever payload, card theme, or recipient theme changes
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    if (!cardPayload) {
      clearChildren(el);
      return;
    }

    try {
      clearChildren(el);
      const hostConfig = buildThemedHostConfig(recipientTheme, cardTheme);
      const card = new AdaptiveCards.AdaptiveCard();
      card.hostConfig = new AdaptiveCards.HostConfig(hostConfig);
      card.parse(cardPayload);
      const rendered = card.render();
      if (rendered) {
        el.appendChild(rendered);
      }
    } catch (err) {
      clearChildren(el);
      const errEl = document.createElement('div');
      errEl.style.cssText = 'color: red; padding: 8px; font-size: 12px; font-family: monospace;';
      errEl.textContent = `Card render error: ${String(err)}`;
      el.appendChild(errEl);
    }
  }, [cardPayload, cardTheme, recipientTheme]);

  const bgClass =
    recipientTheme === 'dark' ? styles.previewDark
    : recipientTheme === 'contrast' ? styles.previewContrast
    : styles.previewLight;

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <ToggleButton
          size="small"
          icon={<WeatherSunny20Regular />}
          checked={recipientTheme === 'default'}
          onClick={() => { handleThemeChange('default'); }}
          aria-label="Light theme preview"
        >
          Light
        </ToggleButton>
        <ToggleButton
          size="small"
          icon={<WeatherMoon20Regular />}
          checked={recipientTheme === 'dark'}
          onClick={() => { handleThemeChange('dark'); }}
          aria-label="Dark theme preview"
        >
          Dark
        </ToggleButton>
        <ToggleButton
          size="small"
          icon={<Accessibility20Regular />}
          checked={recipientTheme === 'contrast'}
          onClick={() => { handleThemeChange('contrast'); }}
          aria-label="High contrast theme preview"
        >
          Contrast
        </ToggleButton>
      </div>

      <div className={`${styles.previewContainer} ${bgClass}`} ref={containerRef}>
        {!cardPayload && (
          <div className={styles.emptyState}>
            <Caption1>Select a template to see a preview</Caption1>
          </div>
        )}
      </div>
    </div>
  );
}
