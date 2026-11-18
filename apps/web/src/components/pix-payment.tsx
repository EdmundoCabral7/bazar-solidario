'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { Alert } from './ui/alert';
import { Button } from './ui/button';
import { CopyButton } from './copy-button';
import { errorMessage, post } from '@/lib/api';
import { useDemoMode } from '@/lib/demo';
import type { Payment } from '@/lib/types';
import { formatBRL, formatDateTime } from '@/lib/utils';

/** Bloco de pagamento Pix (QR + copia e cola) com o simulador do modo demonstração. */
export function PixPayment({
  payment,
  invalidateKey,
}: {
  payment: Payment;
  invalidateKey: unknown[];
}) {
  const demo = useDemoMode();
  const qc = useQueryClient();
  const simulate = useMutation({
    mutationFn: (status: 'APPROVED' | 'REJECTED') =>
      post(`/api/dev/payments/${payment.id}/simulate`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: invalidateKey }),
  });

  if (payment.method !== 'PIX' || payment.status !== 'PENDING' || !payment.pixCopyPaste)
    return null;

  return (
    <section
      aria-labelledby="pix-titulo"
      className="space-y-4 rounded-lg border border-border bg-card p-5"
    >
      <h2 id="pix-titulo" className="text-lg font-semibold">
        Pague {formatBRL(payment.amountCents)} com Pix
      </h2>
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <div className="rounded-md bg-white p-3">
          {payment.pixQrCodeBase64 ? (
            <img
              src={`data:image/png;base64,${payment.pixQrCodeBase64}`}
              alt="QR Code Pix"
              className="size-48"
            />
          ) : (
            <QRCodeSVG
              value={payment.pixCopyPaste}
              size={192}
              aria-label="QR Code Pix"
              role="img"
            />
          )}
        </div>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Abra o app do seu banco e escolha pagar com Pix.</li>
          <li>Escaneie o QR Code ou use o “copia e cola”.</li>
          <li>Confirme o pagamento — esta página atualiza sozinha.</li>
          {payment.expiresAt && <li>O código vale até {formatDateTime(payment.expiresAt)}.</li>}
        </ol>
      </div>
      <div className="space-y-2">
        <label htmlFor="pix-copia-cola" className="text-sm font-medium">
          Pix copia e cola
        </label>
        <textarea
          id="pix-copia-cola"
          readOnly
          value={payment.pixCopyPaste}
          rows={3}
          className="w-full resize-none rounded-md border border-border bg-muted p-2 font-mono text-xs"
          onFocus={(e) => e.currentTarget.select()}
        />
        <CopyButton text={payment.pixCopyPaste} />
      </div>
      {demo && (
        <Alert tone="info" title="Modo demonstração">
          <p className="mb-3">
            Nenhum banco real está conectado. Simule a resposta do Mercado Pago — o sistema processa
            exatamente como um webhook real.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => simulate.mutate('APPROVED')}
              disabled={simulate.isPending}
            >
              Simular pagamento aprovado
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => simulate.mutate('REJECTED')}
              disabled={simulate.isPending}
            >
              Simular recusa
            </Button>
          </div>
          {simulate.error && (
            <p className="mt-2 text-destructive">{errorMessage(simulate.error)}</p>
          )}
        </Alert>
      )}
    </section>
  );
}
