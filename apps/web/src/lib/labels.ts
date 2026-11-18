/** Rótulos em pt-BR para os enums da API. */
export const SPECIES: Record<string, string> = { DOG: 'Cachorro', CAT: 'Gato' };
export const SIZES: Record<string, string> = { SMALL: 'Pequeno', MEDIUM: 'Médio', LARGE: 'Grande' };
export const SEXES: Record<string, string> = { MALE: 'Macho', FEMALE: 'Fêmea' };
export const ANIMAL_STATUS: Record<string, string> = {
  AVAILABLE: 'Disponível',
  IN_ADOPTION: 'Em processo de adoção',
  ADOPTED: 'Adotado',
};
export const CONDITIONS: Record<string, string> = {
  NEW: 'Nova',
  LIKE_NEW: 'Seminova',
  GOOD: 'Bom estado',
  FAIR: 'Com marcas de uso',
};
export const PRODUCT_STATUS: Record<string, string> = {
  ACTIVE: 'À venda',
  SOLD: 'Vendida',
  HIDDEN: 'Oculta',
};
export const ORDER_STATUS: Record<string, string> = {
  PENDING_PAYMENT: 'Aguardando pagamento',
  PAID: 'Pago',
  SHIPPED: 'Enviado',
  DELIVERED: 'Entregue',
  CANCELED: 'Cancelado',
};
export const PAYMENT_STATUS: Record<string, string> = {
  PENDING: 'Pendente',
  APPROVED: 'Aprovado',
  REJECTED: 'Recusado',
  REFUNDED: 'Estornado',
  CANCELED: 'Cancelado',
};
export const SPONSORSHIP_STATUS: Record<string, string> = {
  PENDING: 'Aguardando autorização',
  ACTIVE: 'Ativo',
  PAUSED: 'Pausado',
  CANCELED: 'Cancelado',
};
export const PLANS: Record<string, { label: string; cents: number; text: string }> = {
  P20: { label: 'Amigo', cents: 2000, text: 'Ajuda com vermífugo e antipulgas' },
  P50: { label: 'Protetor', cents: 5000, text: 'Garante a ração do mês' },
  P100: { label: 'Guardião', cents: 10000, text: 'Cobre ração e consultas veterinárias' },
};
export const ADOPTION_STATUS: Record<string, string> = {
  RECEIVED: 'Recebida',
  IN_REVIEW: 'Em análise',
  INTERVIEW: 'Entrevista',
  APPROVED: 'Aprovada',
  REJECTED: 'Não aprovada',
};
export const EXPENSE_CATEGORIES: Record<string, string> = {
  RACAO: 'Ração',
  VETERINARIO: 'Veterinário',
  CASTRACAO: 'Castração',
  MANUTENCAO: 'Manutenção',
  OUTROS: 'Outros',
};
export const TICKET_STATUS: Record<string, string> = {
  OPEN: 'Aberto',
  IN_PROGRESS: 'Em atendimento',
  WAITING_USER: 'Aguardando solicitante',
  RESOLVED: 'Resolvido',
  CLOSED: 'Encerrado',
};
export const TICKET_TYPES: Record<string, string> = {
  INCIDENT: 'Incidente (algo não funciona)',
  SERVICE_REQUEST: 'Requisição (pedido ou dúvida)',
  PROBLEM: 'Problema (causa-raiz)',
};
export const LEVELS: Record<string, string> = { LOW: 'Baixo', MEDIUM: 'Médio', HIGH: 'Alto' };
export const URGENCIES: Record<string, string> = { LOW: 'Baixa', MEDIUM: 'Média', HIGH: 'Alta' };
export const PRIORITIES: Record<string, string> = {
  P1: 'P1 · Crítica',
  P2: 'P2 · Alta',
  P3: 'P3 · Média',
  P4: 'P4 · Baixa',
};
export const SUPPORT_LEVELS: Record<string, string> = {
  N1: 'N1 · Voluntário',
  N2: 'N2 · Responsável de TI',
  N3: 'N3 · Desenvolvimento',
};
export const SLA_STATE: Record<string, string> = {
  ON_TRACK: 'No prazo',
  AT_RISK: 'Em risco',
  VIOLATED: 'Violado',
  MET: 'Cumprido',
};
export const ROLES: Record<string, string> = {
  ADMIN: 'Administrador(a)',
  VOLUNTEER: 'Voluntário(a) — N1',
  SUPPORT_N2: 'Responsável de TI — N2',
};
export const EVENT_TYPES: Record<string, string> = {
  CREATED: 'Abertura',
  STATUS_CHANGED: 'Mudança de status',
  ESCALATED: 'Escalonamento',
  ASSIGNED: 'Atribuição',
  COMMENT: 'Comentário',
  LINKED_PROBLEM: 'Vínculo a problema',
};
