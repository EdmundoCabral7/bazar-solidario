import { describe, expect, it } from 'vitest';
import {
  createSignatureHeader,
  verifyWebhookSignature,
} from '../src/integrations/mercadopago/signature';
import { ExternalServiceError, ResilientExecutor } from '../src/lib/resilience';

describe('ResilientExecutor (retry + circuit breaker)', () => {
  it('repete falhas transitórias com backoff e devolve o resultado', async () => {
    const exec = new ResilientExecutor('teste-retry', { retries: 2, baseDelayMs: 1 });
    let calls = 0;
    const result = await exec.execute('op', async () => {
      calls++;
      if (calls < 3) throw new ExternalServiceError('teste', 'falha 503');
      return 'ok';
    });
    expect(result).toBe('ok');
    expect(calls).toBe(3);
  });

  it('não repete erros não-retentáveis (4xx)', async () => {
    const exec = new ResilientExecutor('teste-4xx', { retries: 3, baseDelayMs: 1 });
    let calls = 0;
    await expect(
      exec.execute('op', async () => {
        calls++;
        throw new ExternalServiceError('teste', 'bad request', false, 400);
      }),
    ).rejects.toThrow('bad request');
    expect(calls).toBe(1);
  });

  it('aplica timeout por tentativa', async () => {
    const exec = new ResilientExecutor('teste-timeout', { retries: 0, timeoutMs: 20 });
    await expect(exec.execute('op', () => new Promise((r) => setTimeout(r, 200)))).rejects.toThrow(
      /Tempo esgotado/,
    );
  });

  it('abre o circuito após falhas seguidas e falha rápido', async () => {
    const exec = new ResilientExecutor('teste-breaker', { retries: 0, resetTimeoutMs: 60_000 });
    let calls = 0;
    const failing = async () => {
      calls++;
      throw new ExternalServiceError('teste', 'fora do ar');
    };
    for (let i = 0; i < 6; i++) await exec.execute('op', failing).catch(() => undefined);
    expect(exec.state).toBe('open');
    const before = calls;
    await expect(exec.execute('op', failing)).rejects.toThrow(/temporariamente indisponível/);
    expect(calls).toBe(before); // nem chamou a função
  });
});

describe('assinatura de webhook do Mercado Pago', () => {
  const secret = 'segredo-teste';

  it('aceita assinatura válida', () => {
    const header = createSignatureHeader('123456', 'req-1', secret);
    expect(
      verifyWebhookSignature({
        signatureHeader: header,
        requestId: 'req-1',
        dataId: '123456',
        secret,
      }),
    ).toBe(true);
  });

  it('rejeita segredo, data.id ou request-id diferentes', () => {
    const header = createSignatureHeader('123456', 'req-1', secret);
    expect(
      verifyWebhookSignature({
        signatureHeader: header,
        requestId: 'req-1',
        dataId: '123456',
        secret: 'outro',
      }),
    ).toBe(false);
    expect(
      verifyWebhookSignature({
        signatureHeader: header,
        requestId: 'req-1',
        dataId: '999',
        secret,
      }),
    ).toBe(false);
    expect(
      verifyWebhookSignature({
        signatureHeader: header,
        requestId: 'req-2',
        dataId: '123456',
        secret,
      }),
    ).toBe(false);
  });

  it('rejeita header malformado ou ausente', () => {
    expect(
      verifyWebhookSignature({ signatureHeader: 'lixo', requestId: 'r', dataId: '1', secret }),
    ).toBe(false);
    expect(
      verifyWebhookSignature({ signatureHeader: undefined, requestId: 'r', dataId: '1', secret }),
    ).toBe(false);
  });

  it('rejeita assinatura antiga quando há tolerância (anti-replay)', () => {
    const old = Date.now() - 10 * 60 * 1000;
    const header = createSignatureHeader('1', 'r', secret, old);
    expect(
      verifyWebhookSignature({
        signatureHeader: header,
        requestId: 'r',
        dataId: '1',
        secret,
        toleranceSeconds: 300,
      }),
    ).toBe(false);
    expect(
      verifyWebhookSignature({ signatureHeader: header, requestId: 'r', dataId: '1', secret }),
    ).toBe(true);
  });
});
