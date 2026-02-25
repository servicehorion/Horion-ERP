import { prisma } from "@/lib/db";
import { CustomerIntelligenceService } from "@/lib/services/customer-intelligence.service";

async function main() {
  const contacts = await prisma.contact.findMany({
    select: { id: true, name: true },
  });

  let processed = 0;
  for (const contact of contacts) {
    await CustomerIntelligenceService.recalculateAll(contact.id);
    processed += 1;
    if (processed % 50 === 0) {
      console.log(`Recalculated ${processed}/${contacts.length}`);
    }
  }

  console.log(`Done. Recalculated ${processed} contacts.`);
}

main()
  .catch((error) => {
    console.error("Recalculate failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
