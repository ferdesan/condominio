/** Validacao dos digitos verificadores de CPF e CNPJ (Receita Federal). */

export function onlyDigits(value: string): string {
  return (value ?? '').replace(/\D/g, '');
}

export function isValidCpf(value: string): boolean {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  const checkDigit = (slice: number): number => {
    let sum = 0;
    for (let index = 0; index < slice; index += 1) {
      sum += Number(cpf[index]) * (slice + 1 - index);
    }
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  return checkDigit(9) === Number(cpf[9]) && checkDigit(10) === Number(cpf[10]);
}

export function isValidCnpj(value: string): boolean {
  const cnpj = onlyDigits(value);
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;

  const checkDigit = (slice: number): number => {
    const weights = slice === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let index = 0; index < slice; index += 1) {
      sum += Number(cnpj[index]) * weights[index];
    }
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  return checkDigit(12) === Number(cnpj[12]) && checkDigit(13) === Number(cnpj[13]);
}

export function formatCpf(value: string): string {
  const cpf = onlyDigits(value);
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

export function maskDocument(value?: string | null): string | null {
  if (!value) return null;
  const digits = onlyDigits(value);
  if (digits.length < 5) return '***';
  return `${digits.slice(0, 3)}.***.***-${digits.slice(-2)}`;
}
