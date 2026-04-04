import React from "react";
import { Document, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";

export type PurchaseOrderItem = {
  productName: string;
  productNameCn?: string | null;
  sku?: string | null;
  quantity: number;
  unitPrice: number;
  currency: string;
  lineTotal: number;
  specifications?: string | null;
};

export type PurchaseOrderMeta = {
  poNumber: string;
  orderDate: string;
  deliveryDeadline?: string | null;
  // Buyer (Horion)
  buyerName: string;
  buyerAddress?: string | null;
  buyerEmail?: string | null;
  buyerPhone?: string | null;
  // Supplier
  supplierName: string;
  supplierNameCn?: string | null;
  supplierContact?: string | null;
  supplierEmail?: string | null;
  supplierWechat?: string | null;
  supplierAlibaba?: string | null;
  // Items
  items: PurchaseOrderItem[];
  // Totals
  subtotal: number;
  shippingCost?: number | null;
  total: number;
  currency: string;
  // Payment terms
  paymentTerms?: string | null;
  incoterms?: string | null;
  notes?: string | null;
};

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: "#111827",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: "#1e40af",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 10,
    color: "#6b7280",
  },
  poMeta: {
    alignItems: "flex-end",
  },
  poMetaLine: {
    fontSize: 9,
    color: "#374151",
    marginBottom: 2,
  },
  bold: {
    fontFamily: "Helvetica-Bold",
  },
  section: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
    borderBottom: "1pt solid #e5e7eb",
    paddingBottom: 2,
  },
  partyGrid: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 12,
  },
  partyBox: {
    flex: 1,
    borderRadius: 4,
    border: "1pt solid #e5e7eb",
    padding: 8,
  },
  partyLabel: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#6b7280",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  partyName: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    marginBottom: 2,
  },
  partyLine: {
    fontSize: 9,
    color: "#374151",
    marginBottom: 1,
  },
  table: {
    marginBottom: 12,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#1e40af",
    padding: "5 6",
    borderRadius: "2 2 0 0",
  },
  tableRow: {
    flexDirection: "row",
    borderBottom: "1pt solid #f3f4f6",
    padding: "4 6",
  },
  tableRowAlt: {
    flexDirection: "row",
    borderBottom: "1pt solid #f3f4f6",
    padding: "4 6",
    backgroundColor: "#f9fafb",
  },
  th: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#ffffff",
  },
  td: {
    fontSize: 9,
    color: "#374151",
  },
  colProduct: { flex: 3 },
  colSku: { flex: 1.2 },
  colQty: { flex: 0.8, textAlign: "right" },
  colUnit: { flex: 1.2, textAlign: "right" },
  colTotal: { flex: 1.2, textAlign: "right" },
  totalsBox: {
    alignItems: "flex-end",
    marginBottom: 12,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 2,
  },
  totalLabel: {
    fontSize: 9,
    color: "#6b7280",
    width: 100,
    textAlign: "right",
    marginRight: 8,
  },
  totalValue: {
    fontSize: 9,
    color: "#374151",
    width: 80,
    textAlign: "right",
  },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 4,
    borderTop: "1pt solid #1e40af",
    paddingTop: 4,
  },
  grandTotalLabel: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#1e40af",
    width: 100,
    textAlign: "right",
    marginRight: 8,
  },
  grandTotalValue: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#1e40af",
    width: 80,
    textAlign: "right",
  },
  termsBox: {
    borderRadius: 4,
    backgroundColor: "#eff6ff",
    border: "1pt solid #bfdbfe",
    padding: 8,
    marginBottom: 12,
  },
  termsTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#1e40af",
    marginBottom: 4,
  },
  termsText: {
    fontSize: 8,
    color: "#1e40af",
    lineHeight: 1.4,
  },
  footer: {
    borderTop: "1pt solid #e5e7eb",
    paddingTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerText: {
    fontSize: 8,
    color: "#9ca3af",
  },
  signatureBox: {
    flexDirection: "row",
    gap: 20,
    marginTop: 20,
  },
  signatureField: {
    flex: 1,
    borderTop: "1pt solid #374151",
    paddingTop: 4,
  },
  signatureLabel: {
    fontSize: 8,
    color: "#6b7280",
  },
});

function formatMoney(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function PurchaseOrderDocument({ meta }: { meta: PurchaseOrderMeta }) {
  return (
    <Document title={`Bon de Commande ${meta.poNumber}`}>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>BON DE COMMANDE</Text>
            <Text style={styles.subtitle}>PURCHASE ORDER / 采购订单</Text>
          </View>
          <View style={styles.poMeta}>
            <Text style={[styles.poMetaLine, styles.bold]}>N° {meta.poNumber}</Text>
            <Text style={styles.poMetaLine}>Date : {meta.orderDate}</Text>
            {meta.deliveryDeadline && (
              <Text style={styles.poMetaLine}>Livraison souhaitée : {meta.deliveryDeadline}</Text>
            )}
            {meta.incoterms && (
              <Text style={styles.poMetaLine}>Incoterms : {meta.incoterms}</Text>
            )}
          </View>
        </View>

        {/* Parties */}
        <View style={styles.partyGrid}>
          <View style={styles.partyBox}>
            <Text style={styles.partyLabel}>Acheteur / Buyer</Text>
            <Text style={styles.partyName}>{meta.buyerName}</Text>
            {meta.buyerAddress && <Text style={styles.partyLine}>{meta.buyerAddress}</Text>}
            {meta.buyerEmail && <Text style={styles.partyLine}>✉ {meta.buyerEmail}</Text>}
            {meta.buyerPhone && <Text style={styles.partyLine}>☎ {meta.buyerPhone}</Text>}
          </View>
          <View style={styles.partyBox}>
            <Text style={styles.partyLabel}>Fournisseur / Supplier / 供应商</Text>
            <Text style={styles.partyName}>{meta.supplierName}</Text>
            {meta.supplierNameCn && <Text style={styles.partyLine}>{meta.supplierNameCn}</Text>}
            {meta.supplierContact && <Text style={styles.partyLine}>联系人 : {meta.supplierContact}</Text>}
            {meta.supplierEmail && <Text style={styles.partyLine}>✉ {meta.supplierEmail}</Text>}
            {meta.supplierWechat && <Text style={styles.partyLine}>WeChat : {meta.supplierWechat}</Text>}
            {meta.supplierAlibaba && <Text style={styles.partyLine}>Alibaba : {meta.supplierAlibaba}</Text>}
          </View>
        </View>

        {/* Items table */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Articles commandés / Ordered Items / 订购商品</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.th, styles.colProduct]}>Produit / Product / 产品</Text>
              <Text style={[styles.th, styles.colSku]}>SKU / Réf.</Text>
              <Text style={[styles.th, styles.colQty]}>Qté</Text>
              <Text style={[styles.th, styles.colUnit]}>Prix unit.</Text>
              <Text style={[styles.th, styles.colTotal]}>Total</Text>
            </View>
            {meta.items.map((item, i) => (
              <View key={i} style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                <View style={styles.colProduct}>
                  <Text style={styles.td}>{item.productName}</Text>
                  {item.productNameCn && <Text style={[styles.td, { color: "#6b7280", fontSize: 8 }]}>{item.productNameCn}</Text>}
                  {item.specifications && <Text style={[styles.td, { color: "#9ca3af", fontSize: 7.5 }]}>{item.specifications}</Text>}
                </View>
                <Text style={[styles.td, styles.colSku]}>{item.sku ?? "—"}</Text>
                <Text style={[styles.td, styles.colQty]}>{item.quantity}</Text>
                <Text style={[styles.td, styles.colUnit]}>{formatMoney(item.unitPrice, item.currency)}</Text>
                <Text style={[styles.td, styles.colTotal]}>{formatMoney(item.lineTotal, item.currency)}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Totals */}
        <View style={styles.totalsBox}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Sous-total</Text>
            <Text style={styles.totalValue}>{formatMoney(meta.subtotal, meta.currency)}</Text>
          </View>
          {meta.shippingCost != null && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Frais logistiques</Text>
              <Text style={styles.totalValue}>{formatMoney(meta.shippingCost, meta.currency)}</Text>
            </View>
          )}
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>TOTAL</Text>
            <Text style={styles.grandTotalValue}>{formatMoney(meta.total, meta.currency)}</Text>
          </View>
        </View>

        {/* Payment terms */}
        {(meta.paymentTerms || meta.notes) && (
          <View style={styles.termsBox}>
            <Text style={styles.termsTitle}>Conditions / Terms / 条款</Text>
            {meta.paymentTerms && <Text style={styles.termsText}>Paiement : {meta.paymentTerms}</Text>}
            {meta.notes && <Text style={styles.termsText}>{meta.notes}</Text>}
          </View>
        )}

        {/* Signatures */}
        <View style={styles.signatureBox}>
          <View style={styles.signatureField}>
            <Text style={styles.signatureLabel}>Signature acheteur / Buyer signature</Text>
          </View>
          <View style={styles.signatureField}>
            <Text style={styles.signatureLabel}>Signature fournisseur / Supplier signature / 供应商签名</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Horion ERP — {meta.poNumber}</Text>
          <Text style={styles.footerText}>Document généré le {new Date().toLocaleDateString("fr-FR")}</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function renderPurchaseOrderPdf(meta: PurchaseOrderMeta): Promise<Buffer> {
  const doc = <PurchaseOrderDocument meta={meta} />;
  const instance = pdf(doc);
  const blob = await instance.toBlob();
  const arrayBuffer = await blob.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
