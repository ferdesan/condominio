import type { ErrorInfo, ReactNode } from 'react';
import { Component } from 'react';
import { Button } from '@/components/ui/button';

type Props = { children: ReactNode; resetKey?: string };
type State = { error: Error | null };

/**
 * Ultima rede da arvore de render: uma pagina que lanca nao derruba o shell
 * inteiro (topbar, menu, toaster). Sem ela, o erro sobe ate `main` e React
 * desmonta o app — o usuario fica numa tela em branco sem saida.
 *
 * `resetKey` (pathname) faz o boundary reabrir ao navegar: o erro de uma rota
 * nao pode prender as seguintes.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Console e a unica telemetria do app; sem isto o stack se perde no
    // minimo no React DevTools.
    console.error('ErrorBoundary capturou:', error, info.componentStack);
  }

  override componentDidUpdate(prev: Props): void {
    if (this.state.error && prev.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  override render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4 text-center">
          <div className="space-y-2">
            <h1 className="text-xl font-semibold">Algo deu errado</h1>
            <p className="max-w-md text-sm text-muted-foreground">
              Ocorreu um erro inesperado ao carregar esta tela. Tente novamente ou volte para o
              início.
            </p>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => this.setState({ error: null })}>
              Tentar novamente
            </Button>
            <Button type="button" onClick={() => window.location.assign('/')}>
              Ir para o início
            </Button>
          </div>
          {import.meta.env.DEV && (
            <pre className="max-w-xl overflow-auto rounded-md bg-muted p-3 text-left text-xs text-muted-foreground">
              {this.state.error.message}
            </pre>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}