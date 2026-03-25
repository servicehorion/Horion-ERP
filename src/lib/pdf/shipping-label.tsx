import React from "react";
import { Document, Image, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";

import { loadLogoDataUri } from "@/lib/pdf/logo";

export type ShippingLabelData = {
  orderNumber: string;
  clientName: string;
  clientPhone?: string | null;
  destination: string;        // ex: "Brazzaville, Congo"
  origin: string;             // ex: "Guangzhou, Chine"
  weightKg?: number | null;   // chargeable weight (interne, jamais imprimé au client)
  dimensions?: string | null; // ex: "30×20×15 cm" (interne)
  items: string;              // résumé des produits
  qrDataUrl?: string | null;  // QR code pré-généré (data URI PNG)
  createdAt: string;          // ISO string
};

const styles = StyleSheet.create({
  page: {
    padding: 24,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#111827",
    backgroundColor: "#FFFFFF",
  },
  // Top band
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: "#000000",
    marginBottom: 12,
  },
  logo: {
    width: 80,
    height: 28,
    objectFit: "contain",
  },
  headerRight: {
    alignItems: "flex-end",
  },
  labelType: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: "#6B7280",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  orderNumber: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
    letterSpacing: 1,
  },
  // Route block
  routeBlock: {
    flexDirection: "row",
    gap: 0,
    marginBottom: 12,
  },
  routeBox: {
    flex: 1,
    padding: 8,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 4,
  },
  routeLabel: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: "#6B7280",
    letterSpacing: 1,
    marginBottom: 3,
    textTransform: "uppercase",
  },
  routeValue: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
  },
  routeArrow: {
    alignSelf: "center",
    width: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  arrow: {
    fontSize: 16,
    color: "#9CA3AF",
  },
  // Client block
  clientBlock: {
    padding: 10,
    borderWidth: 1.5,
    borderColor: "#000000",
    borderRadius: 4,
    marginBottom: 12,
  },
  clientLabel: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1,
    color: "#6B7280",
    marginBottom: 4,
    textTransform: "uppercase",
  },
  clientName: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
    marginBottom: 2,
  },
  clientPhone: {
    fontSize: 10,
    color: "#374151",
  },
  // Items
  itemsBlock: {
    padding: 8,
    backgroundColor: "#F3F4F6",
    borderRadius: 4,
    marginBottom: 12,
  },
  itemsLabel: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: "#6B7280",
    letterSpacing: 1,
    marginBottom: 3,
    textTransform: "uppercase",
  },
  itemsText: {
    fontSize: 9,
    color: "#374151",
    lineHeight: 1.4,
  },
  // Bottom: QR + footer
  bottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: 4,
  },
  qrBox: {
    width: 72,
    height: 72,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  qrImage: {
    width: 68,
    height: 68,
  },
  qrPlaceholder: {
    fontSize: 7,
    color: "#9CA3AF",
    textAlign: "center",
    padding: 4,
  },
  footerBlock: {
    flex: 1,
    paddingLeft: 12,
  },
  footerLine: {
    fontSize: 7,
    color: "#6B7280",
    marginBottom: 2,
  },
  footerBold: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
  },
  watermark: {
    fontSize: 7,
    color: "#D1D5DB",
    marginTop: 6,
    textAlign: "center",
  },
});

function ShippingLabelDoc({
  data,
  logoUri,
}: {
  data: ShippingLabelData;
  logoUri: string | null;
}) {
  const createdDate = new Date(data.createdAt).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return (
    <Document>
      <Page size={[340, 480]} style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          {logoUri ? (
            <Image src={logoUri} style={styles.logo} />
          ) : (
            <Text style={{ fontSize: 14, fontFamily: "Helvetica-Bold" }}>HORION</Text>
          )}
          <View style={styles.headerRight}>
            <Text style={styles.labelType}>Étiquette d'expédition</Text>
            <Text style={styles.orderNumber}>#{data.orderNumber}</Text>
          </View>
        </View>

        {/* Route */}
        <View style={styles.routeBlock}>
          <View style={styles.routeBox}>
            <Text style={styles.routeLabel}>Origine</Text>
            <Text style={styles.routeValue}>{data.origin}</Text>
          </View>
          <View style={styles.routeArrow}>
            <Text style={styles.arrow}>→</Text>
          </View>
          <View style={styles.routeBox}>
            <Text style={styles.routeLabel}>Destination</Text>
            <Text style={styles.routeValue}>{data.destination}</Text>
          </View>
        </View>

        {/* Client */}
        <View style={styles.clientBlock}>
          <Text style={styles.clientLabel}>Destinataire</Text>
          <Text style={styles.clientName}>{data.clientName}</Text>
          {data.clientPhone && (
            <Text style={styles.clientPhone}>{data.clientPhone}</Text>
          )}
        </View>

        {/* Items summary */}
        <View style={styles.itemsBlock}>
          <Text style={styles.itemsLabel}>Contenu déclaré</Text>
          <Text style={styles.itemsText}>{data.items}</Text>
        </View>

        {/* Bottom: QR + Footer */}
        <View style={styles.bottomRow}>
          <View style={styles.qrBox}>
            {data.qrDataUrl ? (
              <Image src={data.qrDataUrl} style={styles.qrImage} />
            ) : (
              <Text style={styles.qrPlaceholder}>
                {"█ ▀ ▄\n▀ █ ▀\n▄ ▀ █"}
                {"\n\n"}
                {data.orderNumber}
              </Text>
            )}
          </View>
          <View style={styles.footerBlock}>
            <Text style={styles.footerLine}>Émis le {createdDate}</Text>
            <Text style={styles.footerLine}>
              Réf interne :{" "}
              <Text style={styles.footerBold}>{data.orderNumber}</Text>
            </Text>
            <Text style={styles.footerLine}>
              {"Collez cette étiquette sur chaque colis.\nLe code QR permet l'identification rapide en entrepôt."}
            </Text>
          </View>
        </View>

        <Text style={styles.watermark}>
          Horion • Intermédiaire d'achat & logistique • Brazzaville, Congo
        </Text>
      </Page>
    </Document>
  );
}

export async function generateShippingLabelPdf(data: ShippingLabelData): Promise<Buffer> {
  const logoUri = await loadLogoDataUri();
  const doc = <ShippingLabelDoc data={data} logoUri={logoUri} />;
  const instance = pdf(doc);
  const blob = await instance.toBlob();
  const arrayBuffer = await blob.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
