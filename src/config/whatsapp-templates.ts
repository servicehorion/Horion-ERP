export interface WhatsAppTemplate {
  id: string;
  name: string;
  category: "prospection" | "relance" | "logistique" | "facturation" | "autre";
  body: string;
}

/**
 * Variables disponibles :
 *  {nom}       — nom du contact
 *  {entreprise} — entreprise du contact
 *  {produit}   — produit / service mentionné
 *  {montant}   — montant / valeur
 *  {ordreId}   — numéro de commande
 *  {agent}     — nom de l'agent Horion
 */
export const WHATSAPP_TEMPLATES: WhatsAppTemplate[] = [
  {
    id: "prospection_intro",
    name: "Introduction Horion",
    category: "prospection",
    body:
      "Bonjour {nom},\n\nJe me permets de vous contacter au nom de Horion Services. Nous sommes spécialisés dans l'import-export et la logistique internationale.\n\nNous aimerions vous présenter comment nous pouvons accompagner {entreprise} dans vos achats en Chine et leur acheminement jusqu'au Congo.\n\nSeriez-vous disponible pour un échange cette semaine ?\n\nCordialement,\n{agent} — Horion Services",
  },
  {
    id: "relance_devis",
    name: "Relance devis",
    category: "relance",
    body:
      "Bonjour {nom},\n\nJe reviens vers vous concernant notre proposition pour {produit}.\n\nAvez-vous eu l'occasion d'examiner notre devis ? N'hésitez pas à me faire part de vos questions.\n\nBien à vous,\n{agent}",
  },
  {
    id: "confirmation_commande",
    name: "Confirmation commande",
    category: "logistique",
    body:
      "Bonjour {nom},\n\nNous confirmons la réception de votre commande n° {ordreId} pour {produit}.\n\nMontant total : {montant}\n\nNous vous tiendrons informé(e) de l'avancement de l'expédition.\n\nMerci de votre confiance,\n{agent} — Horion Services",
  },
  {
    id: "suivi_expedition",
    name: "Suivi expédition",
    category: "logistique",
    body:
      "Bonjour {nom},\n\nVotre commande n° {ordreId} est en cours d'expédition.\n\nVous recevrez les documents de transport sous peu. N'hésitez pas à nous contacter pour toute question.\n\nBien cordialement,\n{agent}",
  },
  {
    id: "relance_paiement",
    name: "Relance paiement",
    category: "facturation",
    body:
      "Bonjour {nom},\n\nNous nous permettons de vous rappeler que le règlement de {montant} concernant la commande n° {ordreId} est attendu.\n\nMerci de bien vouloir effectuer le virement dans les meilleurs délais.\n\nCordialement,\n{agent} — Horion Services",
  },
  {
    id: "livraison_confirmee",
    name: "Livraison confirmée",
    category: "logistique",
    body:
      "Bonjour {nom},\n\nNous avons le plaisir de vous confirmer la livraison de votre commande n° {ordreId}.\n\nMerci de nous confirmer la bonne réception et l'état des marchandises.\n\nÀ votre service,\n{agent} — Horion Services",
  },
];
