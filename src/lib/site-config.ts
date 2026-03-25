const rawWhatsappNumber =
  process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/\D/g, "") || "242064600831";

export const SITE_CONFIG = {
  brandName: process.env.NEXT_PUBLIC_BRAND_NAME || "Horion",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL || "servicehorion@gmail.com",
  whatsappNumberE164: rawWhatsappNumber,
  whatsappDisplay:
    process.env.NEXT_PUBLIC_WHATSAPP_DISPLAY || "+242 06 460 08 31",
};

export function getWhatsAppUrl(message?: string) {
  const base = `https://wa.me/${SITE_CONFIG.whatsappNumberE164}`;
  if (!message) return base;
  return `${base}?text=${encodeURIComponent(message)}`;
}
