"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge, PriorityBadge } from "@/components/shared/status-badge";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { OrderTimeline } from "./order-timeline";
import { updateOrderStatus } from "@/lib/actions/order.actions";
import { ORDER_STATUSES } from "@/config/order-statuses";
import { formatDate } from "@/lib/utils";
import { Loader2 } from "lucide-react";

type OrderDetailProps = {
  order: {
    id: string;
    orderNumber: string;
    status: string;
    priority: string;
    destinationCity: string;
    notes: string | null;
    totalClient: any;
    createdAt: Date;
    contact: {
      name: string;
      email: string | null;
      phone: string | null;
    };
    items: {
      id: string;
      description: string;
      quantity: number;
      unitPrice: any;
      currency: string;
      totalXAF: any;
    }[];
    timeline: {
      id: string;
      event: string;
      fromValue: string | null;
      toValue: string | null;
      note: string | null;
      userId: string | null;
      createdAt: Date;
    }[];
    tasks: {
      id: string;
      title: string;
      status: string;
      slaDeadline: Date | null;
      assignments: { user: { name: string } }[];
    }[];
    quotes: {
      id: string;
      merchandiseTotal: any;
      currency: string;
      createdAt: Date;
    }[];
  };
};

export function OrderDetail({ order }: OrderDetailProps) {
  const router = useRouter();
  const [isUpdating, setIsUpdating] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState(order.status);

  async function handleStatusChange(newStatus: string) {
    if (newStatus === order.status) return;

    setIsUpdating(true);
    try {
      const result = await updateOrderStatus(order.id, newStatus);

      if (result.error) {
        toast.error(result.error);
        setSelectedStatus(order.status);
        return;
      }

      toast.success("Statut mis à jour");
      router.refresh();
    } catch (error) {
      toast.error("Une erreur est survenue");
      setSelectedStatus(order.status);
      console.error(error);
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">{order.orderNumber}</h1>
          <p className="text-muted-foreground">
            Créée le {formatDate(order.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <StatusBadge status={order.status} />
          <PriorityBadge priority={order.priority} />
        </div>
      </div>

      {/* Status change */}
      <Card>
        <CardHeader>
          <CardTitle>Changer le statut</CardTitle>
          <CardDescription>
            Mettre à jour l'état de la commande
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Select
              value={selectedStatus}
              onValueChange={setSelectedStatus}
              disabled={isUpdating}
            >
              <SelectTrigger className="w-[280px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ORDER_STATUSES.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={() => handleStatusChange(selectedStatus)}
              disabled={isUpdating || selectedStatus === order.status}
            >
              {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Mettre à jour
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="resume" className="space-y-6">
        <TabsList>
          <TabsTrigger value="resume">Résumé</TabsTrigger>
          <TabsTrigger value="items">Articles ({order.items.length})</TabsTrigger>
          <TabsTrigger value="quotes">Devis ({order.quotes.length})</TabsTrigger>
          <TabsTrigger value="timeline">Timeline ({order.timeline.length})</TabsTrigger>
          <TabsTrigger value="tasks">Tâches ({order.tasks.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="resume" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Informations client</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <p className="text-sm font-medium">Nom</p>
                  <p className="text-sm text-muted-foreground">{order.contact.name}</p>
                </div>
                {order.contact.email && (
                  <div>
                    <p className="text-sm font-medium">Email</p>
                    <p className="text-sm text-muted-foreground">
                      {order.contact.email}
                    </p>
                  </div>
                )}
                {order.contact.phone && (
                  <div>
                    <p className="text-sm font-medium">Téléphone</p>
                    <p className="text-sm text-muted-foreground">
                      {order.contact.phone}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Détails commande</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <p className="text-sm font-medium">Montant total</p>
                  <p className="text-2xl font-bold">
                    <CurrencyDisplay
                      amount={Number(order.totalClient)}
                      currency="XAF"
                    />
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium">Ville de destination</p>
                  <p className="text-sm text-muted-foreground">
                    {order.destinationCity}
                  </p>
                </div>
                {order.notes && (
                  <div>
                    <p className="text-sm font-medium">Notes</p>
                    <p className="text-sm text-muted-foreground">{order.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="items">
          <Card>
            <CardHeader>
              <CardTitle>Articles commandés</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead>Quantité</TableHead>
                    <TableHead>Prix unitaire</TableHead>
                    <TableHead>Devise</TableHead>
                    <TableHead className="text-right">Total (XAF)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.description}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>
                        <CurrencyDisplay
                          amount={Number(item.unitPrice)}
                          currency={item.currency}
                        />
                      </TableCell>
                      <TableCell>{item.currency}</TableCell>
                      <TableCell className="text-right">
                        <CurrencyDisplay
                          amount={Number(item.totalXAF)}
                          currency="XAF"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quotes">
          <Card>
            <CardHeader>
              <CardTitle>Devis</CardTitle>
            </CardHeader>
            <CardContent>
              {order.quotes.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun devis pour le moment</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Montant marchandise</TableHead>
                      <TableHead>Devise</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {order.quotes.map((quote) => (
                      <TableRow key={quote.id}>
                        <TableCell>
                          <CurrencyDisplay
                            amount={Number(quote.merchandiseTotal)}
                            currency={quote.currency}
                          />
                        </TableCell>
                        <TableCell>{quote.currency}</TableCell>
                        <TableCell>{formatDate(quote.createdAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeline">
          <Card>
            <CardHeader>
              <CardTitle>Historique</CardTitle>
            </CardHeader>
            <CardContent>
              <OrderTimeline entries={order.timeline} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tasks">
          <Card>
            <CardHeader>
              <CardTitle>Tâches liées</CardTitle>
            </CardHeader>
            <CardContent>
              {order.tasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune tâche pour le moment</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Titre</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Assignée à</TableHead>
                      <TableHead>Échéance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {order.tasks.map((task) => (
                      <TableRow key={task.id}>
                        <TableCell className="font-medium">{task.title}</TableCell>
                        <TableCell>
                          <StatusBadge status={task.status} />
                        </TableCell>
                        <TableCell>
                          {task.assignments?.[0]?.user?.name || "Non assignée"}
                        </TableCell>
                        <TableCell>
                          {task.slaDeadline ? formatDate(task.slaDeadline, true) : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
