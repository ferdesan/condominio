import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Building2, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/hooks/use-theme';

export interface AuthShellProps {
  /** Dito sob a marca: o que esta tela faz. */
  subtitle: string;
  children: ReactNode;
}

/**
 * A moldura das telas publicas: alternador de tema, marca e um cartao centrado.
 *
 * Extraida de `login-page.tsx` quando a recuperacao de senha trouxe mais duas
 * telas para o mesmo lugar. Tres copias da mesma moldura divergiriam na
 * primeira mudanca de marca, e a divergencia apareceria justamente no fluxo em
 * que a pessoa ja esta com um problema.
 *
 * **O `h1` e a marca, e nao o titulo da tela.** As tres paginas publicas sao a
 * mesma porta de entrada; o que muda e o que se faz nela, e isso vive no
 * subtitulo e no `h2` de cada cartao.
 *
 * **O alternador de tema fica aqui** porque nao ha topbar antes do login — e a
 * unica forma de escolher o tema sem uma sessao. Em `/perfil` a escolha passa a
 * ser gravada na conta; aqui ela e so do dispositivo.
 */
export function AuthShell({ subtitle, children }: AuthShellProps) {
  const { resolvedTheme, toggleTheme } = useTheme();

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <div className="flex justify-end p-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          aria-label={resolvedTheme === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'}
        >
          {resolvedTheme === 'dark' ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
        </Button>
      </div>

      <main className="flex flex-1 items-center justify-center px-4 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="w-full max-w-sm"
        >
          <div className="mb-7 flex flex-col items-center gap-3 text-center">
            <span className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-card">
              <Building2 className="size-6" aria-hidden="true" />
            </span>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Condomínio SaaS</h1>
              <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
            </div>
          </div>

          {children}
        </motion.div>
      </main>
    </div>
  );
}
