import { prisma } from "@/lib/db";
import { emitEvent } from "@/lib/events";
import { ORDER_STATUS_LABELS, ORDER_STATUS_TRANSITIONS, canTransition } from "@/config/order-statuses";
import { Prisma, type OrderStatus, type Priority } from "@prisma/client";
import type { CreateOrderInput } from "@/lib/validators/order";
import { convertCurrency } from "@/config/currencies";
import { RiskCalculatorService } from "@/lib/services/risk-calculator.service";
import { serializeDecimals } from "@/lib/utils";
import { FxService } from "@/lib/services/fx.service";
import { OrderApprovalService } from "@/lib/services/order-approval.service";
import { InvoiceService } from "@/lib/services/invoice.service";
import { CatalogMemoryService } from "@/lib/services/catalog-memory.service";
import { FinanceTransactionService } from "@/lib/services/finance-transaction.service";

const orderDetailSelect = Prisma.validator<Prisma.OrderSelect>()({
  id: true,
  tenantId: true,
  orderNumber: true,
  status: true,
  approvalStatus: true,
  priority: true,
  riskLevel: true,
  originCountry: true,
  destinationCity: true,
  notes: true,
  merchandiseTotal: true,
  logisticsCost: true,
  commissionRate: true,
  commissionAmount: true,
  insuranceAmount: true,
  totalClient: true,
  budgetPlannedXAF: true,
  budgetActualXAF: true,
  fxImpactXAF: true,
  fxRatesSnapshot: true,
  estimatedDelivery: true,
  actualDelivery: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
  currentQuote: {
    select: {
      id: true,
      version: true,
      status: true,
      approvalStatus: true,
      paymentStatus: true,
      paidAt: true,
      total: true,
      validUntil: true,
    },
  },
  contact: {
    select: {
      name: true,
      email: true,
      phone: true,
    },
  },
  items: {
    select: {
      id: true,
      description: true,
      quantity: true,
      unitPrice: true,
      currency: true,
      totalXAF: true,
    },
  },
  owner: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  onboardedBy: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  collaborators: {
    select: {
      userId: true,
      user: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  },
  attachments: {
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      url: true,
      type: true,
      createdAt: true,
      user: {
        select: {
          name: true,
        },
      },
    },
  },
  quotes: {
    orderBy: { version: "desc" },
    select: {
      id: true,
      version: true,
      isActive: true,
      status: true,
      approvalStatus: true,
      approvedAt: true,
      merchandiseTotal: true,
      logisticsCost: true,
      commission: true,
      insuranceCost: true,
      total: true,
      currency: true,
      validUntil: true,
      createdAt: true,
      sentAt: true,
      sentByEmailAt: true,
      sentByEmailTo: true,
      acceptedAt: true,
      signatureToken: true,
      signedAt: true,
      signedByName: true,
      signedByEmail: true,
      pricingSnapshot: true,
      paymentToken: true,
      paymentStatus: true,
      paymentExpiry: true,
    },
  },
  approvals: {
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      status: true,
      note: true,
      decidedAt: true,
      rule: {
        select: {
          name: true,
          requiredRole: true,
          minAmountXAF: true,
        },
      },
      decidedBy: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  },
  revisions: {
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      revisionNumber: true,
      reason: true,
      createdAt: true,
    },
  },
  ediTransmissions: {
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      provider: true,
      status: true,
      sentAt: true,
    },
  },
  timeline: {
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      event: true,
      fromValue: true,
      toValue: true,
      note: true,
      userId: true,
      createdAt: true,
    },
  },
  tasks: {
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      status: true,
      slaDeadline: true,
      slaBreach: true,
      assignments: {
        select: {
          user: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  },
  shipments: {
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      mode: true,
      status: true,
      origin: true,
      destination: true,
      trackingProvider: true,
      trackingNumber: true,
      trackingStatus: true,
      trackingUrl: true,
      lastTrackingSyncAt: true,
      containerNumber: true,
      blNumber: true,
      weight: true,
      volume: true,
      estimatedDeparture: true,
      estimatedArrival: true,
      actualDeparture: true,
      actualArrival: true,
      cost: true,
      currency: true,
      trackingEvents: {
        orderBy: { occurredAt: "asc" },
        select: {
          id: true,
          event: true,
          location: true,
          description: true,
          occurredAt: true,
        },
      },
      customsClearance: {
        select: {
          id: true,
          shipmentId: true,
          status: true,
          declarationNum: true,
          dutyAmount: true,
          dutyCurrency: true,
          brokerName: true,
          submittedAt: true,
          clearedAt: true,
        },
      },
      aiInsight: {
        select: {
          predictedArrival: true,
          predictedDelayDays: true,
          riskLevel: true,
        },
      },
    },
  },
  payments: {
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      direction: true,
      type: true,
      status: true,
      amount: true,
      amountXAF: true,
      currency: true,
      method: true,
      reference: true,
      dueAt: true,
      createdAt: true,
    },
  },
  disputes: {
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      type: true,
      status: true,
      description: true,
      resolution: true,
      amount: true,
      currency: true,
      createdAt: true,
      resolvedAt: true,
    },
  },
  returns: {
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      reason: true,
      notes: true,
      trackingNumber: true,
      warehouseSite: true,
      approvedAt: true,
      receivedAt: true,
      createdAt: true,
      lines: {
        select: {
          id: true,
          description: true,
          quantity: true,
          condition: true,
          notes: true,
        },
      },
    },
  },
  qcRequests: {
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      type: true,
      status: true,
      inspector: true,
      scheduledAt: true,
      completedAt: true,
      cost: true,
      currency: true,
      reports: {
        select: {
          id: true,
          overallResult: true,
          defectRate: true,
          recommendation: true,
          createdAt: true,
          nonConformities: {
            select: {
              id: true,
              category: true,
              severity: true,
              description: true,
              photoUrl: true,
              resolution: true,
            },
          },
        },
      },
    },
  },
  qcInspections: {
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      overall: true,
      completedAt: true,
      createdAt: true,
    },
  },
  sourcingCases: {
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      requirement: true,
      budget: true,
      currency: true,
      createdAt: true,
      supplier: {
        select: {
          id: true,
          name: true,
          country: true,
        },
      },
      offers: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          unitPrice: true,
          currency: true,
          isSelected: true,
          moq: true,
          leadTimeDays: true,
        },
      },
    },
  },
  marginReport: {
    select: {
      revenue: true,
      cogs: true,
      commission: true,
      grossMargin: true,
      marginPercent: true,
      netMargin: true,
      netMarginPct: true,
      currency: true,
      calculatedAt: true,
    },
  },
  warehouseReceipts: {
    orderBy: { receivedAt: "desc" },
    select: {
      id: true,
      receivedAt: true,
      readyToShip: true,
    },
  },
});

export class OrderService {
  private static hasArchivedAtField() {
    const models = (prisma as any)?._dmmf?.datamodel?.models;
    const orderModel = Array.isArray(models) ? models.find((m: any) => m.name === "Order") : null;
    return !!orderModel?.fields?.some((f: any) => f.name === "archivedAt");
  }

  private static async assertClientFacingContact(tenantId: string, contactId: string) {
    const contact = await prisma.contact.findFirst({
      where: { id: contactId, tenantId },
      select: { id: true, type: true },
    });
    if (!contact) throw new Error("Contact introuvable");
    if (!["CLIENT", "PROSPECT"].includes(contact.type)) {
      throw new Error("Une commande client doit etre rattachée a un contact CLIENT ou PROSPECT");
    }
    return contact;
  }

  private static isOpenReturnStatus(status: string) {
    return !["RESOLVED", "CLOSED", "REJECTED"].includes(status);
  }

  private static isOpenDisputeStatus(status: string) {
    return !["RESOLVED", "CLOSED"].includes(status);
  }

  private static hasConfirmedInboundPayment(
    payments: Array<{ direction: string; status: string }>,
  ) {
    return payments.some((payment) => payment.direction === "INBOUND" && payment.status === "CONFIRMED");
  }

  private static async loadTransitionContext(orderId: string) {
    return prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        tenantId: true,
        status: true,
        approvalStatus: true,
        priority: true,
        riskLevel: true,
        estimatedDelivery: true,
        actualDelivery: true,
        contactId: true,
        orderNumber: true,
        currency: true,
        totalClient: true,
        currentQuote: {
          select: {
            id: true,
            status: true,
            approvalStatus: true,
            paymentStatus: true,
            paidAt: true,
            total: true,
            validUntil: true,
          },
        },
        quotes: {
          where: { isActive: true },
          orderBy: { version: "desc" },
          take: 3,
          select: {
            id: true,
            status: true,
            approvalStatus: true,
            paymentStatus: true,
            acceptedAt: true,
            validUntil: true,
            total: true,
          },
        },
        payments: {
          select: {
            id: true,
            direction: true,
            type: true,
            status: true,
            amountXAF: true,
            confirmedAt: true,
            dueAt: true,
          },
        },
        shipments: {
          select: {
            id: true,
            status: true,
            estimatedDeparture: true,
            actualDeparture: true,
            estimatedArrival: true,
            actualArrival: true,
            customsClearance: {
              select: {
                status: true,
                clearedAt: true,
              },
            },
            warehouseReceipt: {
              select: {
                id: true,
                receivedAt: true,
                readyToShip: true,
              },
            },
            trackingEvents: {
              orderBy: { occurredAt: "desc" },
              take: 1,
              select: { occurredAt: true, event: true },
            },
          },
        },
        warehouseReceipts: {
          select: {
            id: true,
            receivedAt: true,
            readyToShip: true,
          },
          orderBy: { receivedAt: "desc" },
        },
        qcRequests: {
          orderBy: [{ completedAt: "desc" }, { createdAt: "desc" }],
          select: {
            id: true,
            status: true,
            completedAt: true,
          },
        },
        qcInspections: {
          orderBy: [{ completedAt: "desc" }, { createdAt: "desc" }],
          select: {
            id: true,
            status: true,
            overall: true,
            completedAt: true,
          },
        },
        returns: {
          select: { status: true },
        },
        disputes: {
          select: { status: true },
        },
        marginReport: {
          select: {
            id: true,
            calculatedAt: true,
            grossMargin: true,
            marginPercent: true,
            netMargin: true,
            netMarginPct: true,
            currency: true,
          },
        },
      },
    });
  }

  private static collectTransitionBlockers(
    context: NonNullable<Awaited<ReturnType<typeof OrderService.loadTransitionContext>>>,
    newStatus: OrderStatus,
  ) {
    const blockers: string[] = [];
    const currentQuote = context.currentQuote ?? context.quotes[0] ?? null;
    const approvedQuote =
      currentQuote && currentQuote.approvalStatus === "APPROVED"
        ? currentQuote
        : context.quotes.find((quote) => quote.approvalStatus === "APPROVED") ?? null;
    const acceptedQuote =
      (approvedQuote && approvedQuote.status === "ACCEPTED" ? approvedQuote : null) ??
      context.quotes.find((quote) => quote.status === "ACCEPTED" && quote.approvalStatus === "APPROVED") ??
      null;
    const confirmedInboundPayment = this.hasConfirmedInboundPayment(context.payments);
    const warehouseReceiptCount = context.warehouseReceipts.length;
    const shipments = context.shipments ?? [];
    const hasShipment = shipments.length > 0;
    const hasBookedOrMovingShipment = shipments.some((shipment) =>
      ["BOOKED", "PICKED_UP", "IN_TRANSIT", "ARRIVED_PORT", "CUSTOMS", "CLEARED", "IN_DELIVERY", "DELIVERED"].includes(
        shipment.status,
      ) || Boolean(shipment.actualDeparture),
    );
    const hasDeliveredShipment =
      shipments.some((shipment) => shipment.status === "DELIVERED") || Boolean(context.actualDelivery);
    const hasCustomsSignal = shipments.some(
      (shipment) =>
        Boolean(shipment.customsClearance && shipment.customsClearance.status !== "PENDING") ||
        ["CUSTOMS", "CLEARED", "IN_DELIVERY", "DELIVERED"].includes(shipment.status),
    );
    const latestQcRequest = context.qcRequests[0] ?? null;
    const latestInspection = context.qcInspections[0] ?? null;
    const qcFailed =
      latestQcRequest?.status === "FAILED" ||
      latestInspection?.overall === "FAIL";
    const qcPassed =
      ["PASSED", "CONDITIONAL"].includes(latestQcRequest?.status ?? "") ||
      ["PASS", "CONDITIONAL"].includes(latestInspection?.overall ?? "");
    const qcEvidenceExists = context.qcRequests.length > 0 || context.qcInspections.length > 0;

    if (["PENDING", "REJECTED"].includes(context.approvalStatus as any) && !["DEMANDE", "DEVIS"].includes(newStatus)) {
      blockers.push("La commande est encore en attente d'approbation interne.");
    }

    if (qcFailed && ["QC_VALIDE", "EN_TRANSIT", "DEDOUANE", "LIVRE", "CLOTURE"].includes(newStatus)) {
      blockers.push("Blocage qualite : un QC en echec doit etre corrige avant progression.");
    }

    switch (newStatus) {
      case "PAIEMENT_EN_COURS":
        if (!currentQuote) {
          blockers.push("Aucun devis actif n'est rattache a cette commande.");
        } else {
          if (currentQuote.approvalStatus !== "APPROVED") {
            blockers.push("Le devis actif doit etre approuve avant d'entrer en paiement.");
          }
          if (!["SENT", "ACCEPTED"].includes(currentQuote.status)) {
            blockers.push("Le devis actif doit etre envoye ou accepte pour lancer le paiement.");
          }
        }
        break;
      case "SOURCING":
        if (!acceptedQuote) {
          blockers.push("Le sourcing ne peut demarrer qu'apres acceptation d'un devis approuve.");
        }
        if (!confirmedInboundPayment) {
          blockers.push("Aucun paiement client confirme : impossible de basculer en sourcing.");
        }
        break;
      case "RECU_ENTREPOT":
        if (warehouseReceiptCount === 0 && !shipments.some((shipment) => shipment.warehouseReceipt)) {
          blockers.push("Aucune reception entrepot confirmee pour cette commande.");
        }
        break;
      case "QC_EN_COURS":
        if (warehouseReceiptCount === 0 && !shipments.some((shipment) => shipment.warehouseReceipt)) {
          blockers.push("Le QC doit partir d'une reception entrepot confirmee.");
        }
        break;
      case "QC_VALIDE":
        if (qcEvidenceExists && !qcPassed) {
          blockers.push("Aucun resultat QC positif n'est encore disponible.");
        }
        break;
      case "EN_TRANSIT":
        if (!hasShipment) {
          blockers.push("Aucune expedition n'est creee pour cette commande.");
        }
        if (hasShipment && !hasBookedOrMovingShipment) {
          blockers.push("L'expedition doit etre au minimum reservee avant passage en transit.");
        }
        break;
      case "DEDOUANE":
        if (!hasShipment) {
          blockers.push("Aucune expedition n'existe pour lancer le dedouanement.");
        }
        if (hasShipment && !hasCustomsSignal) {
          blockers.push("Aucune preuve d'arrivee ou de clearance douane n'est disponible.");
        }
        break;
      case "LIVRE":
        if (!hasDeliveredShipment) {
          blockers.push("La commande ne peut etre marquee livree sans expedition remise ou preuve de livraison.");
        }
        break;
      case "CLOTURE":
        if (!hasDeliveredShipment) {
          blockers.push("Impossible de cloturer une commande non livree.");
        }
        if (context.disputes.some((dispute) => this.isOpenDisputeStatus(dispute.status))) {
          blockers.push("Impossible de cloturer : des litiges sont encore ouverts.");
        }
        if (context.returns.some((item) => this.isOpenReturnStatus(item.status))) {
          blockers.push("Impossible de cloturer : des retours marchandise sont encore ouverts.");
        }
        if (!context.marginReport) {
          blockers.push("La marge commande doit etre calculee avant cloture.");
        }
        break;
      default:
        break;
    }

    return blockers;
  }

  static async getTransitionReadiness(orderId: string) {
    const context = await this.loadTransitionContext(orderId);
    if (!context) throw new Error("Commande introuvable");

    const nextStatuses = ORDER_STATUS_TRANSITIONS[context.status] ?? [];
    const diagnostics = nextStatuses.map((status) => {
      const blockers = this.collectTransitionBlockers(context, status);
      return {
        status,
        label: ORDER_STATUS_LABELS[status],
        ready: blockers.length === 0,
        blockers,
      };
    });

    return {
      currentStatus: context.status,
      nextStatuses: diagnostics,
      activeBlockers: diagnostics.flatMap((item) => item.blockers),
    };
  }

  static async recalculateMarginFromFinance(orderId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, tenantId: true },
    });
    if (!order) throw new Error("Commande introuvable");

    await FinanceTransactionService.syncOrder(order.tenantId, orderId);

    const transactions = await prisma.financeTransaction.findMany({
      where: {
        tenantId: order.tenantId,
        orderId,
        status: "COMPLETED",
      },
      select: {
        category: true,
        amountXAF: true,
      },
    });

    const totals = transactions.reduce(
      (acc, transaction) => {
        const amount = Number(transaction.amountXAF || 0);
        switch (transaction.category) {
          case "CLIENT_PAYMENT":
            acc.revenue += amount;
            break;
          case "CHINA_PURCHASE":
            acc.cogs += amount;
            break;
          case "SHIPPING_FEE":
          case "PARTNER_PAYMENT":
            acc.freightCost += amount;
            break;
          case "PLATFORM_FEE":
            acc.commission += amount;
            break;
          case "INSURANCE_FEE":
            acc.protectionFee += amount;
            break;
          case "CLIENT_REFUND":
            acc.refund += amount;
            break;
          default:
            break;
        }
        return acc;
      },
      {
        revenue: 0,
        cogs: 0,
        freightCost: 0,
        qcCost: 0,
        customsDuties: 0,
        protectionFee: 0,
        commission: 0,
        refund: 0,
      },
    );

    const grossMargin =
      totals.revenue - totals.cogs - totals.freightCost - totals.qcCost - totals.customsDuties - totals.commission;
    const netMargin = grossMargin - totals.refund + totals.protectionFee;
    const marginPercent = totals.revenue > 0 ? (grossMargin / totals.revenue) * 100 : 0;
    const netMarginPct = totals.revenue > 0 ? (netMargin / totals.revenue) * 100 : 0;

    return prisma.marginReport.upsert({
      where: { orderId },
      update: {
        revenue: totals.revenue,
        cogs: totals.cogs,
        freightCost: totals.freightCost,
        qcCost: totals.qcCost,
        customsDuties: totals.customsDuties,
        protectionFee: totals.protectionFee,
        commission: totals.commission,
        grossMargin,
        marginPercent,
        netMargin,
        netMarginPct,
        currency: "XAF",
        calculatedAt: new Date(),
      },
      create: {
        orderId,
        revenue: totals.revenue,
        cogs: totals.cogs,
        freightCost: totals.freightCost,
        qcCost: totals.qcCost,
        customsDuties: totals.customsDuties,
        protectionFee: totals.protectionFee,
        commission: totals.commission,
        grossMargin,
        marginPercent,
        netMargin,
        netMarginPct,
        currency: "XAF",
      },
    });
  }

  static async generateOrderNumber(tenantId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = "HOR";

    const lastOrder = await prisma.order.findFirst({
      where: {
        tenantId,
        orderNumber: { startsWith: `${prefix}-${year}-` },
      },
      orderBy: { orderNumber: "desc" },
      select: { orderNumber: true },
    });

    const lastNum = lastOrder
      ? parseInt(lastOrder.orderNumber.split("-")[2])
      : 0;
    const nextNum = String(lastNum + 1).padStart(5, "0");

    return `${prefix}-${year}-${nextNum}`;
  }

  static async create(
    tenantId: string,
    data: CreateOrderInput & { ownerId?: string | null; onboardedById?: string | null; collaboratorIds?: string[]; leadId?: string | null }
  ) {
      const orderNumber = await this.generateOrderNumber(tenantId);
      const fxRates = await FxService.getLatestRates();
      await this.assertClientFacingContact(tenantId, data.contactId);

    // Calculate totals
    let merchandiseTotal = 0;
    const itemsWithXAF = data.items.map((item) => {
      const totalOriginal = item.unitPrice * item.quantity;
      const unitPriceXAF = convertCurrency(item.unitPrice, item.currency || "RMB", "XAF", fxRates);
      const totalXAF = unitPriceXAF * item.quantity;
      merchandiseTotal += totalXAF;
      return {
        ...item,
        unitPriceXAF,
        totalXAF,
      };
    });

    const commissionRate = data.commissionRate ?? 0.10;
    const commissionAmount = merchandiseTotal * commissionRate;
    const logisticsCost = data.logisticsCost ?? 0;
    const insuranceAmount = data.insuranceAmount ?? 0;
    const totalClient = merchandiseTotal + commissionAmount + logisticsCost + insuranceAmount;
    const budgetPlannedXAF = merchandiseTotal + logisticsCost + insuranceAmount;

    const order = await prisma.order.create({
      data: {
        tenantId,
        orderNumber,
        contactId: data.contactId,
        leadId: data.leadId ?? undefined,
        ownerId: data.ownerId ?? null,
        onboardedById: data.onboardedById ?? null,
        priority: data.priority as Priority,
        destinationCity: data.destinationCity || "Brazzaville",
        notes: data.notes,
        merchandiseTotal,
        commissionRate,
        commissionAmount,
        logisticsCost,
        insuranceAmount,
        totalClient,
        budgetPlannedXAF,
        budgetActualXAF: 0,
        currency: "XAF",
        fxRatesSnapshot: FxService.buildSnapshot(fxRates),
        fxImpactXAF: 0,
        originCountry: data.originCountry || "CN",
        items: {
          create: itemsWithXAF.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            currency: item.currency || "RMB",
            unitPriceXAF: item.unitPriceXAF,
            totalXAF: item.totalXAF,
            hsCode: item.hsCode,
            weight: item.weight,
            volume: item.volume,
            notes: item.notes,
          })),
        },
        collaborators: data.collaboratorIds?.length
          ? {
              create: data.collaboratorIds.map((userId) => ({ userId })),
            }
          : undefined,
        timeline: {
          create: {
            event: "order_created",
            toValue: "DEMANDE",
            note: "Commande creee",
          },
        },
      },
      include: {
        items: true,
        contact: true,
        timeline: true,
        collaborators: { include: { user: true } },
      },
    });

    await OrderApprovalService.syncOrderApprovals(order.id);

    await emitEvent("order.created", "order", order.id, {
      orderNumber: order.orderNumber,
      contactId: order.contactId,
      totalClient: Number(order.totalClient),
    });

    return order;
  }

  static async list(
    tenantId: string,
    options: {
      status?: OrderStatus;
      page?: number;
      limit?: number;
      search?: string;
      includeArchived?: boolean;
      scopeWhere?: Prisma.OrderWhereInput;
    } = {}
  ) {
    const { status, page = 1, limit = 20, search, includeArchived } = options;

    const where: Prisma.OrderWhereInput = {
      tenantId,
      ...(includeArchived || !OrderService.hasArchivedAtField() ? {} : { archivedAt: null }),
      ...(status && { status }),
      ...(search && {
        OR: [
          { orderNumber: { contains: search, mode: "insensitive" as const } },
          { contact: { name: { contains: search, mode: "insensitive" as const } } },
          { notes: { contains: search, mode: "insensitive" as const } },
        ],
      }),
      ...(options.scopeWhere || {}),
    };

    const select = {
      id: true,
      orderNumber: true,
      status: true,
      priority: true,
      riskLevel: true,
      estimatedDelivery: true,
      updatedAt: true,
      createdAt: true,
      totalClient: true,
      contact: { select: { name: true } },
    };

    let orders: any[] = [];
    let total = 0;

    try {
      [orders, total] = await prisma.$transaction([
        prisma.order.findMany({
          where,
          select,
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.order.count({ where }),
      ]);
    } catch (error) {
      console.warn("OrderService.list timeout fallback:", error);
      orders = await prisma.order.findMany({
        where,
        select,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      });
      total = orders.length;
    }

    return {
      orders,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  static async getById(orderId: string, scopeWhere?: Prisma.OrderWhereInput) {
    return prisma.order.findFirst({
      where: { id: orderId, ...(scopeWhere || {}) },
      include: {
        contact: true,
        currentQuote: true,
        items: true,
        owner: { select: { id: true, name: true, email: true } },
        onboardedBy: { select: { id: true, name: true, email: true } },
        collaborators: { include: { user: { select: { id: true, name: true, email: true } } } },
        attachments: { include: { user: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: "desc" } },
        quotes: { orderBy: { version: "desc" } },
        approvals: { include: { rule: true, decidedBy: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: "asc" } },
        revisions: { orderBy: { createdAt: "desc" }, take: 10 },
        ediTransmissions: { include: { supplier: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" } },
        portalTokens: { orderBy: { createdAt: "desc" }, take: 3 },
        timeline: { orderBy: { createdAt: "desc" } },
        tasks: {
          include: { assignments: { include: { user: true } } },
          orderBy: { createdAt: "desc" },
        },
        shipments: {
          include: {
            trackingEvents: { orderBy: { occurredAt: "asc" } },
            customsClearance: true,
            aiInsight: true,
            warehouseReceipt: true,
          },
          orderBy: { createdAt: "asc" },
        },
        payments: { orderBy: { createdAt: "desc" } },
        disputes: { orderBy: { createdAt: "desc" } },
        returns: { include: { lines: true }, orderBy: { createdAt: "desc" } },
        qcRequests: {
          include: { reports: { include: { nonConformities: true } } },
          orderBy: { createdAt: "desc" },
        },
        qcInspections: {
          orderBy: { createdAt: "desc" },
        },
        sourcingCases: {
          include: {
            supplier: { select: { id: true, name: true, country: true } },
            offers: { orderBy: { createdAt: "desc" } },
          },
          orderBy: { createdAt: "desc" },
        },
        marginReport: true,
        customsClearance: true,
        warehouseReceipts: { orderBy: { receivedAt: "desc" } },
      },
    });
  }

  static async getDetailById(orderId: string, scopeWhere?: Prisma.OrderWhereInput) {
    return prisma.order.findFirst({
      where: { id: orderId, ...(scopeWhere || {}) },
      select: orderDetailSelect,
    });
  }

  static async update(
    orderId: string,
    data: Partial<CreateOrderInput> & {
      ownerId?: string | null;
      onboardedById?: string | null;
      collaboratorIds?: string[];
      logisticsCost?: number;
      insuranceAmount?: number;
      commissionRate?: number;
      budgetPlannedXAF?: number;
    },
    updatedById?: string,
    revisionReason?: string
    ) {
      const existing = await prisma.order.findUnique({
        where: { id: orderId },
        include: { items: true },
      });
      if (!existing) throw new Error("Commande introuvable");
      await this.assertClientFacingContact(existing.tenantId, data.contactId ?? existing.contactId);

    const lastRevision = await prisma.orderRevision.findFirst({
      where: { orderId },
      orderBy: { revisionNumber: "desc" },
      select: { revisionNumber: true },
    });
    const nextRevisionNumber = lastRevision ? lastRevision.revisionNumber + 1 : 1;
    await prisma.orderRevision.create({
      data: {
        orderId,
        revisionNumber: nextRevisionNumber,
        reason: revisionReason || "Order update",
        snapshot: serializeDecimals({
          order: existing,
          items: existing.items,
        }),
        createdById: updatedById || undefined,
      },
    });

    const fxRates = await FxService.getLatestRates();
    let merchandiseTotal = Number(existing.merchandiseTotal);
    let itemsPayload: Array<{
      description: string;
      quantity: number;
      unitPrice: number;
      currency?: string;
      hsCode?: string;
      weight?: number;
      volume?: number;
      notes?: string;
      unitPriceXAF: number;
      totalXAF: number;
    }> = [];

    if (data.items && data.items.length > 0) {
      merchandiseTotal = 0;
      itemsPayload = data.items.map((item) => {
        const unitPriceXAF = convertCurrency(item.unitPrice, item.currency || "RMB", "XAF", fxRates);
        const totalXAF = unitPriceXAF * item.quantity;
        merchandiseTotal += totalXAF;
        return { ...item, unitPriceXAF, totalXAF };
      });
    }

    const commissionRate = data.commissionRate ?? Number(existing.commissionRate);
    const commissionAmount = merchandiseTotal * commissionRate;
    const logisticsCost = data.logisticsCost ?? Number(existing.logisticsCost);
    const insuranceAmount = data.insuranceAmount ?? Number(existing.insuranceAmount);
    const totalClient = merchandiseTotal + commissionAmount + logisticsCost + insuranceAmount;
    const budgetPlannedXAF =
      data.budgetPlannedXAF ??
      (Number(existing.budgetPlannedXAF || 0) || (merchandiseTotal + logisticsCost + insuranceAmount));

    const snapshotRates = (existing.fxRatesSnapshot as Record<string, number>) || {};
    const computeImpact = (items: typeof existing.items) => {
      let impact = 0;
      for (const item of items) {
        try {
          const baseAmount = Number(item.unitPrice);
          const qty = item.quantity;
          const xafSnapshot = convertCurrency(baseAmount, item.currency || "RMB", "XAF", snapshotRates);
          const xafLatest = convertCurrency(baseAmount, item.currency || "RMB", "XAF", fxRates);
          impact += (xafLatest - xafSnapshot) * qty;
        } catch {
          continue;
        }
      }
      return impact;
    };
    const fxImpactXAF = computeImpact(data.items && data.items.length > 0 ? (itemsPayload as any) : existing.items);

    const updated = await prisma.$transaction(async (tx) => {
      if (data.items && data.items.length > 0) {
        await tx.orderItem.deleteMany({ where: { orderId } });
        await tx.orderItem.createMany({
          data: itemsPayload.map((item) => ({
            orderId,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            currency: item.currency || "RMB",
            unitPriceXAF: item.unitPriceXAF,
            totalXAF: item.totalXAF,
            hsCode: item.hsCode,
            weight: item.weight,
            volume: item.volume,
            notes: item.notes,
          })),
        });
      }

      const order = await tx.order.update({
        where: { id: orderId },
        data: {
          ...(data.contactId && { contactId: data.contactId }),
          ...(data.priority && { priority: data.priority as Priority }),
          ...(data.destinationCity && { destinationCity: data.destinationCity }),
          ...(data.originCountry && { originCountry: data.originCountry }),
          ...(data.notes !== undefined && { notes: data.notes }),
          ...(data.ownerId !== undefined && { ownerId: data.ownerId }),
          ...(data.onboardedById !== undefined && { onboardedById: data.onboardedById }),
          ...(data.logisticsCost !== undefined && { logisticsCost }),
          ...(data.insuranceAmount !== undefined && { insuranceAmount }),
          ...(data.commissionRate !== undefined && { commissionRate }),
          ...(data.budgetPlannedXAF !== undefined && { budgetPlannedXAF }),
          merchandiseTotal,
          commissionAmount,
          totalClient,
          fxRatesSnapshot: FxService.buildSnapshot(fxRates),
          fxImpactXAF,
        },
      });

      if (data.collaboratorIds) {
        await tx.orderCollaborator.deleteMany({ where: { orderId } });
        if (data.collaboratorIds.length > 0) {
          await tx.orderCollaborator.createMany({
            data: data.collaboratorIds.map((userId) => ({ orderId, userId })),
          });
        }
      }

      return order;
    });

    await OrderApprovalService.syncOrderApprovals(orderId);
    return updated;
  }

  static async duplicate(orderId: string) {
    const existing = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!existing) throw new Error("Commande introuvable");

    const orderNumber = await this.generateOrderNumber(existing.tenantId);
    const order = await prisma.order.create({
      data: {
        tenantId: existing.tenantId,
        orderNumber,
        contactId: existing.contactId,
        ownerId: existing.ownerId,
        onboardedById: existing.onboardedById,
        priority: existing.priority,
        destinationCity: existing.destinationCity,
        notes: existing.notes,
        merchandiseTotal: existing.merchandiseTotal,
        logisticsCost: existing.logisticsCost,
        commissionRate: existing.commissionRate,
        commissionAmount: existing.commissionAmount,
        insuranceAmount: existing.insuranceAmount,
        totalClient: existing.totalClient,
        currency: existing.currency,
        approvalStatus: "NOT_REQUIRED",
        originCountry: existing.originCountry,
        riskLevel: existing.riskLevel,
        budgetPlannedXAF: existing.budgetPlannedXAF,
        budgetActualXAF: existing.budgetActualXAF,
        fxRatesSnapshot: existing.fxRatesSnapshot as any,
        fxImpactXAF: existing.fxImpactXAF,
        items: {
          create: existing.items.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            currency: item.currency,
            unitPriceXAF: item.unitPriceXAF,
            totalXAF: item.totalXAF,
            hsCode: item.hsCode,
            weight: item.weight,
            volume: item.volume,
            notes: item.notes,
          })),
        },
        timeline: {
          create: {
            event: "order_created",
            toValue: "DEMANDE",
            note: "Commande dupliquée",
          },
        },
      },
    });
    return order;
  }

  static async archive(orderId: string) {
    return prisma.order.update({
      where: { id: orderId },
      data: OrderService.hasArchivedAtField() ? { archivedAt: new Date() } : {},
    });
  }

  static async restore(orderId: string) {
    return prisma.order.update({
      where: { id: orderId },
      data: OrderService.hasArchivedAtField() ? { archivedAt: null } : {},
    });
  }

  static async deleteOrder(orderId: string) {
    return prisma.order.delete({ where: { id: orderId } });
  }

  static async updateStatus(
    orderId: string,
    newStatus: OrderStatus,
    userId?: string,
    note?: string
  ) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        tenantId: true,
        orderNumber: true,
        contactId: true,
        status: true,
        approvalStatus: true,
        priority: true,
        riskLevel: true,
        estimatedDelivery: true,
        currency: true,
        totalClient: true,
        marginReport: { select: { id: true } },
      },
    });

    if (!order) throw new Error("Commande introuvable");
    if (["PENDING", "REJECTED"].includes(order.approvalStatus as any) && !["DEMANDE", "DEVIS"].includes(newStatus)) {
      throw new Error("Commande en attente d'approbation");
    }
    if (!canTransition(order.status, newStatus)) {
      throw new Error(
        `Transition impossible: ${order.status} -> ${newStatus}`
      );
    }

    if (newStatus === "CLOTURE" && !order.marginReport) {
      await this.recalculateMarginFromFinance(orderId).catch(() => null);
    }

    const transitionContext = await this.loadTransitionContext(orderId);
    if (!transitionContext) throw new Error("Commande introuvable");
    const blockers = this.collectTransitionBlockers(transitionContext, newStatus);
    if (blockers.length > 0) {
      throw new Error(blockers.join(" "));
    }

    // Compute new risk level based on incoming status
    const riskResult = RiskCalculatorService.computeLight({
      status: newStatus,
      priority: order.priority as string,
      riskLevel: order.riskLevel as string,
      estimatedDelivery: order.estimatedDelivery ?? null,
    });

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: newStatus,
        riskLevel: riskResult.level as any,
        ...(newStatus === "LIVRE" && { actualDelivery: new Date() }),
        timeline: {
          create: {
            event: "status_changed",
            fromValue: order.status,
            toValue: newStatus,
            note: note || `Statut change: ${order.status} -> ${newStatus}`,
            userId,
          },
        },
      },
      include: { contact: true, timeline: { orderBy: { createdAt: "desc" }, take: 1 } },
    });

    if (newStatus === "LIVRE") {
      const existingInvoice = await prisma.invoice.findFirst({
        where: { orderId },
        select: { id: true },
      });
      if (!existingInvoice) {
        const year = new Date().getFullYear();
        const prefix = `INV-${year}-`;
        const last = await prisma.invoice.findFirst({
          where: { tenantId: order.tenantId, invoiceNumber: { startsWith: prefix } },
          orderBy: { invoiceNumber: "desc" },
          select: { invoiceNumber: true },
        });
        const lastNum = last ? parseInt(last.invoiceNumber.split("-")[2] || "0") : 0;
        const nextNum = String(lastNum + 1).padStart(5, "0");
        const invoiceNumber = `${prefix}${nextNum}`;

        await InvoiceService.create({
          tenantId: order.tenantId,
          direction: "AR",
          invoiceNumber,
          contactId: order.contactId,
          orderId: order.id,
          currency: order.currency || "XAF",
          issuedAt: new Date(),
          notes: `Facture automatique - livraison ${order.orderNumber}`,
          lines: [
            {
              description: `Commande ${order.orderNumber}`,
              quantity: 1,
              unitPrice: Number(order.totalClient),
            },
          ],
        });
      }

      try {
        await CatalogMemoryService.recordDeliveredOrder(orderId);
      } catch (error) {
        console.error("Catalog memory sync failed:", error);
      }
    }

    await emitEvent("order.status_changed", "order", orderId, {
      previousStatus: order.status,
      newStatus,
      userId,
    });

    return updated;
  }

  static async getStatusCounts(tenantId: string, scopeWhere?: Prisma.OrderWhereInput) {
    const counts = await prisma.order.groupBy({
      by: ["status"],
      where: {
        tenantId,
        ...(OrderService.hasArchivedAtField() ? { archivedAt: null } : {}),
        ...(scopeWhere || {}),
      },
      _count: { id: true },
    });

    return counts.reduce(
      (acc, item) => {
        acc[item.status] = item._count.id;
        return acc;
      },
      {} as Record<string, number>
    );
  }
}
