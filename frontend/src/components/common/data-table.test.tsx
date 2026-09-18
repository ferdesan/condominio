import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DataTable, type Column } from './data-table';

type Row = {
  id: string;
  name: string;
  document: string | null;
  units: number;
};

const columns: Column<Row>[] = [
  { key: 'name', label: 'Nome' },
  { key: 'document', label: 'Documento' },
  { key: 'units', label: 'Unidades' },
];

function makeRow(overrides: Partial<Row> = {}): Row {
  return { id: 'id-1', name: 'Alfa', document: '12345678000195', units: 3, ...overrides };
}

/** Uma pagina do servidor: `count` registros ja recortados pela API. */
function makeServerPage(count: number): Row[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `id-${index + 1}`,
    name: `Condomínio ${index + 1}`,
    document: `doc-${index + 1}`,
    units: index + 1,
  }));
}

describe('DataTable', () => {
  it('UT-091: renderiza as 20 linhas da pagina do servidor quando pageSize e 20', () => {
    const { rerender } = render(
      <DataTable
        columns={columns}
        data={makeServerPage(20)}
        pageable
        pageSize={20}
        currentPage={1}
        totalPages={3}
        idKey="id"
      />,
    );

    // 20 linhas de dados mais a linha de cabecalho.
    expect(screen.getAllByRole('row')).toHaveLength(21);
    expect(screen.getByText('Condomínio 20')).toBeInTheDocument();

    // A mesma pagina sem pageSize explicito: o recorte antigo cairia no padrao de
    // 10 e derrubaria metade das linhas sem avisar.
    rerender(
      <DataTable
        columns={columns}
        data={makeServerPage(20)}
        pageable
        currentPage={1}
        totalPages={3}
        idKey="id"
      />,
    );

    expect(screen.getAllByRole('row')).toHaveLength(21);
  });

  it('UT-092: coluna sem renderer com valor nulo mostra o placeholder, não a palavra null', () => {
    render(<DataTable columns={columns} data={[makeRow({ document: null })]} idKey="id" />);

    expect(screen.getByRole('cell', { name: '—' })).toBeInTheDocument();
    expect(screen.queryByText('null')).not.toBeInTheDocument();
  });

  it('UT-093: coluna sem renderer com valor zero mostra 0, não o placeholder', () => {
    render(<DataTable columns={columns} data={[makeRow({ units: 0 })]} idKey="id" />);

    expect(screen.getByRole('cell', { name: '0' })).toBeInTheDocument();
    expect(screen.queryByRole('cell', { name: '—' })).not.toBeInTheDocument();
  });

  it('UT-094: o campo de busca reflete o valor controlado recebido', () => {
    render(
      <DataTable
        columns={columns}
        data={[makeRow()]}
        searchable
        searchValue="alfa"
        onSearch={vi.fn()}
        idKey="id"
      />,
    );

    expect(screen.getByRole('textbox', { name: 'Buscar' })).toHaveValue('alfa');
  });

  it('UT-095: limpar o valor controlado esvazia o campo de busca', () => {
    const onSearch = vi.fn();
    const { rerender } = render(
      <DataTable
        columns={columns}
        data={[makeRow()]}
        searchable
        searchValue="alfa"
        onSearch={onSearch}
        idKey="id"
      />,
    );

    expect(screen.getByRole('textbox', { name: 'Buscar' })).toHaveValue('alfa');

    rerender(
      <DataTable
        columns={columns}
        data={[makeRow()]}
        searchable
        searchValue=""
        onSearch={onSearch}
        idKey="id"
      />,
    );

    expect(screen.getByRole('textbox', { name: 'Buscar' })).toHaveValue('');
  });

  it('UT-096: coluna com identificador livre e renderer próprio compila e renderiza', () => {
    // O identificador 'actions' nao existe em Row: so vale porque a coluna traz
    // o proprio renderer. O type check do projeto cobre este arquivo.
    const withActions: Column<Row>[] = [
      { key: 'name', label: 'Nome' },
      {
        key: 'actions',
        label: 'Ações',
        render: (_, row) => (
          <button type="button" onClick={() => undefined}>
            Editar {row.name}
          </button>
        ),
      },
    ];

    render(<DataTable columns={withActions} data={[makeRow()]} idKey="id" />);

    expect(screen.getByRole('columnheader', { name: 'Ações' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Editar Alfa' })).toBeInTheDocument();
  });

  it('UT-097: Enter sobre a linha focada dispara o handler da linha', async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    const row = makeRow();

    render(
      <DataTable
        columns={columns}
        data={[row]}
        onRowClick={onRowClick}
        searchable={false}
        idKey="id"
      />,
    );

    screen.getByRole('button', { name: /Alfa/ }).focus();
    await user.keyboard('{Enter}');

    expect(onRowClick).toHaveBeenCalledWith(row);
  });

  it('UT-098: a linha clicável e alcancável por teclado e expoe um papel acionável', async () => {
    const user = userEvent.setup();

    render(
      <DataTable
        columns={columns}
        data={[makeRow()]}
        onRowClick={vi.fn()}
        searchable={false}
        idKey="id"
      />,
    );

    // getByRole('button') ja prova o papel acionavel; o tab prova o alcance.
    const row = screen.getByRole('button', { name: /Alfa/ });
    await user.tab();

    expect(row).toHaveFocus();
  });

  it('UT-099: a paginação some com uma pagina e aparece com duas', () => {
    const { rerender } = render(
      <DataTable
        columns={columns}
        data={[makeRow()]}
        pageable
        currentPage={1}
        totalPages={1}
        idKey="id"
      />,
    );

    expect(screen.queryByRole('button', { name: 'Próxima página' })).not.toBeInTheDocument();

    rerender(
      <DataTable
        columns={columns}
        data={[makeRow()]}
        pageable
        currentPage={1}
        totalPages={2}
        idKey="id"
      />,
    );

    expect(screen.getByRole('button', { name: 'Próxima página' })).toBeInTheDocument();
  });

  it('UT-100: aria-sort fica na celula de cabecalho e reflete a direção ativa', () => {
    const sortableColumns: Column<Row>[] = [
      { key: 'name', label: 'Nome', sortable: true },
      { key: 'document', label: 'Documento', sortable: true },
    ];

    render(
      <DataTable
        columns={sortableColumns}
        data={[makeRow()]}
        sortable
        sort={{ column: 'name', direction: 'desc' }}
        onSort={vi.fn()}
        idKey="id"
      />,
    );

    expect(screen.getByRole('columnheader', { name: 'Nome' })).toHaveAttribute(
      'aria-sort',
      'descending',
    );
    expect(screen.getByRole('columnheader', { name: 'Documento' })).toHaveAttribute(
      'aria-sort',
      'none',
    );
  });
});
