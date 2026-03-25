import type { PaymentMethod } from "@prisma/client";

import { prisma } from "@/lib/db";

const DEFAULT_WIRE_TRANSFER_EXPIRY_HOURS = 72;
const DEFAULT_CASH_DEPOSIT_EXPIRY_HOURS = 48;

function parsePositiveNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export async function getDeferredPaymentExpiryHours(
  tenantId: string,
  method: PaymentMethod
) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true },
  });

  const settings = (tenant?.settings as Record<string, unknown> | null) ?? {};

  if (method === "WIRE_TRANSFER") {
    return (
      parsePositiveNumber(settings.wireTransferExpiryHours) ??
      parsePositiveNumber(process.env.WIRE_TRANSFER_EXPIRY_HOURS) ??
      DEFAULT_WIRE_TRANSFER_EXPIRY_HOURS
    );
  }

  return (
    parsePositiveNumber(settings.cashDepositExpiryHours) ??
    parsePositiveNumber(process.env.CASH_DEPOSIT_EXPIRY_HOURS) ??
    DEFAULT_CASH_DEPOSIT_EXPIRY_HOURS
  );
}
