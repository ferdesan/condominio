// @vitest-environment node
/**
 * O portao do pipeline — o que este esforco se propos a consertar.
 *
 * Tres coisas precisam ser verdade ao mesmo tempo e nenhuma delas se enxerga de
 * dentro de uma tela: que uma suite roda ate o fim e relata o que rodou, que um
 * caso que falha derruba o processo com codigo diferente de zero, e que o job de
 * teste nao carrega tolerancia a falha — sem a terceira, as duas primeiras nao
 * sustentam portao nenhum.
 *
 * A suite nao pode rodar a si mesma para provar a primeira, entao o que roda
 * aqui e uma suite de brinquedo num diretorio temporario, com o mesmo runner e
 * as mesmas regras. A execucao da suite de verdade e a evidencia registrada na
 * tarefa, e nao um caso dentro dela.
 *
 * Ambiente `node`: este arquivo le arquivos e cria processos, e nao toca no DOM.
 */

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { loadConfigFromFile } from 'vite';

const FRONTEND = fileURLToPath(new URL('../../', import.meta.url));
const REPO = fileURLToPath(new URL('../../../', import.meta.url));
const VITEST_BIN = join(FRONTEND, 'node_modules', 'vitest', 'vitest.mjs');

const workflow = readFileSync(join(REPO, '.github', 'workflows', 'ci-cd.yml'), 'utf8');
const packageJson = JSON.parse(readFileSync(join(FRONTEND, 'package.json'), 'utf8')) as {
  scripts: Record<string, string>;
};

/**
 * O bloco de um passo do workflow, do seu `- name:` ate o proximo.
 *
 * Um parser de YAML completo resolveria isto, mas o unico disponivel aqui e uma
 * dependencia transitiva: prender um teste do pipeline a ela e trocar uma
 * fragilidade por outra. O recorte por passo basta para o que se afirma abaixo.
 */
function step(name: string): string {
  const start = workflow.indexOf(`- name: ${name}`);
  expect(start, `passo ausente no workflow: ${name}`).toBeGreaterThan(-1);
  const next = workflow.indexOf('      - name:', start + 1);
  return workflow.slice(start, next === -1 ? undefined : next);
}

/** Roda o runner sobre um projeto de brinquedo, isolado do deste repositorio. */
function runToySuite(files: Record<string, string>): { status: number | null; output: string } {
  const root = mkdtempSync(join(tmpdir(), 'pipeline-gate-'));
  temporaryRoots.push(root);
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(root, name), content, 'utf8');
  }

  // `--no-file-parallelism` nao e detalhe: sem ele cada execucao aninhada abre a
  // propria pool de workers enquanto a suite de fora ja ocupa a maquina inteira,
  // e a disputa empurra os casos de jornada mais pesados para alem do timeout —
  // uma falha do ambiente, nao do codigo. A suite de brinquedo tem dois arquivos
  // minusculos e nao ganha nada com paralelismo.
  //
  // `--root` tira o projeto de brinquedo do alcance da config deste
  // repositorio, entao o runner aninhado roda com os padroes — que e justamente
  // o que se quer isolar.
  //
  // Sem desligar a cor, o relatorio traz escapes no meio dos numeros: "Test
  // Files" e "2 passed" ficam separados por um codigo, nao por espaco, e
  // nenhuma asercao sobre a contagem casaria.
  const result = spawnSync(
    process.execPath,
    [VITEST_BIN, 'run', '--root', root, '--no-file-parallelism'],
    {
      encoding: 'utf8',
      env: { ...process.env, CI: 'true', NO_COLOR: '1', FORCE_COLOR: '0' },
    },
  );

  return { status: result.status, output: `${result.stdout}\n${result.stderr}` };
}

const temporaryRoots: string[] = [];

const PASSING = `
import { describe, expect, it } from 'vitest';
describe('um modulo', () => {
  it('passa', () => { expect(1).toBe(1); });
  it('tambem passa', () => { expect('a').toBe('a'); });
});
`;

const ANOTHER_PASSING = `
import { expect, it } from 'vitest';
it('passa noutro arquivo', () => { expect(true).toBe(true); });
`;

const FAILING = `
import { expect, it } from 'vitest';
it('falha de proposito', () => { expect(1).toBe(2); });
`;

beforeAll(() => {
  expect(VITEST_BIN).toBeTruthy();
});

afterEach(() => {
  while (temporaryRoots.length > 0) {
    rmSync(temporaryRoots.pop() as string, { recursive: true, force: true });
  }
});

describe('Portao do pipeline', () => {
  it('IT-188: o job de teste nao tolera falha, e o build depende dele', () => {
    // A execucao da suite inteira e a evidencia da tarefa; o que se afirma aqui
    // e a condicao sem a qual aquela execucao nao significaria nada: que o
    // resultado do teste chega ao grafo de jobs.
    const frontendTests = step('Run frontend tests');
    expect(frontendTests).toContain('npm --prefix frontend run test');
    expect(frontendTests).not.toContain('continue-on-error');

    const typecheck = step('Run frontend typecheck');
    expect(typecheck).not.toContain('continue-on-error');

    // O lint e a excecao deliberada — e e o contraste que mostra que a ausencia
    // acima e intencional, e nao um `continue-on-error` que ninguem escreveu.
    expect(step('Run frontend lint')).toContain('continue-on-error: true');

    // O build so roda se lint/typecheck e teste passarem: e ai que o portao fecha.
    const build = workflow.slice(workflow.indexOf('  build:'));
    expect(build.slice(0, build.indexOf('steps:'))).toContain('needs: [lint-typecheck, test]');
  });

  it('IT-189: a suite roda ate o fim, sai zero e relata arquivos e casos', () => {
    const { status, output } = runToySuite({ 'a.test.ts': PASSING, 'b.test.ts': ANOTHER_PASSING });

    expect(status, output).toBe(0);
    // O runner precisa dizer o que rodou: uma suite vazia sai zero do mesmo
    // jeito, e so a contagem separa "passou" de "nao havia nada" (US-028.EC-1).
    expect(output).toMatch(/Test Files\s+2 passed \(2\)/);
    expect(output).toMatch(/Tests\s+3 passed \(3\)/);
  });

  it('IT-189: a suite deste repositorio nao e vazia', async () => {
    // A contagem acima prova que o runner relata; esta prova que ha o que
    // relatar aqui. `import.meta.glob` le o disco em tempo de build, entao a
    // afirmacao acompanha os arquivos que existirem de fato.
    const files = import.meta.glob('/src/**/*.test.{ts,tsx}');
    expect(Object.keys(files).length).toBeGreaterThan(0);
  });

  it('IT-190: um caso que falha faz o processo sair diferente de zero', () => {
    const { status, output } = runToySuite({ 'falha.test.ts': FAILING });

    expect(status, output).not.toBe(0);
    expect(output).toMatch(/1 failed/);
  });

  it('IT-191: o comando de cobertura existe e escreve o relatorio que o pipeline aponta', async () => {
    expect(packageJson.scripts['test:cov']).toBe('vitest run --coverage');

    const loaded = await loadConfigFromFile(
      { command: 'serve', mode: 'test' },
      join(FRONTEND, 'vite.config.ts'),
    );
    const coverage = (loaded?.config as { test?: { coverage?: Record<string, unknown> } })?.test
      ?.coverage;
    expect(coverage, 'vite.config.ts nao configura cobertura').toBeTruthy();

    // O passo de upload aponta um arquivo com nome exato. Quem o escreve e o
    // reporter `json` — os outros produzem lcov e html, e nenhum deles gera
    // `coverage-final.json`. Sem ele o comando roda verde e o upload nao acha
    // nada (US-028.EC-3).
    const upload = step('Upload coverage reports');
    expect(upload).toContain('./frontend/coverage/coverage-final.json');
    expect(coverage?.reportsDirectory).toBe('./coverage');
    expect(coverage?.reporter).toContain('json');
  });
});
