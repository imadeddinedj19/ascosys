/**
 * Droit de timbre (Algérie) — barème 2025/2026.
 * S'applique sur le montant total TTC d'une facture payée en espèces,
 * par tranche (ou fraction de tranche) de 100 DA :
 *   - de 300 à 30 000 DA      : 1 DA / 100 DA   (~1 %)
 *   - de 30 001 à 100 000 DA  : 1,5 DA / 100 DA (~1,5 %)
 *   - au-delà de 100 000 DA   : 2 DA / 100 DA   (~2 %)
 * Barème marginal : chaque tranche du montant est taxée au taux de sa tranche.
 */
export function droitTimbre(ttc: number | null | undefined): number {
  const montant = Number(ttc ?? 0);
  if (!Number.isFinite(montant) || montant < 300) return 0;

  // Nombre de tranches de 100 DA (toute fraction compte pour une tranche entière).
  const tranches = (from: number, to: number): number => {
    const part = Math.max(0, Math.min(montant, to) - from);
    return Math.ceil(part / 100);
  };

  let timbre = 0;
  timbre += tranches(0, 30_000) * 1; // 1 DA / 100
  timbre += tranches(30_000, 100_000) * 1.5; // 1,5 DA / 100
  timbre += tranches(100_000, Infinity) * 2; // 2 DA / 100

  // Arrondi au dinar (les timbres sont exprimés en DA entiers).
  return Math.round(timbre);
}

/** Le timbre ne s'applique qu'aux règlements en espèces. */
export function droitTimbreSiEspeces(ttc: number, mode: string | null | undefined): number {
  return mode === "espece" ? droitTimbre(ttc) : 0;
}
