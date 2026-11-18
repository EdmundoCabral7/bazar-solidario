import type { Prisma, PrismaClient } from '@prisma/client';
import { toWhatsAppNumber } from '../../lib/codes';
import type { TemplateName } from './templates';

type Tx = Prisma.TransactionClient | PrismaClient;

export interface Recipient {
  email?: string | null;
  phone?: string | null;
}

/**
 * Enfileira uma notificação na outbox — na MESMA transação da mudança de estado que a originou
 * (padrão transactional outbox). O worker envia depois; a requisição nunca espera o envio.
 * Prefere WhatsApp quando há telefone; senão, e-mail.
 */
export async function enqueueNotification(
  tx: Tx,
  recipient: Recipient,
  template: TemplateName,
  payload: Record<string, unknown>,
) {
  const channel = recipient.phone ? 'WHATSAPP' : recipient.email ? 'EMAIL' : null;
  if (!channel) return null;
  return tx.notificationOutbox.create({
    data: {
      channel,
      recipient: channel === 'WHATSAPP' ? toWhatsAppNumber(recipient.phone!) : recipient.email!,
      template,
      payload: payload as Prisma.InputJsonValue,
      nextAttemptAt: new Date(),
    },
  });
}
