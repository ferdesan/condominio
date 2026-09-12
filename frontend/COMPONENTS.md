# Componentes Base da UI

Documentação dos componentes reutilizáveis da aplicação React de gestão de condomínios.

## 📋 Índice

1. [Componentes de Formulário](#componentes-de-formulário)
2. [Componentes Comuns](#componentes-comuns)
3. [Componentes de Layout](#componentes-de-layout)
4. [Critérios de Qualidade](#critérios-de-qualidade)

---

## Componentes de Formulário

### Input

Campo de entrada de texto básico.

**Props:**
- `type`: string - Tipo do input (text, email, password, etc)
- `placeholder`: string - Texto placeholder
- `disabled`: boolean - Desabilitar o input
- `aria-invalid`: boolean - Marcação de erro

**Exemplo:**

```tsx
import { Input } from '@/components/ui';

export function LoginForm() {
  return (
    <div className="space-y-4">
      <Input type="email" placeholder="seu@email.com" />
      <Input type="password" placeholder="Sua senha" />
    </div>
  );
}
```

---

### Select

Seletor de opções.

**Props:**
- `value`: string - Valor selecionado
- `onValueChange`: (value: string) => void - Callback ao mudar valor

**Exemplo:**

```tsx
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui';

export function StatusFilter() {
  return (
    <Select defaultValue="active">
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Selecione um status" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="active">Ativo</SelectItem>
        <SelectItem value="inactive">Inativo</SelectItem>
        <SelectItem value="pending">Pendente</SelectItem>
      </SelectContent>
    </Select>
  );
}
```

---

### Checkbox

Caixa de seleção com estado controlado.

**Props:**
- `checked`: boolean - Estado selecionado
- `onCheckedChange`: (checked: boolean) => void - Callback ao mudar estado
- `disabled`: boolean - Desabilitar
- `id`: string - ID para associar com label

**Exemplo:**

```tsx
import { Checkbox } from '@/components/ui';
import { Label } from '@/components/ui';
import { useState } from 'react';

export function TermsCheckbox() {
  const [agreed, setAgreed] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <Checkbox id="terms" checked={agreed} onCheckedChange={setAgreed} />
      <Label htmlFor="terms">Concordo com os termos</Label>
    </div>
  );
}
```

---

### DatePicker

Seletor de data com validação.

**Props:**
- `value`: Date | string - Data selecionada
- `onChange`: (date: Date) => void - Callback ao mudar data
- `minDate`: Date - Data mínima permitida
- `maxDate`: Date - Data máxima permitida
- `placeholder`: string - Placeholder

**Exemplo:**

```tsx
import { DatePicker } from '@/components/ui';
import { useState } from 'react';

export function BirthdayForm() {
  const [birthday, setBirthday] = useState<Date>();

  return (
    <DatePicker
      value={birthday}
      onChange={setBirthday}
      placeholder="Selecione sua data de nascimento"
      maxDate={new Date()}
    />
  );
}
```

---

### CurrencyInput

Campo de entrada para valores monetários.

**Props:**
- `value`: number | string - Valor em número
- `onChange`: (value: number) => void - Callback com valor parseado
- `currency`: string - Código da moeda (padrão: BRL)
- `locale`: string - Localização para formato (padrão: pt-BR)
- `placeholder`: string - Placeholder

**Exemplo:**

```tsx
import { CurrencyInput } from '@/components/ui';
import { useState } from 'react';

export function PriceForm() {
  const [price, setPrice] = useState(0);

  return (
    <div>
      <CurrencyInput value={price} onChange={setPrice} placeholder="R$ 0,00" />
      <p className="text-sm text-muted-foreground">Valor: R$ {price.toFixed(2)}</p>
    </div>
  );
}
```

---

### PhoneInput

Campo de entrada para números de telefone com formatação automática.

**Props:**
- `value`: string - Número de telefone (apenas dígitos)
- `onChange`: (value: string) => void - Callback com valor em dígitos
- `format`: 'BR' | 'US' - Formato do telefone (padrão: BR)
- `placeholder`: string - Placeholder

**Formato BR:** `(XX) XXXXX-XXXX` (ex: (11) 98765-4321)
**Formato US:** `(XXX) XXX-XXXX` (ex: (415) 555-0123)

**Exemplo:**

```tsx
import { PhoneInput } from '@/components/ui';
import { useState } from 'react';

export function ContactForm() {
  const [phone, setPhone] = useState('');

  return (
    <div>
      <PhoneInput
        value={phone}
        onChange={setPhone}
        format="BR"
        placeholder="(00) 00000-0000"
      />
      <p className="text-sm text-muted-foreground">Número: {phone}</p>
    </div>
  );
}
```

---

## Componentes Comuns

### PageHeader

Cabeçalho padrão de página com título, subtítulo e ações.

**Props:**
- `title`: string - Título da página
- `description`: string - Descrição/subtítulo (opcional)
- `actions`: ReactNode - Elementos de ação (botões, etc) (opcional)

**Exemplo:**

```tsx
import { PageHeader } from '@/components/common';
import { Button } from '@/components/ui';

export function UsersPage() {
  return (
    <>
      <PageHeader
        title="Usuários"
        description="Gerenciar usuários do sistema"
        actions={<Button>Novo Usuário</Button>}
      />
      {/* Conteúdo da página */}
    </>
  );
}
```

---

### DataTable

Tabela de dados com paginação, ordenação e busca.

**Props:**
- `columns`: Column[] - Definição das colunas
- `data`: T[] - Dados da tabela
- `loading`: boolean - Estado de carregamento
- `searchable`: boolean - Habilitar busca (padrão: true)
- `searchPlaceholder`: string - Placeholder da busca
- `onSearch`: (term: string) => void - Callback da busca
- `sortable`: boolean - Habilitar ordenação (padrão: true)
- `onSort`: (column: string, direction: 'asc' | 'desc') => void - Callback da ordenação
- `sort`: SortState - Estado atual da ordenação
- `pageable`: boolean - Habilitar paginação (padrão: true)
- `pageSize`: number - Itens por página
- `currentPage`: number - Página atual
- `totalPages`: number - Total de páginas
- `onPageChange`: (page: number) => void - Callback da paginação
- `emptyIcon`: LucideIcon - Ícone do estado vazio
- `emptyTitle`: string - Título do estado vazio
- `emptyDescription`: string - Descrição do estado vazio
- `rowClassName`: (row: T, index: number) => string - Classe CSS da linha
- `onRowClick`: (row: T) => void - Callback ao clicar na linha
- `idKey`: keyof T - Chave única de identificação

**Exemplo:**

```tsx
import { DataTable, type Column, type SortState } from '@/components/common';
import { Button } from '@/components/ui';
import { useState } from 'react';
import { Trash2, Edit2 } from 'lucide-react';

interface User {
  id: number;
  name: string;
  email: string;
  status: 'active' | 'inactive';
}

export function UsersTable() {
  const [users, setUsers] = useState<User[]>([
    { id: 1, name: 'João', email: 'joao@example.com', status: 'active' },
    { id: 2, name: 'Maria', email: 'maria@example.com', status: 'active' },
  ]);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortState>({ column: null, direction: 'asc' });

  const columns: Column<User>[] = [
    { key: 'id', label: 'ID', sortable: true },
    { key: 'name', label: 'Nome', sortable: true },
    { key: 'email', label: 'Email' },
    {
      key: 'status',
      label: 'Status',
      render: (value) => (
        <span className={value === 'active' ? 'text-green-600' : 'text-red-600'}>
          {value === 'active' ? 'Ativo' : 'Inativo'}
        </span>
      ),
    },
    {
      key: 'id',
      label: 'Ações',
      render: (_, row) => (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleEdit(row)}
          >
            <Edit2 className="size-4" />
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => handleDelete(row)}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={users}
      currentPage={page}
      totalPages={Math.ceil(users.length / 10)}
      onPageChange={setPage}
      sort={sort}
      onSort={(col, dir) => setSort({ column: col, direction: dir })}
      emptyTitle="Nenhum usuário encontrado"
      idKey="id"
    />
  );
}
```

---

### Dialog

Diálogo modal para interações do usuário.

**Componentes:**
- `Dialog` - Container principal
- `DialogTrigger` - Elemento que abre o diálogo
- `DialogContent` - Conteúdo do diálogo
- `DialogHeader` - Cabeçalho do diálogo
- `DialogTitle` - Título do diálogo
- `DialogDescription` - Descrição do diálogo
- `DialogFooter` - Rodapé do diálogo
- `DialogClose` - Botão de fechar

**Exemplo:**

```tsx
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui';
import { Button } from '@/components/ui';
import { useState } from 'react';

export function EditUserDialog({ user, onSave }) {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState(user);

  const handleSave = async () => {
    await onSave(formData);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Editar Usuário</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar Usuário</DialogTitle>
          <DialogDescription>
            Atualize os dados do usuário
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Formulário */}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

---

### ConfirmDialog

Diálogo de confirmação especializado em exclusões e operações críticas.

**Props:**
- `open`: boolean - Estado do diálogo
- `title`: string - Título do diálogo
- `description`: string - Descrição (opcional)
- `actionLabel`: string - Rótulo do botão de ação (padrão: Confirmar)
- `cancelLabel`: string - Rótulo do botão cancelar (padrão: Cancelar)
- `variant`: 'danger' | 'warning' | 'info' - Tipo de confirmação (padrão: danger)
- `loading`: boolean - Estado de carregamento
- `onConfirm`: () => void | Promise<void> - Callback ao confirmar
- `onCancel`: () => void - Callback ao cancelar
- `children`: ReactNode - Conteúdo adicional (opcional)

**Exemplo:**

```tsx
import { ConfirmDialog } from '@/components/common';
import { Button } from '@/components/ui';
import { useState } from 'react';

export function DeleteUserButton({ userId, onDelete }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onDelete(userId);
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        variant="destructive"
        onClick={() => setOpen(true)}
      >
        Deletar Usuário
      </Button>

      <ConfirmDialog
        open={open}
        title="Deletar usuário?"
        description="Esta ação não pode ser desfeita. Todos os dados associados serão perdidos."
        actionLabel="Deletar"
        cancelLabel="Cancelar"
        variant="danger"
        loading={loading}
        onConfirm={handleConfirm}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}
```

---

### FilterPanel

Painel de filtros dinâmicos.

**Props:**
- `filters`: Filter[] - Array de filtros ativos
- `onFilterChange`: (filters: Filter[]) => void - Callback ao mudar filtros
- `onClear`: () => void - Callback ao limpar filtros
- `children`: ReactNode - Controles de filtro
- `title`: string - Título do painel (padrão: Filtros)
- `showActiveOnly`: boolean - Mostrar apenas se houver filtros ativos

**Interface Filter:**
```tsx
interface Filter {
  id: string;
  label: string;
  value: any;
}
```

**Exemplo:**

```tsx
import { FilterPanel, type Filter } from '@/components/common';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui';
import { useState } from 'react';

export function UserFilters() {
  const [filters, setFilters] = useState<Filter[]>([
    { id: 'status', label: 'Status', value: '' },
    { id: 'role', label: 'Função', value: '' },
  ]);

  const handleStatusChange = (value: string) => {
    setFilters(filters.map(f =>
      f.id === 'status' ? { ...f, value } : f
    ));
  };

  return (
    <FilterPanel
      filters={filters}
      onFilterChange={setFilters}
      onClear={() => setFilters(filters.map(f => ({ ...f, value: '' })))}
      title="Filtros de Usuários"
    >
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium mb-2 block">Status</label>
          <Select
            value={filters.find(f => f.id === 'status')?.value}
            onValueChange={handleStatusChange}
          >
            <SelectTrigger>
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todos</SelectItem>
              <SelectItem value="active">Ativo</SelectItem>
              <SelectItem value="inactive">Inativo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </FilterPanel>
  );
}
```

---

### CrudLayout

Layout padrão para páginas CRUD.

**Props:**
- `header`: ReactNode - Cabeçalho da página
- `filters`: ReactNode - Painel de filtros (opcional)
- `content`: ReactNode - Conteúdo principal
- `footer`: ReactNode - Rodapé (opcional)
- `sidebar`: ReactNode - Barra lateral (opcional)
- `sidebarPosition`: 'left' | 'right' - Posição da barra lateral

**Exemplo:**

```tsx
import { CrudLayout } from '@/components/common';
import { PageHeader } from '@/components/common';
import { DataTable } from '@/components/common';
import { FilterPanel } from '@/components/common';
import { Button } from '@/components/ui';
import { useState } from 'react';

export function UsersPage() {
  const [filters, setFilters] = useState([]);

  return (
    <CrudLayout
      header={
        <PageHeader
          title="Usuários"
          description="Gerenciar usuários do sistema"
          actions={<Button>Novo Usuário</Button>}
        />
      }
      filters={
        <FilterPanel
          filters={filters}
          onFilterChange={setFilters}
          onClear={() => setFilters([])}
        >
          {/* Controles de filtro */}
        </FilterPanel>
      }
      content={
        <DataTable
          columns={[
            { key: 'id', label: 'ID' },
            { key: 'name', label: 'Nome' },
            { key: 'email', label: 'Email' },
          ]}
          data={[]}
        />
      }
      sidebar={
        <div className="space-y-4">
          {/* Conteúdo da barra lateral */}
        </div>
      }
    />
  );
}
```

---

## Componentes de Layout

### Button

Botão com múltiplas variantes e tamanhos.

**Props:**
- `variant`: 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive' - Estilo do botão
- `size`: 'sm' | 'md' | 'lg' - Tamanho do botão
- `loading`: boolean - Estado de carregamento com spinner
- `disabled`: boolean - Desabilitar botão
- `asChild`: boolean - Renderizar como filho (para composição)

**Exemplo:**

```tsx
import { Button } from '@/components/ui';

export function ActionButtons() {
  return (
    <div className="flex gap-2">
      <Button>Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="destructive">Destructive</Button>
      <Button loading>Loading...</Button>
      <Button disabled>Disabled</Button>
    </div>
  );
}
```

---

### Card

Componente de cartão para agrupar conteúdo.

**Componentes:**
- `Card` - Container principal
- `CardHeader` - Cabeçalho do cartão
- `CardTitle` - Título do cartão
- `CardDescription` - Descrição do cartão
- `CardContent` - Conteúdo principal
- `CardFooter` - Rodapé do cartão

**Exemplo:**

```tsx
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui';
import { Button } from '@/components/ui';

export function UserCard({ user }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{user.name}</CardTitle>
        <CardDescription>{user.email}</CardDescription>
      </CardHeader>
      <CardContent>
        <p>Status: {user.status}</p>
      </CardContent>
      <CardFooter>
        <Button>Editar</Button>
      </CardFooter>
    </Card>
  );
}
```

---

## Critérios de Qualidade

Todos os componentes foram desenvolvidos seguindo os seguintes critérios:

### ✅ TypeScript

- Todos os componentes possuem tipagem completa
- Props são bem definidas com interfaces
- Suporte a tipos genéricos onde apropriado

### ✅ Responsividade

- Adapta-se a diferentes tamanhos de tela
- Usa Tailwind CSS para media queries
- Testes em mobile, tablet e desktop

### ✅ Acessibilidade

- Suporte a ARIA labels e roles
- Navegação por teclado
- Contraste de cores WCAG AA
- Componentes de formulário com labels associados

### ✅ Documentação

- Documentação inline com JSDoc
- Exemplos de uso para cada componente
- Explicação de props e comportamento
- Casos de uso comuns documentados

---

## Importando Componentes

### Componentes de UI

```tsx
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Checkbox,
  DatePicker,
  CurrencyInput,
  PhoneInput,
  Dialog,
  DialogContent,
  DialogTrigger,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from '@/components/ui';
```

### Componentes Comuns

```tsx
import {
  PageHeader,
  DataTable,
  ConfirmDialog,
  FilterPanel,
  CrudLayout,
  EmptyState,
} from '@/components/common';
```

---

## Temas e Customização

Os componentes usam variáveis CSS definidas em `index.css` e `tailwind.config.js`:

- `primary`, `primary-foreground` - Cores primárias
- `secondary`, `secondary-foreground` - Cores secundárias
- `destructive`, `destructive-foreground` - Cores de erro/delete
- `muted`, `muted-foreground` - Cores neutras
- `card`, `card-foreground` - Cores de card
- E muitos outros tokens de design

Customize as cores editando `tailwind.config.js`.

---

## Suporte e Contribuições

Para dúvidas, sugestões ou contribuições, consulte a documentação principal do projeto ou abra uma issue no repositório.
