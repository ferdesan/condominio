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

Seletor de data sobre o input nativo `type="date"`.

O valor é sincronizado depois do mount: trocar `value` — num reset de formulário, por
exemplo — atualiza o campo. Quem abre o calendário é o próprio navegador; o ícone à
direita é decorativo.

**Props:**
- `value`: Date | string - Data selecionada; mudanças após o mount são refletidas
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

### Textarea

Campo de texto multilinha para observações.

Já chega com `maxLength` de 2000 caracteres, que é o limite do servidor nesses campos. O
valor está exportado como `TEXTAREA_MAX_LENGTH` para quem precisar validar antes do envio.

**Props:** todas as de `<textarea>`. `rows` tem padrão 4 e `maxLength` padrão 2000.

**Exemplo:**

```tsx
import { Textarea } from '@/components/ui';

export function NotesField() {
  return <Textarea id="notes" placeholder="Observações sobre a unidade" defaultValue="" />;
}
```

---

### DateTimeInput

Data e hora em um único campo, sobre o input nativo `type="datetime-local"` — o
`DatePicker` cobre apenas a data, e reservas precisam das duas.

É totalmente controlado: o que aparece vem sempre de `value`, então um reset do
formulário chega ao campo sem precisar de sincronização.

**Props:**
- `value`: Date | string - Momento selecionado
- `onChange`: (value: string) => void - Recebe o valor local `yyyy-MM-ddTHH:mm`, ou `''` quando limpo
- `minDate`: Date - Limite inferior
- `maxDate`: Date - Limite superior

**Exemplo:**

```tsx
import { DateTimeInput } from '@/components/ui';
import { useState } from 'react';

export function BookingStart() {
  const [startsAt, setStartsAt] = useState('');

  return <DateTimeInput id="startsAt" value={startsAt} onChange={setStartsAt} minDate={new Date()} />;
}
```

---

### FormField

Junta rótulo, controle e mensagem de erro com a ligação aria do projeto: id explícito,
campo marcado como inválido, erro referenciado por `aria-describedby` no id `{id}-error`
e anunciado com `role="alert"`.

Passe uma função como filho para receber as props do controle. É assim que os controles
Radix — select, checkbox, moeda, data e hora — entram no formulário: eles expõem valor e
callback, e não a API de registro não controlada.

**Props:**
- `id`: string - Id do controle; a mensagem de erro usa `{id}-error`
- `label`: string - Rótulo associado ao controle
- `error`: string - Mensagem de erro; quando presente, marca o campo como inválido
- `description`: string - Texto de apoio, também ligado por `aria-describedby`
- `className`: string - Classe do contêiner
- `children`: ReactNode | (control: FormFieldControlProps) => ReactNode

**Exemplo:**

```tsx
import { FormField, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui';
import { Controller, useForm } from 'react-hook-form';

export function UnitForm() {
  const { register, control, formState: { errors } } = useForm<UnitFormValues>();

  return (
    <>
      {/* Campo registrado: o register cuida de name, onChange, onBlur e ref. */}
      <FormField id="number" label="Número" error={errors.number?.message}>
        {(field) => <Input {...field} {...register('number')} />}
      </FormField>

      {/* Campo controlado: o Controller liga o valor e o callback do Radix. */}
      <Controller
        control={control}
        name="status"
        render={({ field, fieldState }) => (
          <FormField id="status" label="Status" error={fieldState.error?.message}>
            {(aria) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger {...aria}>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="VACANT">Vaga</SelectItem>
                  <SelectItem value="OCCUPIED">Ocupada</SelectItem>
                </SelectContent>
              </Select>
            )}
          </FormField>
        )}
      />
    </>
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

A paginação é do servidor por padrão: as linhas recebidas são exatamente as linhas
renderizadas. Ligue `clientPagination` apenas quando a coleção inteira já estiver em
memória — sem isso, nenhum recorte acontece no cliente.

A busca é controlada por `searchValue`, então quem usa a tabela consegue limpá-la. O
callback dispara a cada tecla; o debounce pertence a quem faz a requisição.

A direção da ordenação usa o vocabulário `asc`/`desc`. Traduzir para o formato que a API
espera é responsabilidade da camada de dados, não deste componente (ADR-008).

**Props:**
- `columns`: Column<T>[] - Definição das colunas
- `data`: T[] - Linhas da página atual
- `loading`: boolean - Estado de carregamento
- `searchable`: boolean - Habilitar busca (padrão: true)
- `searchPlaceholder`: string - Placeholder da busca
- `searchValue`: string - Valor controlado da busca
- `onSearch`: (term: string) => void - Callback da busca, a cada tecla
- `sortable`: boolean - Habilitar ordenação (padrão: true)
- `onSort`: (column: string, direction: 'asc' | 'desc') => void - Callback da ordenação
- `sort`: SortState - Estado atual da ordenação
- `pageable`: boolean - Habilitar paginação (padrão: true)
- `clientPagination`: boolean - Recortar `data` no cliente (padrão: false)
- `pageSize`: number - Itens por página; só recorta com `clientPagination` ligado
- `currentPage`: number - Página atual
- `totalPages`: number - Total de páginas; com 1 os controles não aparecem
- `onPageChange`: (page: number) => void - Callback da paginação
- `emptyIcon`: LucideIcon - Ícone do estado vazio
- `emptyTitle`: string - Título do estado vazio
- `emptyDescription`: string - Descrição do estado vazio
- `rowClassName`: (row: T, index: number) => string - Classe CSS da linha
- `onRowClick`: (row: T) => void - Callback ao ativar a linha, por clique ou teclado
- `idKey`: keyof T - Chave única de identificação

**Colunas:**

A chave de uma coluna é um campo de `T`. Uma coluna que traz o próprio `render` — ações,
por exemplo — pode usar um identificador livre, já que não lê nenhum campo da linha
(ADR-009).

Sem `render`, valores nulos e indefinidos aparecem como um placeholder neutro; zero
aparece como `0`.

**Acessibilidade:**
- `aria-sort` fica na célula de cabeçalho e acompanha a coluna ativa.
- Com `onRowClick`, a linha é focável, expõe papel de botão e ativa com Enter ou Espaço.

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
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortState>({ column: null, direction: 'asc' });
  const { data, meta } = useUsers({ page, perPage: 20, search, sort });

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
      // Identificador livre: só vale porque a coluna traz o próprio renderer.
      key: 'actions',
      label: 'Ações',
      render: (_, row) => (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => handleEdit(row)}>
            <Edit2 className="size-4" />
          </Button>
          <Button variant="destructive" size="sm" onClick={() => handleDelete(row)}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      pageable
      pageSize={20}
      currentPage={page}
      totalPages={meta.totalPages}
      onPageChange={setPage}
      searchable
      searchValue={search}
      onSearch={setSearch}
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

**Sobre `asChild` e `loading`:** são mutuamente exclusivos. Com `asChild` o botão
repassa o filho intacto e ignora `loading` e `disabled`, porque o `Slot` do Radix
aceita exatamente um filho — o indicador de carga seria um segundo. Use `asChild`
para envolver um link, que não tem estado de carregamento próprio.

**Acessibilidade:** enquanto `loading` está ativo o botão acrescenta o texto
`Carregando` em leitura de tela, então o nome acessível passa a ser
`Carregando <rótulo>`. Testes que localizam o botão pelo nome durante a requisição
devem casar por trecho.

**Exemplo:**

```tsx
import { Button } from '@/components/ui';
import { Link } from 'react-router-dom';

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
      <Button asChild>
        <Link to="/condominios">Como link</Link>
      </Button>
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
  DateTimeInput,
  Textarea,
  FormField,
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
