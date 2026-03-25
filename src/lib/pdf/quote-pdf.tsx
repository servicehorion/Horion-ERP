import React from "react";
import { Document, Image, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";

import { loadLogoDataUri } from "@/lib/pdf/logo";
import { formatPublicMoney } from "@/lib/public-money";

export type QuotePdfItem = {
  description: string;
  category?: string | null;
  platform?: string | null;
  quantity?: number | null;
  unitPrice?: number | null;
  currency?: string | null;
  lineTotal?: number | null;
  transportLabel?: string | null;
  transportDelay?: string | null;
  transportCost?: number | null;
};

export type QuotePdfTotals = {
  merchandiseTotal: number;
  logisticsCost: number;
  commission: number;
  insuranceCost?: number | null;
  total: number;
  currency: string;
};

export type QuotePdfMeta = {
  title: string;
  quoteNumber: string;
  clientName: string;
  statusLabel: string;
  createdAt: string;
  validUntil?: string | null;
  notes?: string | null;
  items: QuotePdfItem[];
  totals: QuotePdfTotals;
  paymentLink?: string | null;
  companyEmail?: string | null;
  companyWhatsapp?: string | null;
};

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#111827",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  logo: {
    width: 120,
    height: 24,
    objectFit: "contain",
  },
  brandText: {
    fontSize: 16,
    fontWeight: 700,
    letterSpacing: 1,
  },
  infoGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  infoCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    padding: 10,
  },
  infoCardTitle: {
    fontSize: 9,
    color: "#6B7280",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  metaLabel: {
    color: "#6B7280",
  },
  metaValue: {
    fontWeight: 600,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    marginTop: 12,
    marginBottom: 6,
    textTransform: "uppercase",
    color: "#111827",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#F3F4F6",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#E5E7EB",
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: "#E5E7EB",
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  colDescription: { flex: 4 },
  colQty: { flex: 1, textAlign: "right" },
  colUnit: { flex: 2, textAlign: "right" },
  colTransport: { flex: 3 },
  colTotal: { flex: 2, textAlign: "right", fontWeight: 600 },
  totalsBlock: {
    marginTop: 10,
    marginLeft: "auto",
    width: 240,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  totalLabel: { color: "#374151" },
  totalValue: { fontWeight: 700 },
  footer: {
    marginTop: 18,
    color: "#6B7280",
    fontSize: 9,
  },
  link: {
    color: "#2563EB",
  },
});

function formatMoney(amount: number, currency: string): string {
  return formatPublicMoney(amount, currency);
}

function renderTransport(item: QuotePdfItem) {
  const label = item.transportLabel || "-";
  const delay = item.transportDelay ? ` (${item.transportDelay})` : "";
  return `${label}${delay}`;
}

function buildTransportSummary(items: QuotePdfItem[]) {
  const summary = new Map<string, { label: string; delay: string; amount: number }>();
  for (const item of items) {
    const label = item.transportLabel || "-";
    const delay = item.transportDelay || "Selon disponibilite";
    const key = `${label}::${delay}`;
    const current = summary.get(key) || { label, delay, amount: 0 };
    current.amount += Number(item.transportCost || 0);
    summary.set(key, current);
  }
  return Array.from(summary.values()).filter((row) => row.amount > 0);
}

function QuotePdfDocument({ meta, logoDataUri }: { meta: QuotePdfMeta; logoDataUri?: string | null }) {
  const transportSummary = buildTransportSummary(meta.items);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          {logoDataUri ? (
            <Image src={logoDataUri} style={styles.logo} />
          ) : (
            <Text style={styles.brandText}>HORION</Text>
          )}
          <Text>{meta.title}</Text>
        </View>

        <View style={styles.infoGrid}>
          <View style={styles.infoCard}>
            <Text style={styles.infoCardTitle}>Horion</Text>
            <Text>Nous rendons l'import simple & sans tracas.</Text>
            <Text>{meta.companyEmail || "servicehorion@gmail.com"}</Text>
            <Text>{meta.companyWhatsapp || "+242 06 460 08 31"}</Text>
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.infoCardTitle}>Devis</Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Numero</Text>
              <Text style={styles.metaValue}>{meta.quoteNumber}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Client</Text>
              <Text style={styles.metaValue}>{meta.clientName}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Date</Text>
              <Text>{meta.createdAt}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Statut</Text>
              <Text>{meta.statusLabel}</Text>
            </View>
            {meta.validUntil ? (
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Validite</Text>
                <Text>{meta.validUntil}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <Text style={styles.sectionTitle}>Details des articles</Text>
        <View style={styles.tableHeader}>
          <Text style={styles.colDescription}>Article</Text>
          <Text style={styles.colQty}>Qte</Text>
          <Text style={styles.colUnit}>Prix Horion</Text>
          <Text style={styles.colTransport}>Transport retenu</Text>
          <Text style={styles.colTotal}>Sous-total</Text>
        </View>
        {meta.items.length === 0 ? (
          <View style={styles.tableRow}>
            <Text style={styles.colDescription}>Details indisponibles pour ce devis.</Text>
            <Text style={styles.colQty}></Text>
            <Text style={styles.colUnit}></Text>
            <Text style={styles.colTransport}></Text>
            <Text style={styles.colTotal}></Text>
          </View>
        ) : (
          meta.items.map((item, index) => (
            <View key={`${item.description}-${index}`} style={styles.tableRow}>
              <Text style={styles.colDescription}>
                {item.description}
                {item.category ? `\nCategorie: ${item.category}` : ""}
              </Text>
              <Text style={styles.colQty}>{item.quantity ?? "-"}</Text>
              <Text style={styles.colUnit}>
                {item.unitPrice != null
                  ? formatMoney(item.unitPrice, item.currency || meta.totals.currency)
                  : "-"}
              </Text>
              <Text style={styles.colTransport}>{renderTransport(item)}</Text>
              <Text style={styles.colTotal}>
                {item.lineTotal != null
                  ? formatMoney(item.lineTotal, meta.totals.currency)
                  : "-"}
              </Text>
            </View>
          ))
        )}

        {transportSummary.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>Transport retenu</Text>
            <View style={styles.tableHeader}>
              <Text style={styles.colDescription}>Mode</Text>
              <Text style={styles.colQty}></Text>
              <Text style={styles.colUnit}></Text>
              <Text style={styles.colTransport}>Delai</Text>
              <Text style={styles.colTotal}>Montant</Text>
            </View>
            {transportSummary.map((row, index) => (
              <View key={`${row.label}-${index}`} style={styles.tableRow}>
                <Text style={styles.colDescription}>{row.label}</Text>
                <Text style={styles.colQty}></Text>
                <Text style={styles.colUnit}></Text>
                <Text style={styles.colTransport}>{row.delay}</Text>
                <Text style={styles.colTotal}>{formatMoney(row.amount, meta.totals.currency)}</Text>
              </View>
            ))}
          </>
        ) : null}

        <View style={styles.totalsBlock}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Prix Horion produits</Text>
            <Text style={styles.totalValue}>
              {formatMoney(meta.totals.merchandiseTotal, meta.totals.currency)}
            </Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Transport</Text>
            <Text style={styles.totalValue}>
              {formatMoney(meta.totals.logisticsCost, meta.totals.currency)}
            </Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Accompagnement Horion</Text>
            <Text style={styles.totalValue}>
              {formatMoney(meta.totals.commission, meta.totals.currency)}
            </Text>
          </View>
          {meta.totals.insuranceCost ? (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Assurance</Text>
              <Text style={styles.totalValue}>
                {formatMoney(meta.totals.insuranceCost, meta.totals.currency)}
              </Text>
            </View>
          ) : null}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>
              {formatMoney(meta.totals.total, meta.totals.currency)}
            </Text>
          </View>
        </View>

        <Text style={styles.footer}>
          Ce devis est valable jusqu'a la date indiquee. Pour toute question, contactez Horion par email ou WhatsApp.
        </Text>
        <Text style={styles.footer}>
          Paiement possible via MTN Mobile Money, Airtel Money, virement bancaire ou depot bancaire assiste Horion.
        </Text>
        {meta.paymentLink ? (
          <Text style={[styles.footer, styles.link]}>Lien de paiement: {meta.paymentLink}</Text>
        ) : null}
      </Page>
    </Document>
  );
}

export async function renderQuotePdf(meta: QuotePdfMeta): Promise<Buffer> {
  const logoDataUri = await loadLogoDataUri();
  const instance = pdf(<QuotePdfDocument meta={meta} logoDataUri={logoDataUri} />);
  const stream = await instance.toBuffer();
  const chunks: Buffer[] = [];

  for await (const chunk of stream as AsyncIterable<Uint8Array | string>) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}
