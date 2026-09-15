import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useAccountTheme } from '@/hooks/use-account-theme';
import { useRealtime } from '@/hooks/use-realtime';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';

export function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  // Primeiro acesso neste dispositivo herda o tema guardado na conta; depois
  // disso a escolha local manda.
  useAccountTheme();

  // Canal de tempo real. E um acelerador: se nao conectar, nada muda — as telas
  // continuam se atualizando pela invalidacao das proprias mutacoes.
  useRealtime();

  // Trocar de rota no mobile fecha o drawer e devolve o topo da pagina.
  useEffect(() => {
    setMenuOpen(false);
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <div className="flex min-h-svh bg-background">
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenMenu={() => setMenuOpen(true)} />

        <main className="flex-1 px-4 py-5 safe-bottom sm:px-6 sm:py-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
