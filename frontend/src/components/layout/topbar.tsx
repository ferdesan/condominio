import { useNavigate } from 'react-router-dom';
import { LogOut, Menu, Moon, PanelLeftClose, PanelLeftOpen, Sun, User } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/hooks/use-auth';
import { useCondominium } from '@/hooks/use-condominium';
import { useTheme } from '@/hooks/use-theme';
import { initials } from '@/lib/utils';

type TopbarProps = {
  onOpenMenu: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
};

export function Topbar({ onOpenMenu, collapsed, onToggleCollapse }: TopbarProps) {
  const { user, logout } = useAuth();
  const { condominiums, selectedId, select } = useCondominium();
  const { resolvedTheme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleLogout = async (): Promise<void> => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b border-border bg-background/85 px-4 backdrop-blur sm:gap-3 sm:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onOpenMenu}
        aria-label="Abrir menu"
      >
        <Menu aria-hidden="true" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="hidden lg:flex"
        onClick={onToggleCollapse}
        aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
        aria-expanded={!collapsed}
      >
        {collapsed ? <PanelLeftOpen aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}
      </Button>

      {condominiums.length > 0 ? (
        <div className="min-w-0 flex-1 sm:max-w-xs">
          <Select value={selectedId ?? undefined} onValueChange={select}>
            <SelectTrigger aria-label="Condomínio selecionado">
              <SelectValue placeholder="Selecione o condomínio" />
            </SelectTrigger>
            <SelectContent>
              {condominiums.map((condominium) => (
                <SelectItem key={condominium.id} value={condominium.id}>
                  {condominium.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <div className="flex-1" />
      )}

      <div className="ml-auto flex items-center gap-1 sm:gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          aria-label={resolvedTheme === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'}
        >
          {resolvedTheme === 'dark' ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-10 gap-2 px-1.5 sm:px-2">
              <Avatar>
                {user?.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
                <AvatarFallback>{initials(user?.name)}</AvatarFallback>
              </Avatar>
              <span className="hidden max-w-32 truncate text-sm font-medium sm:inline">
                {user?.name}
              </span>
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end">
            <DropdownMenuLabel>
              <span className="block truncate text-sm font-medium text-foreground">
                {user?.name}
              </span>
              <span className="block truncate font-normal">{user?.email}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => navigate('/perfil')}>
              <User aria-hidden="true" />
              Meu perfil
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={handleLogout}
            >
              <LogOut aria-hidden="true" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
