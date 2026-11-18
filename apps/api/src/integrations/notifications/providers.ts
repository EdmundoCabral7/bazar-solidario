import { randomUUID } from 'node:crypto';
import { env } from '../../config/env';
import { fetchJson } from '../../lib/http';
import { logger } from '../../lib/logger';
import { ResilientExecutor } from '../../lib/resilience';
import type { IntegrationHealth, NotificationMessage, NotificationProvider } from '../types';

/** WhatsApp mock: apenas registra a mensagem no log (padrão). */
export class MockWhatsAppProvider implements NotificationProvider {
  readonly name = 'whatsapp';
  readonly mode = 'mock' as const;
  readonly channel = 'WHATSAPP' as const;
  readonly sent: NotificationMessage[] = [];

  async send(message: NotificationMessage) {
    this.sent.push(message);
    logger.info({ to: message.to, body: message.body }, '[mock WhatsApp] mensagem enviada');
    return { messageId: `mock-wa-${randomUUID()}` };
  }
  async health(): Promise<IntegrationHealth> {
    return {
      name: this.name,
      mode: this.mode,
      status: 'up',
      detail: 'mensagens apenas registradas em log',
    };
  }
}

/**
 * WhatsApp Cloud API (Meta). Envia mensagem de texto; fora da janela de 24 h a Meta exige
 * template aprovado — por isso o modo real é opcional neste projeto acadêmico.
 */
export class CloudWhatsAppProvider implements NotificationProvider {
  readonly name = 'whatsapp';
  readonly mode = 'real' as const;
  readonly channel = 'WHATSAPP' as const;
  readonly executor = new ResilientExecutor('whatsapp');

  constructor(
    private readonly token: string,
    private readonly phoneNumberId: string,
  ) {}

  async send(message: NotificationMessage) {
    const res = await this.executor.execute('send', () =>
      fetchJson<{ messages: { id: string }[] }>(
        'whatsapp',
        `https://graph.facebook.com/v21.0/${this.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: { authorization: `Bearer ${this.token}` },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: message.to,
            type: 'text',
            text: { body: message.body },
          }),
        },
      ),
    );
    return { messageId: res.messages[0]?.id ?? 'desconhecido' };
  }
  async health(): Promise<IntegrationHealth> {
    const circuit = this.executor.state;
    return {
      name: this.name,
      mode: this.mode,
      circuit,
      status: circuit === 'open' ? 'down' : 'up',
    };
  }
}

/** E-mail mock (o projeto não integra provedor de e-mail real). */
export class MockEmailProvider implements NotificationProvider {
  readonly name = 'email';
  readonly mode = 'mock' as const;
  readonly channel = 'EMAIL' as const;
  readonly sent: NotificationMessage[] = [];

  async send(message: NotificationMessage) {
    this.sent.push(message);
    logger.info({ to: message.to, subject: message.subject }, '[mock e-mail] mensagem enviada');
    return { messageId: `mock-email-${randomUUID()}` };
  }
  async health(): Promise<IntegrationHealth> {
    return {
      name: this.name,
      mode: this.mode,
      status: 'up',
      detail: 'mensagens apenas registradas em log',
    };
  }
}

export function whatsappConfigured() {
  return !!env.WHATSAPP_TOKEN && !!env.WHATSAPP_PHONE_NUMBER_ID;
}
