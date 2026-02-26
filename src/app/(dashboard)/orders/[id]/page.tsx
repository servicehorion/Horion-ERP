import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { OrderDetail } from "@/components/orders/order-detail";
import { getOrderById } from "@/lib/actions/order.actions";
import { serializeDecimals } from "@/lib/utils";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

export const metadata = {
  title: "Détail commande | Horion ERP",
};

interface OrderDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.tenantId) {
    redirect("/login");
  }

  const result = await getOrderById(id);

  if (result.error || !result.data) {
    notFound();
  }

  const order = serializeDecimals(result.data);
  const canUpdateStatus = hasPermission(session.user.role, "order.update_status");
  const canEdit = hasPermission(session.user.role, "order.update");
  const canArchive = hasPermission(session.user.role, "order.delete");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/orders">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      <OrderDetail
        order={order}
        canUpdateStatus={canUpdateStatus}
        canEdit={canEdit}
        canArchive={canArchive}
      />
    </div>
  );
}
