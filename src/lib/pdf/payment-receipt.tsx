import React from "react";
import { Document, Image, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";

import { loadLogoDataUri } from "@/lib/pdf/logo";
import { formatPublicMoney } from "@/lib/public-money";

export type PaymentReceiptMeta = {
  receiptNumber: string;
  orderNumber: string;
  clientName: string;
  amount: number;
  currency: string;
  methodLabel: string;
  paidAt?: string | null;
  paymentReference?: string | null;
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
    marginBottom: 18,
  },
  logo: {
    width: 120,
    height: 24,
    objectFit: "contain",
  },
  title: {
    fontSize: 16,
    fontWeight: 700,
  },
  card: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 10,
    color: "#6B7280",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  label: {
    color: "#6B7280",
  },
  value: {
    fontWeight: 700,
  },
  total: {
    fontSize: 20,
    fontWeight: 700,
    color: "#047857",
    marginTop: 8,
  },
  footer: {
    marginTop: 14,
    color: "#6B7280",
    fontSize: 9,
    lineHeight: 1.5,
  },
});

function PaymentReceiptDocument({
  meta,
  logoDataUri,
}: {
  meta: PaymentReceiptMeta;
  logoDataUri?: string | null;
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          {logoDataUri ? <Image src={logoDataUri} style={styles.logo} /> : <Text style={styles.title}>HORION</Text>}
          <Text style={styles.title}>Reçu de paiement</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Horion</Text>
          <Text>Nous rendons l'import simple & sans tracas.</Text>
          <Text>{meta.companyEmail || "servicehorion@gmail.com"}</Text>
          <Text>{meta.companyWhatsapp || "+242 06 460 08 31"}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Détails du reçu</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Reçu</Text>
            <Text style={styles.value}>{meta.receiptNumber}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Commande</Text>
            <Text style={styles.value}>{meta.orderNumber}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Client</Text>
            <Text style={styles.value}>{meta.clientName}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Méthode</Text>
            <Text style={styles.value}>{meta.methodLabel}</Text>
          </View>
          {meta.paymentReference ? (
            <View style={styles.row}>
              <Text style={styles.label}>Référence</Text>
              <Text style={styles.value}>{meta.paymentReference}</Text>
            </View>
          ) : null}
          {meta.paidAt ? (
            <View style={styles.row}>
              <Text style={styles.label}>Payé le</Text>
              <Text style={styles.value}>{meta.paidAt}</Text>
            </View>
          ) : null}

          <Text style={styles.total}>{formatPublicMoney(meta.amount, meta.currency)}</Text>
        </View>

        <Text style={styles.footer}>
          Ce reçu confirme la bonne réception et validation de votre paiement par Horion.
        </Text>
        <Text style={styles.footer}>
          Pour toute question relative à votre commande, contactez notre équipe via WhatsApp ou email.
        </Text>
      </Page>
    </Document>
  );
}

export async function renderPaymentReceiptPdf(meta: PaymentReceiptMeta): Promise<Buffer> {
  const logoDataUri = await loadLogoDataUri();
  const instance = pdf(<PaymentReceiptDocument meta={meta} logoDataUri={logoDataUri} />);
  const stream = await instance.toBuffer();
  const chunks: Buffer[] = [];

  for await (const chunk of stream as AsyncIterable<Uint8Array | string>) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}
