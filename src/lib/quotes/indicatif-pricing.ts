import type { Prisma } from "@prisma/client";

type SnapshotRecord = Record<string, unknown>;

export type IndicatifPricingSelection = Record<string, string> | string | null | undefined;

type IndicatifSnapshotItem = SnapshotRecord & {
  productSellXAF?: unknown;
  serviceFeeXAF?: unknown;
  totalXAF?: unknown;
  selectedTransport?: SnapshotRecord | null;
};

function selectionForIndex(selections: IndicatifPricingSelection, index: number) {
  if (typeof selections === "string") return selections;
  return selections?.[String(index)];
}

export function applyIndicatifTransportSelection(
  snapshot: Record<string, unknown>,
  selections?: IndicatifPricingSelection
) {
  const originalItems = Array.isArray(snapshot.items) ? snapshot.items : [];
  if (originalItems.length === 0) return null;

  const items: IndicatifSnapshotItem[] = originalItems.map((raw, index) => {
    const item = raw && typeof raw === "object" ? { ...(raw as SnapshotRecord) } : {};
    const options = Array.isArray(item.transportOptions)
      ? (item.transportOptions.filter((option) => option && typeof option === "object") as SnapshotRecord[])
      : [];

    const currentSelected =
      item.selectedTransport && typeof item.selectedTransport === "object"
        ? (item.selectedTransport as SnapshotRecord)
        : options[0] ?? null;

    const selectedKey = selectionForIndex(selections, index);
    const nextSelected =
      (selectedKey ? options.find((option) => String(option.key ?? "") === selectedKey) : null) ??
      currentSelected;

    const productSellXAF = Number(item.productSellXAF ?? 0);
    const serviceFeeXAF = Number(item.serviceFeeXAF ?? 0);
    const transportCostXAF = Number(nextSelected?.costXAF ?? 0);
    const totalXAF = productSellXAF + serviceFeeXAF + transportCostXAF;

    return {
      ...item,
      selectedTransport: nextSelected,
      totalXAF,
    } as IndicatifSnapshotItem;
  });

  const merchandiseTotal = items.reduce((sum, item) => sum + Number(item.productSellXAF ?? 0), 0);
  const commission = items.reduce((sum, item) => sum + Number(item.serviceFeeXAF ?? 0), 0);
  const logisticsCost = items.reduce(
    (sum, item) => sum + Number((item.selectedTransport as SnapshotRecord | null)?.costXAF ?? 0),
    0
  );
  const total = items.reduce((sum, item) => sum + Number(item.totalXAF ?? 0), 0);

  return {
    snapshot: {
      ...snapshot,
      items,
    } as Prisma.InputJsonValue,
    merchandiseTotal,
    commission,
    logisticsCost,
    insuranceCost: 0,
    total,
  };
}
