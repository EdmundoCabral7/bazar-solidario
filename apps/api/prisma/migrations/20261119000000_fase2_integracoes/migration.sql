-- AlterTable
ALTER TABLE "Donation" ADD COLUMN     "campaignId" TEXT;

-- AlterTable
ALTER TABLE "NotificationOutbox" ADD COLUMN     "lockedUntil" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "trackingCode" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "expiresAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "weightGrams" INTEGER NOT NULL DEFAULT 500;

-- AlterTable
ALTER TABLE "Sponsorship" ADD COLUMN     "checkoutUrl" TEXT,
ADD COLUMN     "idempotencyKey" TEXT;

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "goalCents" INTEGER NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_slug_key" ON "Campaign"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Sponsorship_idempotencyKey_key" ON "Sponsorship"("idempotencyKey");

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

