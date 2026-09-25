import { MailService } from '@/shared/mail/mail.service';
import type { MailSender, OutboundMail } from '@/shared/mail/mailer';

function recordingSender(): { sender: MailSender; sent: OutboundMail[] } {
  const sent: OutboundMail[] = [];
  return {
    sent,
    sender: {
      send: async (mail) => {
        sent.push(mail);
      },
    },
  };
}

describe('MailService', () => {
  it('monta o e-mail de redefinicao com link, prazo e destinatario', async () => {
    const { sender, sent } = recordingSender();
    const service = new MailService(sender);
    const resetUrl = 'http://localhost:5173/redefinir-senha?token=abc123';

    await service.sendPasswordResetEmail({
      to: 'sindico@parqueflores.com.br',
      name: 'Maria Silva',
      resetUrl,
      expiresMinutes: 30,
    });

    expect(sent).toHaveLength(1);
    const mail = sent[0];
    expect(mail.to).toBe('sindico@parqueflores.com.br');
    expect(mail.subject).toContain('Redefinicao de senha');
    expect(mail.text).toContain('Ola, Maria Silva.');
    expect(mail.text).toContain(resetUrl);
    expect(mail.text).toContain('30 minutos');
    expect(mail.html).toContain(`href="${resetUrl}"`);
  });

  it('escapa o nome do usuario antes de injetar no HTML', async () => {
    const { sender, sent } = recordingSender();
    const service = new MailService(sender);

    await service.sendPasswordResetEmail({
      to: 'x@y.com',
      name: '<img src=x onerror=alert(1)>',
      resetUrl: 'http://localhost:5173/redefinir-senha?token=abc',
      expiresMinutes: 30,
    });

    expect(sent[0].html).not.toContain('<img');
    expect(sent[0].html).toContain('&lt;img');
  });

  it('funciona sem nome de usuario', async () => {
    const { sender, sent } = recordingSender();
    const service = new MailService(sender);

    await service.sendPasswordResetEmail({
      to: 'x@y.com',
      name: '',
      resetUrl: 'http://localhost:5173/redefinir-senha?token=abc',
      expiresMinutes: 30,
    });

    expect(sent[0].text).toContain('Ola.');
  });
});
