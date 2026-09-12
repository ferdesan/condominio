import { formatCpf, isValidCnpj, isValidCpf, maskDocument, onlyDigits } from '@/shared/utils/document.util';

describe('Validacao de documentos', () => {
  it('valida CPFs reais', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true);
    expect(isValidCpf('52998224725')).toBe(true);
  });

  it('rejeita CPFs invalidos', () => {
    expect(isValidCpf('111.111.111-11')).toBe(false);
    expect(isValidCpf('529.982.247-24')).toBe(false);
    expect(isValidCpf('123')).toBe(false);
    expect(isValidCpf('')).toBe(false);
  });

  it('valida CNPJs reais', () => {
    expect(isValidCnpj('11.444.777/0001-61')).toBe(true);
    expect(isValidCnpj('11444777000161')).toBe(true);
  });

  it('rejeita CNPJs invalidos', () => {
    expect(isValidCnpj('11.444.777/0001-62')).toBe(false);
    expect(isValidCnpj('00000000000000')).toBe(false);
    expect(isValidCnpj('123')).toBe(false);
  });

  it('normaliza e formata documentos', () => {
    expect(onlyDigits('529.982.247-25')).toBe('52998224725');
    expect(formatCpf('52998224725')).toBe('529.982.247-25');
  });

  it('mascara o documento para exposicao (LGPD)', () => {
    expect(maskDocument('52998224725')).toBe('529.***.***-25');
    expect(maskDocument(null)).toBeNull();
    expect(maskDocument('12')).toBe('***');
  });
});
