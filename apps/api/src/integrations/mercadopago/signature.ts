import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Validação do header x-signature dos webhooks do Mercado Pago.
 * Formato: "ts=1704908010,v1=<hmac-sha256-hex>"
 * Manifesto assinado: "id:<data.id>;request-id:<x-request-id>;ts:<ts>;"
 * https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
 */
export interface SignatureParams {
  signatureHeader: string | undefined;
  requestId: string | undefined;
  dataId: string | undefined;
  secret: string;
  /** Rejeita assinaturas mais velhas que isso (proteção contra replay). 0 desliga. */
  toleranceSeconds?: number;
  now?: Date;
}

export function parseSignatureHeader(header: string): { ts?: string; v1?: string } {
  const parts: Record<string, string> = {};
  for (const piece of header.split(',')) {
    const [k, v] = piece.split('=').map((x) => x?.trim());
    if (k && v) parts[k] = v;
  }
  return { ts: parts.ts, v1: parts.v1 };
}

export function buildManifest(dataId: string, requestId: string, ts: string): string {
  // IDs alfanuméricos devem ir em minúsculas (regra do Mercado Pago)
  const id = /^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId;
  return `id:${id};request-id:${requestId};ts:${ts};`;
}

export function signManifest(manifest: string, secret: string): string {
  return createHmac('sha256', secret).update(manifest).digest('hex');
}

/** Gera um header x-signature válido (usado pelo mock e pelos testes). */
export function createSignatureHeader(
  dataId: string,
  requestId: string,
  secret: string,
  ts = Date.now(),
): string {
  const tsStr = String(ts);
  return `ts=${tsStr},v1=${signManifest(buildManifest(dataId, requestId, tsStr), secret)}`;
}

export function verifyWebhookSignature(p: SignatureParams): boolean {
  if (!p.signatureHeader || !p.requestId || !p.dataId) return false;
  const { ts, v1 } = parseSignatureHeader(p.signatureHeader);
  if (!ts || !v1 || !/^[0-9a-f]{64}$/i.test(v1)) return false;

  const tolerance = p.toleranceSeconds ?? 0;
  if (tolerance > 0) {
    // ts do MP vem em milissegundos
    const tsMs = Number(ts) > 1e12 ? Number(ts) : Number(ts) * 1000;
    const age = Math.abs((p.now ?? new Date()).getTime() - tsMs) / 1000;
    if (!Number.isFinite(age) || age > tolerance) return false;
  }

  const expected = Buffer.from(
    signManifest(buildManifest(p.dataId, p.requestId, ts), p.secret),
    'hex',
  );
  const received = Buffer.from(v1, 'hex');
  return expected.length === received.length && timingSafeEqual(expected, received);
}
