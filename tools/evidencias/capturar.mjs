/**
 * Captura as evidências (prints) do Bazar Solidário Digital.
 *
 *   cd tools/evidencias && npm install && npx playwright install chromium   (uma vez)
 *   npm run evidencias                                   # ambiente local
 *   WEB_URL=https://... API_URL=https://... ADMIN_PASSWORD=... npm run evidencias   # produção
 *
 * Executa os fluxos reais (compra com Pix + simulação de webhook, chamado, painel admin) e salva
 * as imagens em docs/evidencias/img/. Requer INTEGRATIONS_MODE=mock na API (simulador de pagamento).
 */
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(resolve(dirname(fileURLToPath(import.meta.url)), 'package.json'));
const { chromium } = require('playwright');

const WEB = (process.env.WEB_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const API = (process.env.API_URL ?? 'http://localhost:3333').replace(/\/$/, '');
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@pataspotiguares.org';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'admin123';
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../../docs/evidencias/img');
mkdirSync(OUT, { recursive: true });

const MOBILE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
const DESKTOP = { viewport: { width: 1366, height: 900 } };
const errors = [];
const shots = [];

const browser = await chromium.launch();
async function newPage(opts) {
  const ctx = await browser.newContext({ locale: 'pt-BR', timezoneId: 'America/Fortaleza', ...opts });
  const p = await ctx.newPage();
  p.setDefaultTimeout(60_000); // API no plano gratuito pode estar "acordando"
  p.on('pageerror', (e) => errors.push(`${p.url()} :: ${e.message}`));
  return p;
}
async function shot(p, name, full = true) {
  await p.waitForLoadState('networkidle').catch(() => {});
  await p.waitForTimeout(600);
  await p.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });
  shots.push(name);
  console.log('  ✓', name);
}
async function visit(p, url, name, full = true) {
  await p.goto(url, { waitUntil: 'domcontentloaded' });
  await shot(p, name, full);
}

console.log(`Capturando evidências de ${WEB} (API ${API})\n`);
// acorda a API (Render free)
await fetch(`${API}/health`).catch(() => {});

// ---------- Entrega 1 — Portal (celular) ----------
const m = await newPage(MOBILE);
await visit(m, `${WEB}/`, 'E1-01-home-celular');
await visit(m, `${WEB}/bazar`, 'E1-02-bazar-lista-celular');
await m.locator('a[href^="/bazar/"]').first().click();
await shot(m, 'E1-03-bazar-peca-celular');
await m.getByRole('button', { name: 'Adicionar ao carrinho' }).click();
await visit(m, `${WEB}/carrinho`, 'E1-04-carrinho-celular');
await m.goto(`${WEB}/checkout`);
await m.getByLabel('Nome completo').fill('Maria Evidência');
await m.getByLabel('E-mail', { exact: true }).fill('maria.evidencia@example.com');
await m.getByLabel('WhatsApp', { exact: true }).fill('84999990000');
await m.getByText('Receber em casa').click();
await m.getByLabel('CEP', { exact: true }).fill('59015000');
await m.getByText(/Correios PAC/).waitFor();
await m.getByLabel('Número').fill('100');
await m.getByRole('checkbox').check();
await shot(m, 'E1-05-checkout-cep-frete-celular');
await m.getByRole('button', { name: 'Gerar Pix' }).click();
await m.waitForURL(/\/pedido\/PED-/);
await m.getByText('Pix copia e cola').waitFor();
await shot(m, 'E1-06-pedido-pix-celular');
await m.getByRole('button', { name: 'Simular pagamento aprovado' }).click();
await m.getByText('Pagamento confirmado!').waitFor();
await shot(m, 'E1-07-pedido-pago-celular');
const orderUrl = m.url();

const d = await newPage(DESKTOP);
await visit(d, `${WEB}/`, 'E1-08-home-desktop');
await visit(d, `${WEB}/adote`, 'E1-09-adote-lista');
await d.locator('a[href^="/adote/"]').filter({ hasNotText: 'Acompanhar' }).first().click();
await shot(d, 'E1-10-adote-animal');
await d.getByRole('link', { name: /Quero adotar/ }).click();
await shot(d, 'E1-11-adote-formulario');
await visit(d, `${WEB}/doe`, 'E1-12-doe');
await visit(d, `${WEB}/doe/apadrinhar`, 'E1-13-apadrinhar-lista');
await visit(d, `${WEB}/transparencia`, 'E1-14-transparencia');
const dark = await newPage({ ...DESKTOP, colorScheme: 'dark' });
await visit(dark, `${WEB}/transparencia`, 'E1-15-transparencia-modo-escuro');

// ---------- Entrega 2 — Governança (central de serviços) ----------
await d.goto(`${WEB}/suporte`);
await d.getByLabel('Sobre qual serviço?').selectOption('S01');
await d.getByLabel('Resumo').fill(`Evidência ${new Date().toLocaleString('pt-BR')}: Pix não gera QR Code`);
await d.getByLabel('Descreva o que aconteceu').fill('Ao clicar em "Gerar Pix" a página fica carregando e não mostra o QR Code.');
await d.getByLabel('Quem é afetado?').selectOption('HIGH');
await d.getByLabel('Qual a urgência?').selectOption('MEDIUM');
await shot(d, 'E2-01-suporte-prioridade-calculada');
await d.getByLabel('Seu nome').fill('Carla Evidência');
await d.getByLabel('E-mail para retorno').fill('carla.evidencia@example.com');
await d.getByRole('button', { name: 'Abrir chamado' }).click();
await d.getByText('Chamado aberto!').waitFor();
await shot(d, 'E2-02-suporte-protocolo-e-prazos');

await d.goto(`${WEB}/admin/login`);
await d.getByLabel('E-mail', { exact: true }).fill(ADMIN_EMAIL);
await d.getByLabel('Senha', { exact: true }).fill(ADMIN_PASSWORD);
await d.getByRole('button', { name: 'Entrar' }).click();
await d.waitForURL((u) => !u.pathname.endsWith('/login'));
await d.getByRole('heading', { name: 'Chamados por prioridade' }).waitFor();
await shot(d, 'E2-03-admin-dashboard');
await d.goto(`${WEB}/admin/chamados`);
await d.locator('tbody tr').first().waitFor();
await shot(d, 'E2-04-fila-chamados-sla');
await d.getByRole('tab', { name: 'Todos' }).click();
await d.waitForTimeout(800);
await shot(d, 'E2-05-fila-todos-chamados');
await d.getByRole('tab', { name: 'Em aberto' }).click();
await d.locator('tbody a').first().click();
await d.getByRole('heading', { name: 'Histórico' }).waitFor();
await shot(d, 'E2-06-detalhe-chamado');
await d.goto(`${WEB}/admin/chamados/relatorio`);
await d.getByRole('heading', { name: 'Por prioridade' }).waitFor();
await shot(d, 'E2-07-relatorio-sla');
for (const [path, name] of [
  ['pedidos', 'E2-08-admin-pedidos'],
  ['adocoes', 'E2-09-admin-adocoes'],
  ['usuarios', 'E2-10-gestao-acessos'],
  ['despesas', 'E2-11-admin-despesas'],
]) {
  await d.goto(`${WEB}/admin/${path}`);
  await d.locator('table').first().waitFor();
  await shot(d, name);
}

// ---------- Entrega 3 — Integração ----------
await visit(d, `${API}/docs/`, 'E3-01-swagger', true);
await visit(d, `${API}/health`, 'E3-02-health', false);
await visit(d, `${API}/metrics`, 'E3-03-metrics', false);
await d.goto(`${WEB}/admin/parceiros`);
await d.locator('table').first().waitFor();
await shot(d, 'E3-04-parceiros-api-publica');
const am = await newPage(MOBILE);
await am.goto(orderUrl);
await shot(am, 'E3-05-pedido-pago-via-webhook');

await browser.close();
console.log(`\n${shots.length} capturas em docs/evidencias/img/`);
if (errors.length) {
  console.log('\nErros de página:\n' + errors.join('\n'));
  process.exitCode = 1;
}
