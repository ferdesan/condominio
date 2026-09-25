import { env } from '@/config/env';
import { mailer, type MailSender } from './mailer';

export type PasswordResetMail = {
  to: string;
  name: string;
  resetUrl: string;
  expiresMinutes: number;
};

/** Escapa conteudo do usuario antes de entrar no HTML do e-mail. */
function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char,
  );
}

/**
 * E-mails transacionais. Modelos enxutos e inline: nao ha template engine no
 * projeto e duas mensagens nao justificam uma.
 */
export class MailService {
  constructor(private readonly sender: MailSender = mailer) {}

  /**
   * Link de redefinicao de senha. O token chega em claro aqui e em mais lugar
   * nenhum — no banco fica apenas o hash SHA-256 gravado pelo `auth.service`.
   */
  async sendPasswordResetEmail(input: PasswordResetMail): Promise<void> {
    const subject = `Redefinicao de senha — ${env.APP_NAME}`;
    const greeting = input.name ? `Ola, ${escapeHtml(input.name)}.` : 'Ola.';

    const text = [
      greeting,
      '',
      'Recebemos um pedido para redefinir a senha da sua conta.',
      `Acesse o link abaixo para escolher uma nova senha (vale por ${input.expiresMinutes} minutos):`,
      '',
      input.resetUrl,
      '',
      'Se nao foi voce, ignore esta mensagem: sua senha atual continua valendo.',
      'A troca de senha encerra as sessoes abertas em todos os aparelhos.',
    ].join('\n');

    const html = `
      <div style="font-family: sans-serif; line-height: 1.5; color: #1f2937;">
        <p>${greeting}</p>
        <p>Recebemos um pedido para redefinir a senha da sua conta.</p>
        <p style="margin: 24px 0;">
          <a href="${escapeHtml(input.resetUrl)}"
             style="background: #2563eb; color: #ffffff; padding: 12px 20px;
                    border-radius: 6px; text-decoration: none; display: inline-block;">
            Definir nova senha
          </a>
        </p>
        <p>O link vale por ${input.expiresMinutes} minutos. Se o botao nao funcionar, copie e cole no navegador:</p>
        <p style="word-break: break-all; color: #6b7280;">${escapeHtml(input.resetUrl)}</p>
        <p>Se nao foi voce, ignore esta mensagem: sua senha atual continua valendo. A troca de senha encerra as sessoes abertas em todos os aparelhos.</p>
      </div>`.trim();

    await this.sender.send({ to: input.to, subject, text, html });
  }
}

export const mailService = new MailService();
