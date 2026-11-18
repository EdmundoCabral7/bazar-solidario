import type { Prisma } from '@prisma/client';

/** Devolve ao estoque os itens de um pedido cancelado (e reativa peças que estavam SOLD). */
export async function restoreStock(tx: Prisma.TransactionClient, orderId: string) {
  const items = await tx.orderItem.findMany({ where: { orderId } });
  for (const item of items) {
    const product = await tx.product.update({
      where: { id: item.productId },
      data: { stock: { increment: item.quantity } },
    });
    if (product.status === 'SOLD' && product.stock > 0) {
      await tx.product.update({ where: { id: product.id }, data: { status: 'ACTIVE' } });
    }
  }
}
