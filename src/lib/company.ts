/**
 * Informations légales de l'entreprise — imprimées en en-tête des factures et
 * bons de livraison. Fournies via variables d'environnement pour éviter de
 * commiter des données réelles dans un dépôt public. Valeurs par défaut =
 * placeholders de démonstration ; renseignez `.env.local` / Vercel avec les
 * vraies coordonnées de l'entreprise.
 */
export const COMPANY = {
  name: process.env.COMPANY_NAME ?? "DEMO SARL",
  activity: process.env.COMPANY_ACTIVITY ?? "Activité de démonstration",
  address: process.env.COMPANY_ADDRESS ?? "Adresse de démonstration, Ville",
  phone: process.env.COMPANY_PHONE ?? "0000 000000",
  bank: process.env.COMPANY_BANK ?? "Banque de démo — Agence Démo",
  rib: process.env.COMPANY_RIB ?? "0000000000-00",
  rc: process.env.COMPANY_RC ?? "00/00 0000000 X00",
  nif: process.env.COMPANY_NIF ?? "000000000000000",
  art: process.env.COMPANY_ART ?? "00000000000",
  nis: process.env.COMPANY_NIS ?? "000000000000000",
};
