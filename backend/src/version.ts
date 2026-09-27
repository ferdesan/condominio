import pkg from '../package.json';

/** Versao do backend, lida direto do `package.json` (fonte unica). */
export const APP_VERSION: string = pkg.version;
