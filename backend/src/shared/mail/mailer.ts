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
            secure: env.SMTP_SECURE,
            auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
          }
        : { jsonTransport: true },
    );
  }
  return transport;
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
      await getTransport().sendMail({ from: env.SMTP_FROM, ...mail });
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
