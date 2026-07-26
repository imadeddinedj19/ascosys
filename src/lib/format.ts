/**
 * Helpers de formatage — Dinar algérien (DZD).
 * Format des montants : séparateur de milliers = espace, décimale = point.
 * Exemple : « 585 585 585.25 DA ». Utilisés dans toute l'application.
 */

/**
 * Formateur maison : séparateur de milliers = espace normale, décimale = point.
 * Exemple : 585585585.25 → « 585 585 585.25 ». Espaces normales = compatible PDF.
 */
function groupNumber(
  value: number | null | undefined,
  minFractionDigits: number,
  maxFractionDigits: number,
): string {
  const num = Number(value ?? 0);
  const safe = Number.isFinite(num) ? num : 0;
  const neg = safe < 0;
  const fixed = Math.abs(safe).toFixed(maxFractionDigits); // "1234567.25"
  const dot = fixed.indexOf(".");
  let intPart = dot === -1 ? fixed : fixed.slice(0, dot);
  let decPart = dot === -1 ? "" : fixed.slice(dot + 1);
  // Réduit les zéros superflus jusqu'au minimum demandé.
  if (decPart) {
    decPart = decPart.replace(/0+$/, "");
    while (decPart.length < minFractionDigits) decPart += "0";
  } else if (minFractionDigits > 0) {
    decPart = "0".repeat(minFractionDigits);
  }
  // Groupe les milliers par des espaces normales.
  intPart = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const body = decPart ? `${intPart}.${decPart}` : intPart;
  return neg ? `-${body}` : body;
}

/** Formate un montant en DZD : « 585 585 585.25 DA ». */
export function formatDZD(value: number | null | undefined): string {
  return `${groupNumber(value, 2, 2)} DA`;
}

/** Formate un nombre (quantités, etc.) sans devise : « 9 930 » ou « 12.5 ». */
export function formatNumber(value: number | null | undefined, fractionDigits = 2): string {
  return groupNumber(value, 0, fractionDigits);
}

/** Date lisible : « 06/07/2026 ». Accepte Date | string | null. */
export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

/** Date + heure : « 06/07/2026 14:30 ». */
export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/** Date du jour au format ISO (YYYY-MM-DD) pour les champs input. */
export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Variantes « plain » conservées pour les PDF. Le formateur maison utilise déjà
 * des espaces normales (rendues correctement par Helvetica), donc elles sont
 * identiques aux versions standard.
 */
export function formatDZDPlain(value: number | null | undefined): string {
  return formatDZD(value);
}

export function formatNumberPlain(value: number | null | undefined, fractionDigits = 2): string {
  return formatNumber(value, fractionDigits);
}

/** Taux de TVA par défaut en Algérie. */
export const TVA_DEFAULT = 0.19;
