/* eslint-disable react-refresh/only-export-components -- entry point, no exports */
import './global.css'; // Global reset: box-sizing, body margin, height chain
import './i18n'; // Initialize i18n before React renders
import { StrictMode, useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { FluentProvider } from '@fluentui/react-components';
import { app } from '@microsoft/teams-js';
import {
  teamsLightTheme,
  teamsDarkTheme,
  teamsHighContrastTheme,
  type Theme,
} from '@fluentui/react-components';
import { App } from './App';
import { DevTokenPrompt, hasValidDevToken } from './components/DevTokenPrompt';

// Configure TanStack Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

function mapTheme(themeName?: string): Theme {
  switch (themeName) {
    case 'dark':
      return teamsDarkTheme;
    case 'contrast':
      return teamsHighContrastTheme;
    default:
      return teamsLightTheme;
  }
}

function Root() {
  const [theme, setTheme] = useState<Theme>(teamsLightTheme);
  const [teamsReady, setTeamsReady] = useState(false);
  const [outsideTeams, setOutsideTeams] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      try {
        await app.initialize();
        const context = await app.getContext();
        if (!mounted) return;

        setTheme(mapTheme(context.app.theme));

        // Sync i18n locale with Teams context
        const locale = context.app.locale;
        if (locale) {
          void import('./i18n').then((mod) => {
            void mod.default.changeLanguage(locale);
          });
        }

        app.registerOnThemeChangeHandler((newTheme) => {
          if (mounted) setTheme(mapTheme(newTheme));
        });
      } catch {
        // Running outside Teams (dev mode); use default theme
        console.info('Running outside Teams - using default light theme');
        if (mounted) setOutsideTeams(true);
      } finally {
        if (mounted) setTeamsReady(true);
      }
    }

    void bootstrap();
    return () => {
      mounted = false;
    };
  }, []);

  // Don't render until Teams SDK init attempt is complete
  if (!teamsReady) {
    return null;
  }

  // In dev mode outside Teams, show the token prompt if no valid token is stored
  if (import.meta.env.DEV && outsideTeams && !hasValidDevToken()) {
    return (
      <StrictMode>
        <FluentProvider theme={theme}>
          <DevTokenPrompt />
        </FluentProvider>
      </StrictMode>
    );
  }

  return (
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <FluentProvider theme={theme}>
          <BrowserRouter basename="/clientapp">
            <App />
          </BrowserRouter>
        </FluentProvider>
        {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
      </QueryClientProvider>
    </StrictMode>
  );
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found in DOM');
}

createRoot(rootElement).render(<Root />);
