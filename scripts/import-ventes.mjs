/**
 * Import de l'historique des ventes (feuille « VENTES ») vers Supabase.
 *
 *  - Regroupe les lignes consécutives partageant le même N° BL + CLIENT en un
 *    document de vente (sales_documents) avec ses lignes (sales_document_lines).
 *  - numero = N° BL d'origine (rendu unique) -> ne consomme PAS le compteur 2026.
 *  - type = 'bon', statut = 'valide', TVA 0 (les bons de la feuille sont sans TVA).
 *  - Rapproche les clients par nom ; crée ceux qui manquent (tag « à vérifier »).
 *  - Rapproche les produits par désignation quand c'est possible.
 *
 *  Usage :
 *    node scripts/import-ventes.mjs              # importe (refuse si déjà importé)
 *    node scripts/import-ventes.mjs --reset      # supprime l'import précédent puis réimporte
 *    node scripts/import-ventes.mjs --sheet "VENTES 2024"   # autre feuille
 */
import xlsx from "xlsx";
import * as fs from "node:fs";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

xlsx.set_fs(fs);
config({ path: ".env.local" });

const XLSX_PATH =
  "C:/Users/LENOVO/OneDrive - SGH/Documents/AscoSys/Gestionnaire ASCO.xlsx";

const args = process.argv.slice(2);
const RESET = args.includes("--reset");
const sheetArg = args.indexOf("--sheet");
const SHEET = sheetArg >= 0 ? args[sheetArg + 1] : "VENTES";
const MARKER = `[IMPORT-${SHEET.trim().replace(/\s+/g, "-").toUpperCase()}]`;

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

// --- Helpers ---------------------------------------------------------------
const norm = (s) =>
  (s ?? "")
    .toString()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/** "6.80 DA" / "20,50 DA" / "8.5" -> 8.5 ; "" -> 0 */
function num(v) {
  if (v === null || v === undefined) return 0;
  let s = v.toString().replace(/\p{Zs}/gu, " ").replace(/DA/gi, "").replace(/\s| | /g, "");
  // Nombres FR "1,234.56" ou "1.234,56" : on retire les séparateurs de milliers.
  s = s.replace(/,/g, "");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

/** "01/04/2025" (JJ/MM/AAAA) -> "2025-04-01" ; sinon null */
function parseDate(v) {
  if (!v) return null;
  const s = v.toString().trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return null;
  let [, d, mo, y] = m;
  if (y.length === 2) y = "20" + y;
  d = d.padStart(2, "0");
  mo = mo.padStart(2, "0");
  if (+mo > 12) return null;
  return `${y}-${mo}-${d}`;
}

// --- Lecture de la feuille --------------------------------------------------
console.log(`📖 Lecture de « ${SHEET} » dans Gestionnaire ASCO.xlsx`);
const wb = xlsx.readFile(XLSX_PATH);
const ws = wb.Sheets[SHEET];
if (!ws) {
  console.error(`❌ Feuille « ${SHEET} » introuvable.`);
  process.exit(1);
}
const rows = xlsx.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" });

// En-tête : trouver la ligne contenant DESIGNATION pour repérer les colonnes.
let headerRow = 0;
for (let i = 0; i < Math.min(rows.length, 5); i++) {
  const joined = rows[i].map((c) => norm(c)).join("|");
  if (joined.includes("designation") && joined.includes("client")) {
    headerRow = i;
    break;
  }
}
const H = rows[headerRow].map((c) => norm(c));
const col = (labels) => H.findIndex((h) => labels.some((l) => h.includes(l)));
const ci = {
  bl: col(["n° bl", "no bl", "n bl"]) >= 0 ? col(["n° bl", "no bl", "n bl"]) : 0,
  date: col(["date"]),
  client: col(["client"]),
  designation: col(["designation"]),
  qte: col(["quantite", "qte", "qnt"]),
  pu: col(["p.u", "pu", "prix"]),
  totalHt: col(["total ht"]),
  totalBon: col(["total de bon"]),
  totalPaie: col(["total de paiement"]),
};
console.log("   Colonnes détectées:", ci);

// --- Regroupement en documents ---------------------------------------------
const docs = [];
let cur = null;
let lastDate = null;
let lastBl = "";
let lastClient = "";

for (let i = headerRow + 1; i < rows.length; i++) {
  const r = rows[i];
  const rawBl = (r[ci.bl] ?? "").toString().trim();
  const rawClient = (r[ci.client] ?? "").toString().trim();
  const designation = (r[ci.designation] ?? "").toString().trim();
  const date = parseDate(r[ci.date]) ?? lastDate;
  if (date) lastDate = date;

  // Ligne vide / séparateur : on ignore.
  if (!designation && !rawClient && !rawBl) continue;
  if (!designation) continue; // pas de produit -> pas une ligne de vente

  const bl = rawBl || lastBl;
  const client = rawClient || lastClient;
  if (!client) continue; // impossible de rattacher sans client
  lastBl = bl;
  lastClient = client;

  const qte = num(r[ci.qte]);
  const pu = num(r[ci.pu]);
  let lineHt = num(r[ci.totalHt]);
  if (!lineHt) lineHt = Math.round(qte * pu * 100) / 100;

  // Nouveau document si (BL, client) change.
  const key = `${bl}|||${norm(client)}`;
  if (!cur || cur.key !== key) {
    cur = {
      key,
      bl,
      client,
      date: date ?? lastDate,
      totalPaie: (r[ci.totalPaie] ?? "").toString().trim(),
      lines: [],
    };
    docs.push(cur);
  }
  // Capturer les infos de paiement/total si présentes sur une ligne du groupe.
  const paie = (r[ci.totalPaie] ?? "").toString().trim();
  if (paie && !cur.totalPaie) cur.totalPaie = paie;

  cur.lines.push({ designation, quantite: qte, prix_unitaire: pu, total_ht: lineHt });
}

console.log(`   ${docs.length} document(s) reconstitué(s) à partir de ${rows.length} lignes.`);

// --- Vérif import déjà présent ---------------------------------------------
const { data: existing } = await sb
  .from("sales_documents")
  .select("id")
  .like("notes", `%${MARKER}%`);

if (existing && existing.length > 0) {
  if (!RESET) {
    console.error(
      `\n⚠️  ${existing.length} document(s) déjà importés (${MARKER}).` +
        `\n   Relancez avec --reset pour les remplacer, ou rien ne sera fait.`,
    );
    process.exit(1);
  }
  console.log(`🧹 Suppression de ${existing.length} document(s) importés précédemment…`);
  const ids = existing.map((d) => d.id);
  for (let i = 0; i < ids.length; i += 100) {
    await sb.from("sales_documents").delete().in("id", ids.slice(i, i + 100));
  }
}

// --- Résolution des clients -------------------------------------------------
const { data: clientRows } = await sb.from("clients").select("id, company_name");
const clientMap = new Map();
for (const c of clientRows ?? []) clientMap.set(norm(c.company_name), c.id);

const neededNames = [...new Set(docs.map((d) => d.client))];
const toCreate = neededNames.filter((n) => !clientMap.has(norm(n)));
if (toCreate.length) {
  console.log(`👤 ${toCreate.length} client(s) absent(s) du répertoire — création…`);
  const payload = toCreate.map((name) => ({
    company_name: name,
    industry_type: "importé (à vérifier)",
    notes_import: undefined, // (colonne inexistante ignorée)
  }));
  // On insère sans champ inconnu.
  const clean = payload.map(({ company_name, industry_type }) => ({ company_name, industry_type }));
  const { data: created, error } = await sb.from("clients").insert(clean).select("id, company_name");
  if (error) { console.error("❌ Création clients:", error.message); process.exit(1); }
  for (const c of created) clientMap.set(norm(c.company_name), c.id);
}

// --- Résolution des produits (facultatif) -----------------------------------
const { data: productRows } = await sb.from("products").select("id, name");
const productMap = new Map();
for (const p of productRows ?? []) productMap.set(norm(p.name), p.id);

// --- Construction + insertion des documents --------------------------------
// numero unique basé sur le N° BL d'origine.
const usedNumero = new Set();
const { data: allNums } = await sb.from("sales_documents").select("numero");
for (const n of allNums ?? []) usedNumero.add(n.numero);

function uniqueNumero(bl, date) {
  const base = (bl && bl.trim()) || `BL ${date ?? ""}`.trim();
  let cand = base;
  let k = 2;
  while (usedNumero.has(cand)) cand = `${base} (${k++})`;
  usedNumero.add(cand);
  return cand;
}

const docPayload = [];
const docMeta = []; // { numero, lines, client }
for (const d of docs) {
  const client_id = clientMap.get(norm(d.client));
  if (!client_id) { console.warn(`   ⚠️  client non résolu, ignoré: ${d.client}`); continue; }
  const total_ht = Math.round(d.lines.reduce((s, l) => s + l.total_ht, 0) * 100) / 100;
  const numero = uniqueNumero(d.bl, d.date);
  const noteParts = [MARKER, `BL d'origine: ${d.bl || "—"}`];
  if (d.totalPaie) noteParts.push(`Paiement (feuille): ${d.totalPaie}`);
  docPayload.push({
    numero,
    date: d.date ?? "2025-01-01",
    client_id,
    type: "bon",
    tva_rate: 0,
    total_ht,
    total_tva: 0,
    total_ttc: total_ht,
    statut: "valide",
    notes: noteParts.join(" · "),
  });
  docMeta.push({ numero, lines: d.lines });
}

console.log(`💾 Insertion de ${docPayload.length} document(s)…`);
for (let i = 0; i < docPayload.length; i += 200) {
  const { error } = await sb.from("sales_documents").insert(docPayload.slice(i, i + 200));
  if (error) { console.error("❌ Insert documents:", error.message); process.exit(1); }
}

// Récupérer les ids par numero.
const numToId = new Map();
for (let i = 0; i < docPayload.length; i += 200) {
  const nums = docPayload.slice(i, i + 200).map((d) => d.numero);
  const { data } = await sb.from("sales_documents").select("id, numero").in("numero", nums);
  for (const row of data ?? []) numToId.set(row.numero, row.id);
}

// Construire + insérer les lignes.
const linePayload = [];
for (const m of docMeta) {
  const document_id = numToId.get(m.numero);
  if (!document_id) continue;
  m.lines.forEach((l, idx) => {
    linePayload.push({
      document_id,
      product_id: productMap.get(norm(l.designation)) ?? null,
      designation: l.designation,
      quantite: l.quantite,
      prix_unitaire: l.prix_unitaire,
      total_ht: l.total_ht,
      position: idx,
    });
  });
}

console.log(`💾 Insertion de ${linePayload.length} ligne(s)…`);
for (let i = 0; i < linePayload.length; i += 500) {
  const { error } = await sb.from("sales_document_lines").insert(linePayload.slice(i, i + 500));
  if (error) { console.error("❌ Insert lignes:", error.message); process.exit(1); }
}

const linked = linePayload.filter((l) => l.product_id).length;
const totalCA = docPayload.reduce((s, d) => s + d.total_ttc, 0);
console.log(`\n🎉 Import « ${SHEET} » terminé.`);
console.log(`   • ${docPayload.length} documents · ${linePayload.length} lignes`);
console.log(`   • ${linked}/${linePayload.length} lignes rattachées à un produit du catalogue`);
console.log(`   • ${toCreate.length} nouveaux clients créés (tag « à vérifier »)`);
console.log(`   • Chiffre d'affaires importé: ${totalCA.toLocaleString("fr-FR")} DA`);
