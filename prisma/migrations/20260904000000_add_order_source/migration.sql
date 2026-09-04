-- CreateEnum
CREATE TYPE "OrderSource" AS ENUM ('JGP_WEB', 'SHOPIFY_HISTORICAL', 'ADMIN', 'RETAIL', 'MARKETPLACE', 'OTHER');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "source" "OrderSource" NOT NULL DEFAULT 'JGP_WEB';

-- CreateIndex
CREATE INDEX "Order_source_idx" ON "Order"("source");
