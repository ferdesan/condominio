import type { ReactNode } from 'react';
import { BrowserRouter, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import { ErrorBoundary } from '@/components/common/error-boundary';
import { AuthProvider } from '@/providers/auth-provider';
import { QueryProvider } from '@/providers/query-provider';
import { ThemeProvider } from '@/providers/theme-provider';
import { useTheme } from '@/hooks/use-theme';
import { AppRouter } from '@/routes/app-router';

/** O Toaster precisa do tema resolvido, entao fica dentro do ThemeProvider. */
function AppToaster() {
  const { resolvedTheme } = useTheme();
  return <Toaster theme={resolvedTheme} position="top-right" richColors closeButton />;
}

/** Troca de rota limpa o estado de erro do boundary da anterior. */
function RouterErrorBoundary({ children }: { children: ReactNode }) {
  const location = useLocation();
  return (
    <ErrorBoundary resetKey={location.pathname}>
      {children}
    </ErrorBoundary>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <QueryProvider>
        <BrowserRouter>
          <AuthProvider>
            <RouterErrorBoundary>
              <AppRouter />
            </RouterErrorBoundary>
            <AppToaster />
          </AuthProvider>
        </BrowserRouter>
      </QueryProvider>
    </ThemeProvider>
  );
}
