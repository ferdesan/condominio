import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiGetPaginated, type ApiError, type Paginated } from '@/lib/api';
import { MAX_PER_PAGE } from '@/lib/crud';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { useAuth } from '@/hooks/use-auth';
import { useCondominium } from '@/hooks/use-condominium';
import type { Resident } from '@/types/api';
import { useExportOwnData, useExportResidentData } from '../lgpd-hooks';

/**
 * Portabilidade: quem gerencia escolhe o morador; o morador exporta os proprios
 * dados. O arquivo segue o formato canonico do ADR-002 e o download acontece na
 * camada de hooks, que tambem e quem conhece a rota.
 */
export function LgpdExportTab() {
  const { can } = useAuth();
  const { selectedId } = useCondominium();
  const [residentId, setResidentId] = useState<string | null>(null);

  const canManage = can('lgpd:manage');
  const exportOwn = useExportOwnData();
  const exportResident = useExportResidentData();

  const residentsQuery = useQuery<Paginated<Resident>, ApiError>({
    queryKey: ['residents', 'lgpd-export-options', selectedId],
    queryFn: () =>
      apiGetPaginated<Resident>('/residents', {
        params: {
          perPage: MAX_PER_PAGE,
          condominiumId: selectedId ?? '',
          sortBy: 'name',
          sortOrder: 'ASC',
        },
      }),
    enabled: Boolean(selectedId) && canManage,
  });
  const residents = useMemo(() => residentsQuery.data?.data ?? [], [residentsQuery.data]);

  // A unidade vai como dica, e nao por enfeite: dois moradores podem se chamar
  // "Ana Silva", e aqui escolher o errado exporta os dados pessoais de outra
  // pessoa. Ela tambem entra na busca, entao "101" acha quem mora la.
  const residentOptions = useMemo(
    () =>
      residents.map((resident) => ({
        value: resident.id,
        label: resident.name,
        hint: resident.unit
          ? `${resident.unit.number}${resident.unit.block?.name ? ` · ${resident.unit.block.name}` : ''}`
          : undefined,
      })),
    [residents],
  );

  function handleOwnExport(): void {
    exportOwn.mutate(undefined, {
      onSuccess: () => toast.success('Exportação dos seus dados gerada.'),
    });
  }

  function handleResidentExport(): void {
    if (!residentId) return;
    exportResident.mutate(residentId, {
      onSuccess: () => toast.success('Exportação dos dados do morador gerada.'),
    });
  }

  if (canManage) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Exportação de dados</CardTitle>
          <CardDescription>
            Gere o arquivo JSON com os dados pessoais de um morador, no formato definido para a
            portabilidade (LGPD Art. 18, V).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-full max-w-xs">
              <Combobox
                aria-label="Selecionar morador"
                value={residentId ?? undefined}
                onValueChange={setResidentId}
                options={residentOptions}
                placeholder="Selecione um morador"
                searchPlaceholder="Buscar por nome ou unidade"
                emptyMessage="Nenhum morador corresponde à busca."
              />
            </div>
            <Button
              disabled={!residentId || exportResident.isPending}
              onClick={handleResidentExport}
            >
              Exportar dados do morador
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Seus dados pessoais</CardTitle>
        <CardDescription>
          Baixe um arquivo JSON com os dados que o condomínio guarda sobre você, para a
          portabilidade (LGPD Art. 18, V).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button loading={exportOwn.isPending} onClick={handleOwnExport}>
          Exportar meus dados
        </Button>
      </CardContent>
    </Card>
  );
}
