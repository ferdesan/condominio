import nodemailer, { type Transporter } from 'nodemailer';
import { env, isProduction, isTest } from '@/config/env';
import { logger } from '@/config/logger';

export type OutboundMail = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export type MailSender = {
  send(mail: OutboundMail): Promise<void>;
};

let transport: Transporter | undefined;

/**
 * Teto de cada etapa da conversa SMTP. Sem isso valem os defaults do nodemailer
 * (30 s so para a saudacao, 10 min de socket), e um provedor mudo segura a
 * promessa muito alem do que qualquer cliente espera.
 */
const SMTP_TIMEOUT_MS = 10_000;

function smtpConfigured(): boolean {
  return Boolean(env.SMTP_HOST) && !isTest;
}

function getTransport(): Transporter {
  if (!transport) {
    // `jsonTransport` monta a mensagem inteira sem abrir conexao: e o caminho
    // dos testes e tambem o fallback de quem nao configurou SMTP.
    transport = nodemailer.createTransport(
      env.SMTP_HOST && !isTest
        ? {
            host: env.SMTP_HOST,
            port: env.SMTP_PORT,
            // 465 e SSL implicito: sem `secure` o cliente espera a saudacao em
            // texto puro, o servidor espera o TLS, e os dois ficam parados.
            secure: env.SMTP_SECURE || env.SMTP_PORT === 465,
            auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
            connectionTimeout: SMTP_TIMEOUT_MS,
            greetingTimeout: SMTP_TIMEOUT_MS,
            socketTimeout: SMTP_TIMEOUT_MS,
          }
        : { jsonTransport: true },
    );
  }
  return transport;
}

/**
 * Remetente a partir de `SMTP_FROM`, aceitando `Nome <email>`, `Nome email` ou
 * so `email`. Paineis de deploy e o proprio compose costumam comer aspas e `<>`;
 * repassar o texto cru faz o SMTP ler "Nome email" como endereco e recusar com
 * "553 Sender address rejected". Nome e endereco separados nao tem essa ambiguidade.
 */
export function parseSender(raw: string, fallbackName: string): { name: string; address: string } {
  const address = raw.match(/[^\s<>"']+@[^\s<>"']+/)?.[0] ?? raw.trim();
  const name = raw.replace(address, '').replace(/[<>"']/g, '').trim();
  return { name: name || fallbackName, address };
}

/**
 * Despachante de e-mail. Prefere SMTP; sem configuracao degrada para console,
 * para que desenvolvimento local continue verificavel sem provedor nenhum.
 * A degradacao nunca imprime o corpo da mensagem em producao: o link de
 * redefinicao dentro dos logs de producao seria um token utilizavel.
 */
export const mailer: MailSender = {
  async send(mail: OutboundMail): Promise<void> {
    if (smtpConfigured()) {
      const from = parseSender(env.SMTP_FROM, env.APP_NAME);
      const info = await getTransport().sendMail({ from, ...mail });
      // Aceito pelo SMTP nao e entregue: se o e-mail nao chegar, o messageId e
      // a resposta sao o que o provedor pede para rastrear a mensagem.
      logger.info(
        `E-mail "${mail.subject}" aceito para ${mail.to} (messageId=${info.messageId}, ` +
          `rejected=${info.rejected?.length ?? 0}, response=${info.response})`,
      );
      return;
    }

    if (isTest) {
      await getTransport().sendMail(mail);
      return;
    }

    if (isProduction) {
      logger.error(`SMTP nao configurado — "${mail.subject}" nao foi enviado para ${mail.to}`);
      return;
    }

    logger.warn(`SMTP nao configurado — "${mail.subject}" nao foi enviado para ${mail.to}`);
    logger.info(`Corpo da mensagem (desenvolvimento):\n${mail.text}`);
  },
};

/** Codigo e resposta do servidor SMTP dizem mais que a mensagem generica. */
export function describeMailError(error: unknown): string {
  const err = error as { message?: string; code?: string; responseCode?: number; response?: string };
  return [err.code, err.responseCode, err.response ?? err.message].filter(Boolean).join(' | ');
}

/**
 * Confere conexao e credenciais do SMTP. Roda no boot so para registrar no log:
 * configuracao errada aparece no deploy, e nao no primeiro "esqueci a senha".
 */
export async function verifyMailer(): Promise<void> {
  if (!smtpConfigured()) return;
  try {
    await getTransport().verify();
    logger.info(`SMTP pronto (${env.SMTP_HOST}:${env.SMTP_PORT})`);
  } catch (error) {
    logger.error(`SMTP indisponivel (${env.SMTP_HOST}:${env.SMTP_PORT}): ${describeMailError(error)}`);
  }
}
