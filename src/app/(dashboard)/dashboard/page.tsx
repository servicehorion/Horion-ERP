import { Package, DollarSign, TrendingUp, CheckSquare, Clock, AlertCircle } from "lucide-react";
import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { formatCurrency } from "@/config/currencies";
import { formatDate } from "@/lib/utils";
import { ORDER_STATUS_LABELS } from "@/config/order-statuses";

export const metadata = {
  title: "Pilotage | Horion ERP",
  description: "Vue d'ensemble des opérations Horion",
};

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user?.tenantId) {
    redirect("/login");
  }

  const tenantId = session.user.tenantId;

  // Fetch KPIs in parallel
  const [
    activeOrdersCount,
    ordersByStatus,
    monthlyRevenue,
    pendingTasks,
    slaBreachedTasks,
    recentOrders,
  ] = await Promise.all([
    // Active orders count
    prisma.order.count({
      where: {
        tenantId,
        status: {
          notIn: ["LIVRE", "ANNULE"],
        },
      },
    }),

    // Orders by status
    prisma.order.groupBy({
      by: ["status"],
      where: {
        tenantId,
        status: {
          notIn: ["ANNULE"],
        },
      },
      _count: {
        status: true,
      },
    }),

    // Monthly revenue (delivered orders)
    prisma.order.aggregate({
      where: {
        tenantId,
        status: "LIVRE",
        createdAt: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
      },
      _sum: {
        totalClient: true,
      },
    }),

    // Pending tasks
    prisma.task.count({
      where: {
        tenantId,
        status: {
          in: ["PENDING", "IN_PROGRESS"],
        },
      },
    }),

    // SLA breached tasks
    prisma.task.count({
      where: {
        tenantId,
        status: {
          notIn: ["COMPLETED", "CANCELLED"],
        },
      },
    }),

    // Recent orders
    prisma.order.findMany({
      where: {
        tenantId,
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        contact: {
          select: {
            name: true,
          },
        },
        totalClient: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 5,
    }),
  ]);

  const revenue = Number(monthlyRevenue._sum?.totalClient || 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Pilotage</h1>
        <p className="text-muted-foreground">
          Vue d'ensemble des opérations Horion
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Commandes actives
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeOrdersCount}</div>
            <p className="text-xs text-muted-foreground">
              En cours de traitement
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CA du mois</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(revenue, "XAF")}
            </div>
            <p className="text-xs text-muted-foreground">
              Commandes livrées MTD
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Tâches en attente
            </CardTitle>
            <CheckSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingTasks}</div>
            <p className="text-xs text-muted-foreground">À traiter</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">SLA en retard</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {slaBreachedTasks}
            </div>
            <p className="text-xs text-muted-foreground">Tâches en retard</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Pipeline */}
        <Card>
          <CardHeader>
            <CardTitle>Pipeline commandes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {ordersByStatus.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucune commande active
              </p>
            ) : (
              ordersByStatus.map((item) => {
                const label = ORDER_STATUS_LABELS[item.status] || item.status;
                const count = item._count.status;

                return (
                  <div key={item.status} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-primary" />
                      <span className="text-sm">{label}</span>
                    </div>
                    <Badge variant="secondary">{count}</Badge>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Activité récente</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/orders">Voir tout</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucune commande récente
              </p>
            ) : (
              <div className="space-y-4">
                {recentOrders.map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between"
                  >
                    <div className="space-y-1">
                      <Link
                        href={`/orders/${order.id}`}
                        className="text-sm font-medium hover:underline"
                      >
                        {order.orderNumber}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {order.contact.name} • {formatDate(order.createdAt)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        {formatCurrency(Number(order.totalClient), "XAF")}
                      </p>
                      <Badge variant="secondary" className="text-xs">
                        {ORDER_STATUS_LABELS[order.status] || order.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
