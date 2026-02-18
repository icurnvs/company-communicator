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

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      try {
        await app.initialize();
        const context = await app.getContext();
        if (!mounted) return;

        setTheme(mapTheme(context.app.theme));

        app.registerOnThemeChangeHandler((newTheme) => {
          if (mounted) setTheme(mapTheme(newTheme));
        });
      } catch {
        // Running outside Teams (dev mode); use default theme
        console.info('Running outside Teams - using default light theme');
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
