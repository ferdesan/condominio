import { ValueTransformer } from 'typeorm';

/**
 * MySQL devolve DECIMAL como string para preservar a precisao; a API sempre
 * expoe numeros. Na escrita o valor e arredondado para 2 casas.
 *
 * `undefined` e repassado como `undefined` de proposito: assim a coluna usa o
 * DEFAULT definido no schema em vez de gravar NULL.
 */
export const numericTransformer: ValueTransformer = {
  to: (value?: number | null): number | null | undefined => {
    if (value === undefined) return undefined;
    if (value === null) return null;
    return Math.round(Number(value) * 100) / 100;
  },
  from: (value?: string | number | null): number | null => {
    if (value === null || value === undefined) return null;
    return Number(value);
  },
};

/**
 * Variante com mais casas decimais, usada por fracoes ideais e pesos de voto,
 * onde o arredondamento em 2 casas distorceria o rateio.
 */
export const preciseNumericTransformer: ValueTransformer = {
  to: (value?: number | null): number | null | undefined => {
    if (value === undefined) return undefined;
    if (value === null) return null;
    return Math.round(Number(value) * 1_000_000) / 1_000_000;
  },
  from: (value?: string | number | null): number | null => {
    if (value === null || value === undefined) return null;
    return Number(value);
  },
};
