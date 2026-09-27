#!/usr/bin/env node
/**
 * Gera os PNGs de icone que o manifest e o iOS consomem, a partir de
 * `scripts/icon-source.svg`.
 *
 * Roda em `npm run generate:icons` e tambem no `prebuild`, entao o `dist` nunca
 * depende de um PNG que alguem esqueceu de versionar. Os arquivos sao
 * versionados de proposito: sao a identidade do app instalada no aparelho do
 * usuario, e um icone que muda de forma precisa passar por review.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const here = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(here, '..', 'public');

/**
 * O que decide o arquivo nao e o `purpose` do manifest, e sim quem recorta a
 * imagem: `bleed: true` sangra ate a borda para quem aplica a propria mascara,
 * `bleed: false` arredonda para o launcher que mostra o icone como esta.
 */
const TARGETS = [
  { file: 'pwa-192x192.png', size: 192, bleed: false },
  { file: 'pwa-512x512.png', size: 512, bleed: false },
  { file: 'pwa-192x192-maskable.png', size: 192, bleed: true },
  { file: 'pwa-512x512-maskable.png', size: 512, bleed: true },

  // O iOS ignora o manifest e nao sabe o que e `purpose`: ele le o
  // `apple-touch-icon` do head, em 180x180, e aplica a propria mascara arredondada
  // por cima. Com alfa, o canto transparente vira preto. Logo este e `bleed: true`
  // mesmo sendo, no nome, o icone "comum" — sangrar e o preco de nao aparecer
  // com fundo preto na tela de inicio.
  { file: 'apple-touch-icon.png', size: 180, bleed: true },
];

const source = await readFile(path.join(here, 'icon-source.svg'), 'utf8');
const square = (bleed) => source.replace('rx="RX"', `rx="${bleed ? 0 : 14}"`);

await mkdir(publicDir, { recursive: true });

for (const { file, size, bleed } of TARGETS) {
  const out = path.join(publicDir, file);
  const png = await sharp(Buffer.from(square(bleed)))
    .resize(size, size)
    .png({ compressionLevel: 9 });
  await writeFile(out, await png.toBuffer());
  console.log(
    `  ${path.relative(process.cwd(), out)}  ${size}x${size}  ${bleed ? 'bleed' : 'rounded'}`,
  );
}

// O `favicon.svg` que o head ja referenciava era uma referencia quebrada desde
// sempre. Sai daqui, e nao como arquivo escrito a mao, para nao haver um segundo
// desenho da marca no repositorio capaz de divergir deste.
const favicon = path.join(publicDir, 'favicon.svg');
await writeFile(favicon, square(false));
console.log(`  ${path.relative(process.cwd(), favicon)}  svg`);

console.log('icones PWA gerados.');
