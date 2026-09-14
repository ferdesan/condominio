import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

import { WEEKDAYS } from '../common-area-schema';

export interface WeekdayPickerProps {
  /** `true` grava nulo no servidor: a area abre todos os dias. */
  allWeekdays: boolean;
  onAllWeekdaysChange: (all: boolean) => void;
  /** Dias liberados quando a restricao esta ativa. Pode estar vazio. */
  weekdays: number[];
  onWeekdaysChange: (weekdays: number[]) => void;
  disabled?: boolean;
}

/**
 * Escolha dos dias da semana liberados para reserva.
 *
 * Sao dois controles porque o servidor guarda tres estados, nao dois: nulo
 * libera a semana inteira, uma lista restringe aos dias dela, e a lista vazia
 * nao libera nenhum. Um conjunto de caixas sozinho colapsaria nulo e vazio no
 * mesmo desenho — nenhum dia marcado — e nao daria como gravar "todos".
 *
 * Os dias sao inteiros de 0 a 6 com domingo em zero, como o servidor numera e
 * como `reservation-rules.ts` os le.
 */
export function WeekdayPicker({
  allWeekdays,
  onAllWeekdaysChange,
  weekdays,
  onWeekdaysChange,
  disabled,
}: WeekdayPickerProps) {
  const selected = new Set(weekdays);

  function toggle(day: number, checked: boolean): void {
    const next = new Set(selected);
    if (checked) next.add(day);
    else next.delete(day);
    onWeekdaysChange([...next].sort((a, b) => a - b));
  }

  return (
    <fieldset className="space-y-3" disabled={disabled}>
      <legend className="text-sm font-medium">Dias da semana</legend>

      <div className="flex items-center gap-2">
        <Checkbox
          id="common-area-all-weekdays"
          checked={allWeekdays}
          onCheckedChange={(checked) => onAllWeekdaysChange(checked === true)}
        />
        <Label htmlFor="common-area-all-weekdays" className="font-normal">
          Todos os dias
        </Label>
      </div>

      {allWeekdays ? (
        <p className="text-sm text-muted-foreground">
          A area fica disponivel em qualquer dia da semana.
        </p>
      ) : (
        <>
          <div
            role="group"
            aria-label="Dias liberados"
            className="flex flex-wrap gap-x-4 gap-y-2"
          >
            {WEEKDAYS.map((weekday) => (
              <div key={weekday.value} className="flex items-center gap-2">
                <Checkbox
                  id={`common-area-weekday-${weekday.value}`}
                  checked={selected.has(weekday.value)}
                  onCheckedChange={(checked) => toggle(weekday.value, checked === true)}
                />
                <Label
                  htmlFor={`common-area-weekday-${weekday.value}`}
                  className="font-normal"
                >
                  {weekday.label}
                </Label>
              </div>
            ))}
          </div>

          {/*
            Nenhum dia marcado e um estado que o servidor aceita e que impede
            toda reserva. Dize-lo evita que passe por engano — mas nao e um erro
            de validacao, porque bloquear a area de proposito e legitimo.
          */}
          {weekdays.length === 0 ? (
            <p
              role="status"
              className="rounded-md border border-warning/40 bg-warning/15 px-3 py-2 text-sm text-foreground"
            >
              Nenhum dia liberado: a area nao aceitara reservas ate que ao menos um
              seja marcado.
            </p>
          ) : null}
        </>
      )}
    </fieldset>
  );
}
