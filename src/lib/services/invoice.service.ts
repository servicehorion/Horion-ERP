import { prisma } from "@/lib/db";
import type { InvoiceDirection, InvoiceStatus, InvoicePayStatus, Prisma } from "@prisma/client";

export class InvoiceService {
  private static getModel<T extends keyof typeof prisma>(name: T) {
    const model = (prisma as any)[name];
    if (!model) {
      console.warn(`Prisma client missing model: ${String(name)}. Run \`npx prisma generate\`.`);
    }
    return model;
  }

  static async list(
    tenantId: string,
    options: { status?: InvoiceStatus; direction?: InvoiceDirection; search?: string } = {}
  ) {
    const model = this.getModel("invoice");
    if (!model) return [];

    const where: Prisma.InvoiceWhereInput = {
      tenantId,
      ...(options.status && { status: options.status }),
      ...(options.direction && { direction: options.direction }),
      ...(options.search && {
        OR: [
          { invoiceNumber: { contains: options.search, mode: "insensitive" } },
          { contact: { name: { contains: options.search, mode: "insensitive" } } },
          { supplier: { name: { contains: options.search, mode: "insensitive" } } },
        ],
      }),
    };

    return model.findMany({
      where,
      include: {
        contact: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
        order: { select: { id: true, orderNumber: true } },
        lines: true,
        schedules: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  static async create(params: {
    tenantId: string;
    direction: InvoiceDirection;
    invoiceNumber: string;
    contactId?: string;
    supplierId?: string;
    orderId?: string;
    currency: string;
    issuedAt?: Date | null;
    dueAt?: Date | null;
    notes?: string;
    lines: Array<{ description: string; quantity: number; unitPrice: number; taxRate?: number | null }>;
  }) {
    const model = this.getModel("invoice");
    if (!model) {
      throw new Error("Model invoice missing. Run `npx prisma generate`.");
    }

    const subtotal = params.lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);
    const taxTotal = params.lines.reduce(
      (sum, l) => sum + (l.taxRate ? (l.quantity * l.unitPrice * l.taxRate) / 100 : 0),
      0
    );
    const total = subtotal + taxTotal;

    return model.create({
      data: {
        tenantId: params.tenantId,
        direction: params.direction,
        invoiceNumber: params.invoiceNumber,
        contactId: params.contactId || undefined,
        supplierId: params.supplierId || undefined,
        orderId: params.orderId || undefined,
        currency: params.currency,
        subtotal,
        taxTotal,
        total,
        issuedAt: params.issuedAt || undefined,
        dueAt: params.dueAt || undefined,
        notes: params.notes,
        lines: {
          create: params.lines.map((line) => ({
            description: line.description,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            taxRate: line.taxRate ?? undefined,
            total: line.quantity * line.unitPrice,
          })),
        },
      },
      include: { lines: true },
    });
  }

  static async updateStatus(tenantId: string, invoiceId: string, status: InvoiceStatus) {
    const model = this.getModel("invoice");
    if (!model) {
      throw new Error("Model invoice missing. Run `npx prisma generate`.");
    }
    const invoice = await model.findUnique({ where: { id: invoiceId } });
    if (!invoice || invoice.tenantId !== tenantId) throw new Error("Facture introuvable");

    return model.update({
      where: { id: invoiceId },
      data: {
        status,
        ...(status === "PAID" && { paidAt: new Date() }),
        ...(status === "SENT" && { issuedAt: invoice.issuedAt || new Date() }),
      },
    });
  }

  static async addSchedule(params: { invoiceId: string; dueAt: Date; amount: number }) {
    const model = this.getModel("invoiceSchedule");
    if (!model) {
      throw new Error("Model invoiceSchedule missing. Run `npx prisma generate`.");
    }
    return model.create({
      data: {
        invoiceId: params.invoiceId,
        dueAt: params.dueAt,
        amount: params.amount,
        status: "PENDING",
      },
    });
  }

  static async markSchedulePaid(scheduleId: string) {
    const model = this.getModel("invoiceSchedule");
    if (!model) {
      throw new Error("Model invoiceSchedule missing. Run `npx prisma generate`.");
    }
    return model.update({
      where: { id: scheduleId },
      data: { status: "PAID", paidAt: new Date() },
    });
  }

  static async createReminder(params: { invoiceId: string; channel: string }) {
    const model = this.getModel("invoiceReminder");
    if (!model) {
      throw new Error("Model invoiceReminder missing. Run `npx prisma generate`.");
    }
    return model.create({
      data: {
        invoiceId: params.invoiceId,
        channel: params.channel,
        status: "SENT",
      },
    });
  }

  static async refreshOverdue(tenantId: string) {
    const model = this.getModel("invoice");
    if (!model) return;
    const now = new Date();
    await model.updateMany({
      where: {
        tenantId,
        status: { in: ["SENT", "PARTIAL"] },
        dueAt: { lt: now },
      },
      data: { status: "OVERDUE" },
    });
  }

  static async computePayStatus(invoiceId: string) {
    const model = this.getModel("invoice");
    if (!model) return;
    const invoice = await model.findUnique({
      where: { id: invoiceId },
      include: { schedules: true },
    });
    if (!invoice) return;
    const paid = invoice.schedules
      .filter((s: any) => s.status === "PAID")
      .reduce((sum: number, s: any) => sum + Number(s.amount), 0);

    let status: InvoiceStatus = invoice.status;
    if (paid >= Number(invoice.total)) status = "PAID";
    else if (paid > 0) status = "PARTIAL";
    else if (invoice.dueAt && invoice.dueAt < new Date()) status = "OVERDUE";

    if (status !== invoice.status) {
      await model.update({ where: { id: invoiceId }, data: { status } });
    }
  }

  static async updateScheduleStatus(scheduleId: string, status: InvoicePayStatus) {
    const model = this.getModel("invoiceSchedule");
    if (!model) {
      throw new Error("Model invoiceSchedule missing. Run `npx prisma generate`.");
    }
    const schedule = await model.update({
      where: { id: scheduleId },
      data: {
        status,
        paidAt: status === "PAID" ? new Date() : undefined,
      },
      include: { invoice: true },
    });

    await this.computePayStatus(schedule.invoiceId);
    return schedule;
  }

  static async getAging(tenantId: string) {
    const model = this.getModel("invoice");
    if (!model) return [];
    const now = new Date();
    const invoices = await model.findMany({
      where: { tenantId, direction: "AR", status: { in: ["SENT", "PARTIAL", "OVERDUE"] } },
      include: { contact: { select: { id: true, name: true } } },
    });

    return invoices.map((inv: any) => {
      const due = inv.dueAt ? new Date(inv.dueAt) : null;
      const daysLate = due ? Math.floor((now.getTime() - due.getTime()) / 86_400_000) : 0;
      return {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        contactName: inv.contact?.name,
        total: Number(inv.total),
        currency: inv.currency,
        dueAt: inv.dueAt,
        daysLate: Math.max(0, daysLate),
        status: inv.status,
      };
    });
  }

  static async autoRemindOverdue(tenantId: string) {
    const model = this.getModel("invoice");
    if (!model) return { reminders: 0 };
    const now = new Date();
    const overdue = await model.findMany({
      where: {
        tenantId,
        direction: "AR",
        status: { in: ["SENT", "PARTIAL", "OVERDUE"] },
        dueAt: { lt: now },
      },
    });

    let reminders = 0;
    for (const inv of overdue) {
      await this.createReminder({ invoiceId: inv.id, channel: "email" });
      reminders++;
    }

    return { reminders };
  }
}
