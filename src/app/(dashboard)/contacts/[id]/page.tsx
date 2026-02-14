import { ArrowLeft, Phone, Mail, MessageCircle, MapPin } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/status-badge";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { getContactById } from "@/lib/actions/contact.actions";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Fiche contact | Horion ERP" };

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ContactDetailPage({ params }: Props) {
  const { id } = await params;
  const result = await getContactById(id);

  if (result.error || !result.data) notFound();

  const contact = result.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/contacts"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">{contact.name}</h1>
          {contact.company && <p className="text-lg text-muted-foreground">{contact.company}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{contact.type}</Badge>
          <div className="flex items-center gap-1">
            <span className="text-sm font-medium">Score: {contact.trustScore}/100</span>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Info */}
        <Card className="md:col-span-1">
          <CardHeader><CardTitle>Coordonnées</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {contact.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                {contact.phone}
              </div>
            )}
            {contact.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                {contact.email}
              </div>
            )}
            {contact.whatsapp && (
              <div className="flex items-center gap-2 text-sm">
                <MessageCircle className="h-4 w-4 text-muted-foreground" />
                {contact.whatsapp}
              </div>
            )}
            {contact.city && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                {contact.city}, {contact.country}
              </div>
            )}
            {contact.notes && (
              <div className="pt-2 border-t">
                <p className="text-sm text-muted-foreground">{contact.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stats */}
        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Commandes ({contact._count.orders})</CardTitle>
            <Button size="sm" asChild>
              <Link href={`/orders/new?contactId=${contact.id}`}>Nouvelle commande</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {contact.orders.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune commande</p>
            ) : (
              <div className="space-y-3">
                {contact.orders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <Link href={`/orders/${order.id}`} className="font-medium text-primary hover:underline">
                        {order.orderNumber}
                      </Link>
                      <p className="text-xs text-muted-foreground">{formatDate(order.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <CurrencyDisplay amount={Number(order.totalClient)} currency="XAF" />
                      <StatusBadge status={order.status} />
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
