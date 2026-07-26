import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import { COMPANY } from "@/lib/company";
import { formatDZDPlain, formatNumberPlain, formatDate } from "@/lib/format";

export type PdfLine = {
  designation: string;
  quantite: number;
  prix_unitaire: number;
  total_ht: number;
};

export type PdfClient = {
  company_name: string;
  client_type: "entreprise" | "artisan" | "particulier";
  address: string | null;
  rc: string | null;
  carte_artisan: string | null;
  nif: string | null;
  art: string | null;
  nis: string | null;
  phone: string | null;
};

export type PdfDocument = {
  numero: string;
  date: string;
  type: "bon" | "facture";
  tva_rate: number;
  total_ht: number;
  total_tva: number;
  timbre: number;
  total_ttc: number;
  notes: string | null;
};

/**
 * Trois rendus :
 *  - "facture"     : facture chiffrée (TVA + droit de timbre + net à payer)
 *  - "bon-facture" : bon de livraison d'une commande facturée (désignation + quantité seulement)
 *  - "bon"         : bon de livraison autonome (chiffré, sans TVA)
 */
export type PdfVariant = "facture" | "bon-facture" | "bon";

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 9, fontFamily: "Helvetica", color: "#111827" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  company: { fontSize: 14, fontFamily: "Helvetica-Bold", color: "#0f172a" },
  activity: { fontSize: 8, color: "#475569", marginTop: 2 },
  small: { fontSize: 8, color: "#475569", marginTop: 1 },
  fiscalBox: { fontSize: 7.5, color: "#334155", textAlign: "right", maxWidth: 220 },
  rule: { borderBottomWidth: 1, borderBottomColor: "#0f172a", marginVertical: 8 },
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  title: { fontSize: 16, fontFamily: "Helvetica-Bold", letterSpacing: 1 },
  meta: { fontSize: 9, textAlign: "right" },
  clientBox: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 4, padding: 8, marginBottom: 12, maxWidth: 260 },
  clientLabel: { fontSize: 7, color: "#64748b", textTransform: "uppercase", marginBottom: 2 },
  clientName: { fontSize: 10, fontFamily: "Helvetica-Bold" },
  table: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 2 },
  th: { flexDirection: "row", backgroundColor: "#f1f5f9", borderBottomWidth: 1, borderBottomColor: "#cbd5e1" },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#e2e8f0" },
  cellDesc: { flex: 4, padding: 5 },
  cellQte: { flex: 1.4, padding: 5, textAlign: "right" },
  cellPu: { flex: 1.6, padding: 5, textAlign: "right" },
  cellTot: { flex: 1.8, padding: 5, textAlign: "right" },
  thText: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#334155" },
  totals: { marginTop: 10, alignSelf: "flex-end", width: 240 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  totalTtc: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: "#0f172a", marginTop: 3, paddingTop: 4 },
  totalTtcText: { fontSize: 11, fontFamily: "Helvetica-Bold" },
  footer: { position: "absolute", bottom: 28, left: 36, right: 36, fontSize: 7.5, color: "#475569", borderTopWidth: 0.5, borderTopColor: "#cbd5e1", paddingTop: 6 },
  signature: { marginTop: 30, flexDirection: "row", justifyContent: "space-between" },
  sigBox: { width: 180 },
  sigLabel: { fontSize: 8, color: "#334155", borderTopWidth: 0.5, borderTopColor: "#94a3b8", paddingTop: 3, marginTop: 28 },
});

export function SalesDocumentPDF({
  doc,
  client,
  lines,
  variant,
}: {
  doc: PdfDocument;
  client: PdfClient;
  lines: PdfLine[];
  variant: PdfVariant;
}) {
  const isFacture = variant === "facture";
  const showPrices = variant !== "bon-facture";
  const title = isFacture ? "FACTURE" : "BON DE LIVRAISON";

  return (
    <Document title={`${title} ${doc.numero}`} author={COMPANY.name}>
      <Page size="A4" style={styles.page}>
        {/* En-tête entreprise */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.company}>{COMPANY.name}</Text>
            <Text style={styles.activity}>{COMPANY.activity}</Text>
            <Text style={styles.small}>{COMPANY.address}</Text>
            <Text style={styles.small}>Tél : {COMPANY.phone}</Text>
          </View>
          <View style={styles.fiscalBox}>
            <Text>RC : {COMPANY.rc}</Text>
            <Text>NIF : {COMPANY.nif}</Text>
            <Text>ART : {COMPANY.art}</Text>
            <Text>NIS : {COMPANY.nis}</Text>
          </View>
        </View>
        <View style={styles.rule} />

        {/* Titre + numéro */}
        <View style={styles.titleRow}>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.meta}>
            <Text>N° {doc.numero}</Text>
            <Text>Date : {formatDate(doc.date)}</Text>
          </View>
        </View>

        {/* Client — R/C (entreprise) ou Carte d'artisan (artisan) */}
        <View style={styles.clientBox}>
          <Text style={styles.clientLabel}>Client</Text>
          <Text style={styles.clientName}>{client.company_name}</Text>
          {client.address ? <Text style={styles.small}>{client.address}</Text> : null}
          {client.client_type === "entreprise" && client.rc ? <Text style={styles.small}>RC : {client.rc}</Text> : null}
          {client.client_type === "artisan" && client.carte_artisan ? <Text style={styles.small}>Carte d&apos;artisan : {client.carte_artisan}</Text> : null}
          {client.client_type !== "particulier" && client.nif ? <Text style={styles.small}>NIF : {client.nif}</Text> : null}
          {client.client_type !== "particulier" && client.art ? <Text style={styles.small}>ART : {client.art}</Text> : null}
          {client.client_type !== "particulier" && client.nis ? <Text style={styles.small}>NIS : {client.nis}</Text> : null}
          {client.phone ? <Text style={styles.small}>Tél : {client.phone}</Text> : null}
        </View>

        {/* Tableau des lignes */}
        <View style={styles.table}>
          <View style={styles.th}>
            <Text style={[styles.cellDesc, styles.thText]}>Désignation</Text>
            <Text style={[styles.cellQte, styles.thText]}>Quantité</Text>
            {showPrices && <Text style={[styles.cellPu, styles.thText]}>P.U (DA)</Text>}
            {showPrices && <Text style={[styles.cellTot, styles.thText]}>{isFacture ? "Total HT" : "Total"}</Text>}
          </View>
          {lines.map((l, i) => (
            <View style={styles.tr} key={i}>
              <Text style={styles.cellDesc}>{l.designation}</Text>
              <Text style={styles.cellQte}>{formatNumberPlain(l.quantite, 0)}</Text>
              {showPrices && <Text style={styles.cellPu}>{formatNumberPlain(l.prix_unitaire, 2)}</Text>}
              {showPrices && <Text style={styles.cellTot}>{formatDZDPlain(l.total_ht)}</Text>}
            </View>
          ))}
        </View>

        {/* Totaux (masqués pour un bon de livraison facturé) */}
        {showPrices && (
          <View style={styles.totals}>
            <View style={styles.totalRow}>
              <Text>Total HT</Text>
              <Text>{formatDZDPlain(doc.total_ht)}</Text>
            </View>
            {isFacture && (
              <View style={styles.totalRow}>
                <Text>TVA ({(doc.tva_rate * 100).toFixed(0)} %)</Text>
                <Text>{formatDZDPlain(doc.total_tva)}</Text>
              </View>
            )}
            {isFacture && doc.timbre > 0 && (
              <View style={styles.totalRow}>
                <Text>Droit de timbre</Text>
                <Text>{formatDZDPlain(doc.timbre)}</Text>
              </View>
            )}
            <View style={styles.totalTtc}>
              <Text style={styles.totalTtcText}>{isFacture ? "Net à payer" : "Total"}</Text>
              <Text style={styles.totalTtcText}>{formatDZDPlain(isFacture ? doc.total_ttc : doc.total_ht)}</Text>
            </View>
          </View>
        )}

        {doc.notes ? <Text style={[styles.small, { marginTop: 12 }]}>Note : {doc.notes}</Text> : null}

        {/* Signatures */}
        <View style={styles.signature}>
          <View style={styles.sigBox}>
            <Text style={styles.sigLabel}>Cachet & signature (ASCO)</Text>
          </View>
          <View style={styles.sigBox}>
            <Text style={styles.sigLabel}>
              {isFacture ? "Signature du client" : "Reçu par le client"}
            </Text>
          </View>
        </View>

        {/* Pied de page */}
        <Text style={styles.footer} fixed>
          {COMPANY.bank} — RIB : {COMPANY.rib}   |   {COMPANY.name} — {COMPANY.address}
        </Text>
      </Page>
    </Document>
  );
}
