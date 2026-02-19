import { useState, useEffect, useCallback } from 'react';
import { app } from '@microsoft/teams-js';
import {
  teamsLightTheme,
  teamsDarkTheme,
  teamsHighContrastTheme,
  type Theme,
} from '@fluentui/react-components';
import i18n from '@/i18n';

export type TeamsTheme = 'default' | 'dark' | 'contrast';

interface TeamsContextState {
  isInitialized: boolean;
  isTeamsContext: boolean;
  theme: Theme;
  teamsTheme: TeamsTheme;
  locale: string;
  error: string | null;
  userObjectId: string | null;
  tenantId: string | null;
}

function mapTheme(teamThemeName: string | undefined): {
  theme: Theme;
  teamsTheme: TeamsTheme;
} {
  switch (teamThemeName) {
    case 'dark':
      return { theme: teamsDarkTheme, teamsTheme: 'dark' };
    case 'contrast':
      return { theme: teamsHighContrastTheme, teamsTheme: 'contrast' };
    default:
      return { theme: teamsLightTheme, teamsTheme: 'default' };
  }
}

export function useTeamsContext(): TeamsContextState {
  const [state, setState] = useState<TeamsContextState>({
    isInitialized: false,
    isTeamsContext: false,
    theme: teamsLightTheme,
    teamsTheme: 'default',
    locale: 'en-US',
    error: null,
    userObjectId: null,
    tenantId: null,
  });

  const handleThemeChange = useCallback((newTheme: string) => {
    const { theme, teamsTheme } = mapTheme(newTheme);
    setState((prev) => ({ ...prev, theme, teamsTheme }));
  }, []);

  useEffect(() => {
    let mounted = true;

    async function initTeams() {
      try {
        await app.initialize();

        if (!mounted) return;

        const context = await app.getContext();

        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- mounted is set false by cleanup; TS can't track async closure mutation
        if (!mounted) return;

        const themeName = context.app.theme;
        const { theme, teamsTheme } = mapTheme(themeName);
        const locale = context.app.locale;
        const userObjectId = context.user?.id ?? null;
        const tenantId = context.user?.tenant?.id ?? null;

        // Update i18n locale
        void i18n.changeLanguage(locale);

        setState({
          isInitialized: true,
          isTeamsContext: true,
          theme,
          teamsTheme,
          locale,
          error: null,
          userObjectId,
          tenantId,
        });

        // Register theme change handler
        app.registerOnThemeChangeHandler(handleThemeChange);
      } catch (err) {
        if (!mounted) return;

        // Running outside Teams (e.g., during development)
        console.warn('Teams SDK initialization failed - running in standalone mode:', err);

        setState({
          isInitialized: true,
          isTeamsContext: false,
          theme: teamsLightTheme,
          teamsTheme: 'default',
          locale: 'en-US',
          error: null,
          userObjectId: null,
          tenantId: null,
        });
      }
    }

    void initTeams();

    return () => {
      mounted = false;
    };
  }, [handleThemeChange]);

  return state;
}
