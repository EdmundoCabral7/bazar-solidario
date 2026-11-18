-- Um pagamento pertence a exatamente um entre pedido, doação ou apadrinhamento.
ALTER TABLE "Payment" ADD CONSTRAINT "payment_single_target"
  CHECK (num_nonnulls("orderId", "donationId", "sponsorshipId") = 1);
