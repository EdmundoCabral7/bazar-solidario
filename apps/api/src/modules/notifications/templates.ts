import { env } from '../../config/env';

/** Templates de notificação (pt-BR). O texto é renderizado pelo worker no momento do envio. */
export type TemplateName =
  | 'ORDER_CREATED'
  | 'ORDER_PAID'
  | 'ORDER_SHIPPED'
  | 'ORDER_DELIVERED'
  | 'ORDER_CANCELED'
  | 'DONATION_APPROVED'
  | 'SPONSORSHIP_ACTIVE'
  | 'SPONSORSHIP_CHARGED'
  | 'SPONSORSHIP_CANCELED'
  | 'ADOPTION_RECEIVED'
  | 'ADOPTION_STATUS'
  | 'TICKET_CREATED'
  | 'TICKET_UPDATED';

type Payload = Record<string, unknown>;

const brl = (cents: unknown) =>
  (Number(cents) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const s = (v: unknown) => String(v ?? '');

const ADOPTION_STATUS_TEXT: Record<string, string> = {
  RECEIVED: 'recebida',
  IN_REVIEW: 'em análise pela equipe',
  INTERVIEW: 'aprovada para entrevista — entraremos em contato para agendar',
  APPROVED: 'APROVADA! 🎉 Vamos combinar a entrega do seu novo companheiro',
  REJECTED: 'não aprovada desta vez. Agradecemos muito o seu interesse',
};
const TICKET_STATUS_TEXT: Record<string, string> = {
  OPEN: 'aberto',
  IN_PROGRESS: 'em atendimento',
  WAITING_USER: 'aguardando sua resposta',
  RESOLVED: 'resolvido',
  CLOSED: 'encerrado',
};

const renderers: Record<TemplateName, (p: Payload) => { subject: string; body: string }> = {
  ORDER_CREATED: (p) => ({
    subject: `Pedido ${s(p.code)} recebido`,
    body: `Olá, ${s(p.name)}! Recebemos seu pedido ${s(p.code)} no Bazar Patas Potiguares (${brl(p.totalCents)}). Assim que o pagamento for confirmado, avisaremos por aqui. Acompanhe: ${env.WEB_URL}/pedido/${s(p.code)}`,
  }),
  ORDER_PAID: (p) => ({
    subject: `Pagamento do pedido ${s(p.code)} confirmado`,
    body: `Pagamento confirmado! 🐾 Seu pedido ${s(p.code)} já está sendo separado. Obrigado por ajudar nossos animais.`,
  }),
  ORDER_SHIPPED: (p) => ({
    subject: `Pedido ${s(p.code)} enviado`,
    body: `Seu pedido ${s(p.code)} foi enviado${p.trackingCode ? ` (rastreio: ${s(p.trackingCode)})` : ''}.`,
  }),
  ORDER_DELIVERED: (p) => ({
    subject: `Pedido ${s(p.code)} entregue`,
    body: `Pedido ${s(p.code)} entregue! Esperamos que goste — e obrigado por apoiar a causa animal.`,
  }),
  ORDER_CANCELED: (p) => ({
    subject: `Pedido ${s(p.code)} cancelado`,
    body: `Seu pedido ${s(p.code)} foi cancelado${p.reason ? ` (${s(p.reason)})` : ''}. Se tiver dúvidas, abra um chamado em ${env.WEB_URL}/suporte.`,
  }),
  DONATION_APPROVED: (p) => ({
    subject: 'Doação confirmada — obrigado!',
    body: `${p.name ? `${s(p.name)}, ` : ''}sua doação de ${brl(p.amountCents)} foi confirmada. Veja como usamos cada real em ${env.WEB_URL}/transparencia 💛`,
  }),
  SPONSORSHIP_ACTIVE: (p) => ({
    subject: `Você agora apadrinha ${s(p.animalName)}!`,
    body: `${s(p.name)}, seu apadrinhamento de ${s(p.animalName)} (${brl(p.amountCents)}/mês) está ativo. Obrigado!`,
  }),
  SPONSORSHIP_CHARGED: (p) => ({
    subject: `Mensalidade do apadrinhamento de ${s(p.animalName)}`,
    body: `Recebemos a mensalidade de ${brl(p.amountCents)} do apadrinhamento de ${s(p.animalName)}. Obrigado por continuar com a gente!`,
  }),
  SPONSORSHIP_CANCELED: (p) => ({
    subject: 'Apadrinhamento cancelado',
    body: `O apadrinhamento de ${s(p.animalName)} foi cancelado. Obrigado por todo o apoio até aqui!`,
  }),
  ADOPTION_RECEIVED: (p) => ({
    subject: `Pedido de adoção ${s(p.code)} recebido`,
    body: `Olá, ${s(p.name)}! Recebemos seu interesse em adotar ${s(p.animalName)} (protocolo ${s(p.code)}). Nossa equipe vai analisar e retornar em breve.`,
  }),
  ADOPTION_STATUS: (p) => ({
    subject: `Atualização da adoção ${s(p.code)}`,
    body: `Sua solicitação de adoção de ${s(p.animalName)} (${s(p.code)}) foi ${ADOPTION_STATUS_TEXT[s(p.status)] ?? s(p.status)}.`,
  }),
  TICKET_CREATED: (p) => ({
    subject: `Chamado ${s(p.protocol)} aberto`,
    body: `Recebemos seu chamado "${s(p.title)}" (protocolo ${s(p.protocol)}, prioridade ${s(p.priority)}). Prazo de primeira resposta: ${s(p.responseDue)}. Acompanhe em ${env.WEB_URL}/suporte?protocolo=${s(p.protocol)}`,
  }),
  TICKET_UPDATED: (p) => ({
    subject: `Chamado ${s(p.protocol)} atualizado`,
    body: `Seu chamado ${s(p.protocol)} está ${TICKET_STATUS_TEXT[s(p.status)] ?? s(p.status)}.${p.message ? ` Mensagem da equipe: ${s(p.message)}` : ''}`,
  }),
};

export function renderTemplate(template: string, payload: Payload) {
  const render = renderers[template as TemplateName];
  if (!render) throw new Error(`Template desconhecido: ${template}`);
  return render(payload);
}
