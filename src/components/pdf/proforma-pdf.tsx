import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { COMPANY } from "@/lib/company";
import { formatDZDPlain, formatNumberPlain, formatDate } from "@/lib/format";

export type ProformaPdfLine = { designation: string; quantite: number; prix_unitaire: number; total_ht: number };

export type ProformaPdfData = {
  numero: string;
  date: string;
  clientName: string;
  clientPhone: string | null;
  notes: string | null;
  tva_rate: number;
  total_ht: number;
  total_tva: number;
  total_ttc: number;
  lines: ProformaPdfLine[];
};

const s = StyleSheet.create({
  page: { padding: 36, fontSize: 9, fontFamily: "Helvetica", color: "#111827" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  company: { fontSize: 14, fontFamily: "Helvetica-Bold", color: "#0f172a" },
  small: { fontSize: 8, color: "#475569", marginTop: 1 },
  fiscalBox: { fontSize: 7.5, color: "#334155", textAlign: "right" },
  rule: { borderBottomWidth: 1, borderBottomColor: "#0f172a", marginVertical: 8 },
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  title: { fontSize: 15, fontFamily: "Helvetica-Bold", letterSpacing: 1 },
  meta: { fontSize: 9, textAlign: "right" },
  clientBox: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 4, padding: 8, marginBottom: 12, maxWidth: 260 },
  clientLabel: { fontSize: 7, color: "#64748b", textTransform: "uppercase", marginBottom: 2 },
  clientName: { fontSize: 10, fontFamily: "Helvetica-Bold" },
  table: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 2 },
  th: { flexDirection: "row", backgroundColor: "#f1f5f9", borderBottomWidth: 1, borderBottomColor: "#cbd5e1" },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#e2e8f0" },
  cDesc: { flex: 4, padding: 5 },
  cQte: { flex: 1.4, padding: 5, textAlign: "right" },
  cPu: { flex: 1.6, padding: 5, textAlign: "right" },
  cTot: { flex: 1.8, padding: 5, textAlign: "right" },
  thText: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#334155" },
  totals: { marginTop: 10, alignSelf: "flex-end", width: 220 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  totalTtc: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: "#0f172a", marginTop: 3, paddingTop: 4 },
  bold: { fontSize: 11, fontFamily: "Helvetica-Bold" },
  notes: { marginTop: 12, fontSize: 8, color: "#334155" },
  footer: { position: "absolute", bottom: 28, left: 36, right: 36, fontSize: 7.5, color: "#475569", borderTopWidth: 0.5, borderTopColor: "#cbd5e1", paddingTop: 6 },
});

export function ProformaPDF({ data }: { data: ProformaPdfData }) {
  return (
    <Document title={`Proforma ${data.numero}`} author={COMPANY.name}>
      <Page size="A4" style={s.page}>
        <View style={s.headerRow}>
          <View>
            <Text style={s.company}>{COMPANY.name}</Text>
            <Text style={s.small}>{COMPANY.activity}</Text>
            <Text style={s.small}>{COMPANY.address}</Text>
            <Text style={s.small}>Tél : {COMPANY.phone}</Text>
          </View>
          <View style={s.fiscalBox}>
            <Text>RC : {COMPANY.rc}</Text>
            <Text>NIF : {COMPANY.nif}</Text>
            <Text>ART : {COMPANY.art}</Text>
          </View>
        </View>
        <View style={s.rule} />

        <View style={s.titleRow}>
          <Text style={s.title}>FACTURE PROFORMA</Text>
          <View style={s.meta}>
            <Text>N° {data.numero}</Text>
            <Text>Date : {formatDate(data.date)}</Text>
          </View>
        </View>

        <View style={s.clientBox}>
          <Text style={s.clientLabel}>Client</Text>
          <Text style={s.clientName}>{data.clientName}</Text>
          {data.clientPhone ? <Text style={s.small}>Tél : {data.clientPhone}</Text> : null}
        </View>

        <View style={s.table}>
          <View style={s.th}>
            <Text style={[s.cDesc, s.thText]}>Désignation</Text>
            <Text style={[s.cQte, s.thText]}>Quantité</Text>
            <Text style={[s.cPu, s.thText]}>P.U HT</Text>
            <Text style={[s.cTot, s.thText]}>Total</Text>
          </View>
          {data.lines.map((l, i) => (
            <View style={s.tr} key={i}>
              <Text style={s.cDesc}>{l.designation}</Text>
              <Text style={s.cQte}>{formatNumberPlain(l.quantite, 0)}</Text>
              <Text style={s.cPu}>{formatNumberPlain(l.prix_unitaire, 2)}</Text>
              <Text style={s.cTot}>{formatDZDPlain(l.total_ht)}</Text>
            </View>
          ))}
        </View>

        <View style={s.totals}>
          <View style={s.totalRow}><Text>Total HT</Text><Text>{formatDZDPlain(data.total_ht)}</Text></View>
          <View style={s.totalRow}><Text>TVA ({(data.tva_rate * 100).toFixed(0)} %)</Text><Text>{formatDZDPlain(data.total_tva)}</Text></View>
          <View style={s.totalTtc}><Text style={s.bold}>Total TTC</Text><Text style={s.bold}>{formatDZDPlain(data.total_ttc)}</Text></View>
        </View>

        {data.notes ? <Text style={s.notes}>{data.notes}</Text> : null}

        <Text style={s.footer} fixed>{COMPANY.bank} — RIB : {COMPANY.rib}   |   {COMPANY.name} — {COMPANY.address}</Text>
      </Page>
    </Document>
  );
}
