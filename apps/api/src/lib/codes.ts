import { randomInt } from 'node:crypto';

/** Alfabeto sem caracteres ambíguos (0/O, 1/I/L). */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function randomCode(length = 6): string {
  let out = '';
  for (let i = 0; i < length; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

/** Código público legível, ex.: PED-7K2QXA, ADO-..., CH-2026-... */
export function publicCode(prefix: string, withYear = false): string {
  return withYear
    ? `${prefix}-${new Date().getFullYear()}-${randomCode(6)}`
    : `${prefix}-${randomCode(6)}`;
}

export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** Gera slug único consultando `exists` (sufixo -2, -3, ...). */
export async function uniqueSlug(
  text: string,
  exists: (slug: string) => Promise<boolean>,
): Promise<string> {
  const base = slugify(text) || randomCode(6).toLowerCase();
  let slug = base;
  for (let i = 2; await exists(slug); i++) slug = `${base}-${i}`;
  return slug;
}

/** Telefone BR (só dígitos, com DDD) → formato E.164 sem "+" exigido pelo WhatsApp. */
export function toWhatsAppNumber(phone: string): string {
  return `55${phone.replace(/\D/g, '')}`;
}

export function maskEmail(email: string): string {
  const [user = '', domain = ''] = email.split('@');
  return `${user.slice(0, 2)}***@${domain}`;
}
