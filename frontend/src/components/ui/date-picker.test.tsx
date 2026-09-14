import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DatePicker } from './date-picker';

// Risco registrado no TechSpec: sem sincronizacao o valor so vale no mount, e
// editar um registro existente mostraria a data antiga.
describe('DatePicker', () => {
  it('reflete um valor trocado depois do mount, inclusive o reset para vazio', () => {
    const { rerender } = render(
      <DatePicker aria-label="Data" value={new Date('2026-09-13T12:00:00')} />,
    );

    expect(screen.getByLabelText('Data')).toHaveValue('2026-09-13');

    rerender(<DatePicker aria-label="Data" value={new Date('2026-10-01T12:00:00')} />);
    expect(screen.getByLabelText('Data')).toHaveValue('2026-10-01');

    rerender(<DatePicker aria-label="Data" value={undefined} />);
    expect(screen.getByLabelText('Data')).toHaveValue('');
  });
});
