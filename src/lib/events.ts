import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export async function emitEvent(
  type: string,
  entityType: string,
  entityId: string,
  payload: Prisma.InputJsonValue = {}
) {
  const event = await prisma.event.create({
    data: { type, entityType, entityId, payload },
  });

  // Process immediately in development (in production, use cron)
  await processEvents();

  return event;
}

export async function processEvents() {
  const { eventHandlerRegistry } = await import("@/lib/event-handlers");

  const events = await prisma.event.findMany({
    where: { processed: false },
    orderBy: { createdAt: "asc" },
    take: 50,
  });

  for (const event of events) {
    const handlers = eventHandlerRegistry[event.type];
    if (handlers) {
      for (const handler of handlers) {
        try {
          await handler(event);
        } catch (error) {
          console.error(`Event handler error for ${event.type}:`, error);
        }
      }
    }
    await prisma.event.update({
      where: { id: event.id },
      data: { processed: true, processedAt: new Date() },
    });
  }
}
