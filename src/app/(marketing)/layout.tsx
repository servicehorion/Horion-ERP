import type { Metadata } from "next";

import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingNavbar } from "@/components/marketing/marketing-navbar";

export const metadata: Metadata = {
  title: {
    default: "Horion | Importation Chine -> Congo",
    template: "%s | Horion",
  },
  description:
    "Horion simplifie l'importation depuis la Chine jusqu'au Congo : sourcing, controle qualite, transport et livraison.",
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: "Horion",
    title: "Horion | Importation Chine -> Congo",
    description:
      "Sourcing, controle qualite, transport et livraison depuis la Chine jusqu'au Congo.",
  },
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-[#0B0C17] text-white">
      <MarketingNavbar />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
