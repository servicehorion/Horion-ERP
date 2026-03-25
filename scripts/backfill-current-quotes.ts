import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const orders = await prisma.order.findMany({
    select: {
      id: true,
      currentQuoteId: true,
      quotes: {
        select: {
          id: true,
          version: true,
          isActive: true,
        },
        orderBy: [{ version: "desc" }, { createdAt: "desc" }],
      },
    },
  });

  let updatedOrders = 0;
  let updatedQuotes = 0;

  for (const order of orders) {
    if (order.quotes.length === 0) {
      if (order.currentQuoteId) {
        await prisma.order.update({
          where: { id: order.id },
          data: { currentQuoteId: null },
        });
        updatedOrders += 1;
      }
      continue;
    }

    const currentQuote = order.quotes[0];
    const inactiveIds = order.quotes.filter((quote) => quote.id !== currentQuote.id && quote.isActive).map((quote) => quote.id);
    const currentNeedsUpdate = !currentQuote.isActive || order.currentQuoteId !== currentQuote.id;

    if (inactiveIds.length === 0 && !currentNeedsUpdate) continue;

    await prisma.$transaction([
      prisma.quote.updateMany({
        where: { id: { in: inactiveIds } },
        data: { isActive: false },
      }),
      prisma.quote.update({
        where: { id: currentQuote.id },
        data: { isActive: true },
      }),
      prisma.order.update({
        where: { id: order.id },
        data: { currentQuoteId: currentQuote.id },
      }),
    ]);

    updatedOrders += 1;
    updatedQuotes += inactiveIds.length + (currentNeedsUpdate ? 1 : 0);
  }

  console.log(
    JSON.stringify(
      {
        ordersScanned: orders.length,
        updatedOrders,
        updatedQuotes,
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
