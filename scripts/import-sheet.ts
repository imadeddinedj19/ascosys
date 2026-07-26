/**
 * Import des données depuis « Gestionnaire ASCO.xlsx » vers Supabase.
 *
 * Usage :
 *   1. Renseignez NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY dans .env.local
 *   2. Exécutez la migration supabase/migrations/0001_init.sql dans Supabase
 *   3. npx tsx scripts/import-sheet.ts            (importe si les tables sont vides)
 *      npx tsx scripts/import-sheet.ts --reset    (vide puis réimporte : clients, formes, produits, prix)
 *
 * Le chemin du classeur peut être passé en argument, sinon valeur par défaut ci-dessous.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import path from "node:path";

config({ path: ".env.local" });

const DEFAULT_XLSX =
  "C:\\Users\\LENOVO\\OneDrive - SGH\\Documents\\AscoSys\\Gestionnaire ASCO.xlsx";

const args = process.argv.slice(2);
const RESET = args.includes("--reset");
const xlsxPath = args.find((a) => !a.startsWith("--")) ?? DEFAULT_XLSX;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "\n❌ Variables manquantes. Renseignez NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY dans .env.local\n",
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false },
});

// ---------- Helpers ----------
type Row = (string | number | null)[];

function loadSheet(wb: XLSX.WorkBook, name: string): Row[] {
  const ws = wb.Sheets[name];
  if (!ws) {
    console.warn(`⚠️  Feuille introuvable : « ${name} »`);
    return [];
  }
  return XLSX.utils.sheet_to_json<Row>(ws, { header: 1, defval: null, raw: true });
}

const str = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const t = String(v).trim();
  return t === "" ? null : t;
};
const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(",", ".").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
};
const norm = (v: unknown): string =>
  String(v ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

async function tableCount(table: string): Promise<number> {
  const { count } = await supabase.from(table).select("*", { count: "exact", head: true });
  return count ?? 0;
}

async function resetTable(table: string) {
  // Supprime toutes les lignes (uuid non nul)
  await supabase.from(table).delete().not("id", "is", null);
}

async function guard(table: string): Promise<boolean> {
  const c = await tableCount(table);
  if (c > 0 && !RESET) {
    console.log(`⏭️  ${table} : ${c} ligne(s) déjà présentes — ignoré (utilisez --reset pour réimporter).`);
    return false;
  }
  if (c > 0 && RESET) {
    console.log(`🗑️  ${table} : réinitialisation (${c} ligne(s) supprimée(s)).`);
    await resetTable(table);
  }
  return true;
}

// ---------- Imports ----------
async function importClients(wb: XLSX.WorkBook) {
  if (!(await guard("clients"))) return;
  const rows = loadSheet(wb, "CLIENT ");
  const seen = new Set<string>();
  const payload: Record<string, unknown>[] = [];
  let skipped = 0;

  for (const r of rows) {
    const name = str(r[2]) ?? str(r[0]); // C = société, sinon A = nom
    if (!name) {
      skipped++;
      continue;
    }
    const key = norm(name);
    if (seen.has(key)) {
      skipped++;
      continue;
    }
    seen.add(key);
    payload.push({
      company_name: name,
      contact_person: str(r[2]) ? str(r[0]) : null, // A comme contact si C = société
      rc: str(r[4]),
      nif: str(r[5]),
      art: str(r[6]),
      nis: str(r[7]),
      phone: str(r[8]),
    });
  }

  const { error } = await supabase.from("clients").insert(payload);
  if (error) throw error;
  console.log(`✅ clients : ${payload.length} importé(s), ${skipped} ligne(s) ignorée(s).`);
}

async function importFormes(wb: XLSX.WorkBook) {
  if (!(await guard("formes"))) return;
  const rows = loadSheet(wb, "FORME BELHADJ").slice(1); // saute l'en-tête
  const payload: Record<string, unknown>[] = [];
  let skipped = 0;

  for (const r of rows) {
    const ref = str(r[0]);
    if (!ref) {
      skipped++;
      continue;
    }
    payload.push({
      ref,
      fournisseur: "BELHADJ",
      longueur: num(r[1]),
      largeur: num(r[2]),
      hauteur: num(r[3]),
      hauteur_couvercle: num(r[4]),
      longueur_forme: num(r[5]),
      largeur_forme: num(r[6]),
      nb_poses: num(r[8]),
    });
  }

  const { error } = await supabase.from("formes").insert(payload);
  if (error) throw error;
  console.log(`✅ formes : ${payload.length} importée(s), ${skipped} ignorée(s).`);
}

async function importProducts(wb: XLSX.WorkBook) {
  if (!(await guard("products"))) return;
  const rows = loadSheet(wb, "PRODUITS ").slice(1);
  const payload: Record<string, unknown>[] = [];
  let skipped = 0;

  for (const r of rows) {
    const name = str(r[0]);
    if (!name) {
      skipped++;
      continue;
    }
    // Les caractéristiques techniques vivent désormais sur la découpe (forme).
    payload.push({ name, ref: str(r[1]) });
  }

  const { error } = await supabase.from("products").insert(payload);
  if (error) throw error;
  console.log(`✅ produits : ${payload.length} importé(s), ${skipped} ignoré(s).`);
}

async function importPrices(wb: XLSX.WorkBook) {
  if (!(await guard("product_prices"))) return;

  // Index des produits existants par nom normalisé
  const { data: products } = await supabase.from("products").select("id, name");
  const index = new Map<string, string>();
  for (const p of products ?? []) index.set(norm(p.name), p.id);

  const rows = loadSheet(wb, "LISTE DES PRIX ").slice(1);
  const prices: Record<string, unknown>[] = [];
  let matched = 0;
  let created = 0;
  let skipped = 0;

  for (const r of rows) {
    const desig = str(r[0]);
    const prix = num(r[1]);
    if (!desig || prix === null) {
      skipped++;
      continue;
    }
    let productId: string | undefined = index.get(norm(desig));
    if (!productId) {
      // Crée un produit léger depuis la liste des prix
      const { data: created2, error: e2 } = await supabase
        .from("products")
        .insert({ name: desig })
        .select("id")
        .single();
      if (e2) throw e2;
      productId = created2!.id as string;
      index.set(norm(desig), productId);
      created++;
    } else {
      matched++;
    }
    prices.push({
      product_id: productId,
      prix_unitaire: prix,
    });
  }

  const { error } = await supabase.from("product_prices").insert(prices);
  if (error) throw error;
  console.log(
    `✅ tarification : ${prices.length} prix (${matched} rattaché(s) à un produit existant, ${created} nouveau(x) produit(s) créé(s)), ${skipped} ignoré(s).`,
  );
}

async function main() {
  console.log(`\n📖 Lecture du classeur : ${path.basename(xlsxPath)}`);
  const wb = XLSX.readFile(xlsxPath);
  console.log(`   Mode : ${RESET ? "RÉINITIALISATION" : "import si tables vides"}\n`);

  await importClients(wb);
  await importFormes(wb);
  await importProducts(wb); // avant les prix (les prix créent les produits manquants)
  await importPrices(wb);

  console.log("\n🎉 Import terminé.\n");
  console.log(
    "ℹ️  Note : le lien produit↔forme n'est pas déduit automatiquement (aucune référence de forme dans la feuille PRODUITS). À renseigner dans l'application.\n",
  );
}

main().catch((e) => {
  console.error("\n❌ Échec de l'import :", e.message ?? e);
  process.exit(1);
});
