import { describe, expect, it } from 'vitest';
import { BLOCK_FORM_DEFAULTS, blockSchema, type BlockFormValues } from './block-schema';

function values(overrides: Partial<BlockFormValues> = {}): BlockFormValues {
  return { ...BLOCK_FORM_DEFAULTS, name: 'Torre A', ...overrides };
}

function issueOn(input: BlockFormValues, path: string): string | undefined {
  const result = blockSchema.safeParse(input);
  if (result.success) return undefined;
  return result.error.issues.find((issue) => issue.path.join('.') === path)?.message;
}

describe('blockSchema', () => {
  it('UT-028: bloco com zero andares falha; com um, passa', () => {
    expect(issueOn(values({ floors: '0' }), 'floors')).toBe(
      'O numero de andares deve estar entre 1 e 200.',
    );
    expect(issueOn(values({ floors: '1' }), 'floors')).toBeUndefined();
  });
});
