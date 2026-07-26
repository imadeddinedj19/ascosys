import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { COMPANY } from "@/lib/company";
import { formatDZDPlain, formatDate } from "@/lib/format";

export type VersementPdfData = {
  name: string;
  date: string;
  versement: number;
  balance: number;
  reference: string | null;
};

const s = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#111827" },
  company: { fontSize: 14, fontFamily: "Helvetica-Bold", color: "#0f172a" },
  small: { fontSize: 8, color: "#475569", marginTop: 1 },
  rule: { borderBottomWidth: 1, borderBottomColor: "#0f172a", marginVertical: 10 },
  title: { fontSize: 18, fontFamily: "Helvetica-Bold", letterSpacing: 1, textAlign: "center", marginVertical: 16 },
  row: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  label: { fontSize: 9, color: "#64748b", textTransform: "uppercase" },
  clientName: { fontSize: 12, fontFamily: "Helvetica-Bold", marginTop: 2 },
  box: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 4, marginTop: 24 },
  boxRow: { flexDirection: "row", justifyContent: "space-between", padding: 10, borderBottomWidth: 0.5, borderBottomColor: "#e2e8f0" },
  boxRowLast: { flexDirection: "row", justifyContent: "space-between", padding: 10 },
  bldLabel: { fontSize: 11, fontFamily: "Helvetica-Bold" },
  amount: { fontSize: 13, fontFamily: "Helvetica-Bold", color: "#0f172a" },
  sig: { marginTop: 60, flexDirection: "row", justifyContent: "flex-end" },
  sigLabel: { fontSize: 9, color: "#334155", borderTopWidth: 0.5, borderTopColor: "#94a3b8", paddingTop: 4, width: 180, textAlign: "center" },
  footer: { position: "absolute", bottom: 30, left: 40, right: 40, fontSize: 7.5, color: "#475569", borderTopWidth: 0.5, borderTopColor: "#cbd5e1", paddingTop: 6 },
});

export function VersementPDF({ data }: { data: VersementPdfData }) {
  return (
    <Document title={`Bon de versement ${data.name}`} author={COMPANY.name}>
      <Page size="A4" style={s.page}>
        <Text style={s.company}>{COMPANY.name}</Text>
        <Text style={s.small}>{COMPANY.activity}</Text>
        <Text style={s.small}>{COMPANY.address}</Text>
        <View style={s.rule} />

        <Text style={s.title}>BON DE VERSEMENT</Text>

        <View style={s.row}>
          <View>
            <Text style={s.label}>Client</Text>
            <Text style={s.clientName}>{data.name}</Text>
          </View>
          <View>
            <Text style={s.label}>Date</Text>
            <Text style={{ marginTop: 2 }}>{formatDate(data.date)}</Text>
            {data.reference ? <Text style={s.small}>Réf : {data.reference}</Text> : null}
          </View>
        </View>

        <View style={s.box}>
          <View style={s.boxRow}>
            <Text style={s.bldLabel}>Versement</Text>
            <Text style={s.amount}>{formatDZDPlain(data.versement)}</Text>
          </View>
          <View style={s.boxRowLast}>
            <Text style={s.bldLabel}>Balance restante</Text>
            <Text style={s.amount}>{formatDZDPlain(data.balance)}</Text>
          </View>
        </View>

        <View style={s.sig}>
          <Text style={s.sigLabel}>Cachet & signature (ASCO)</Text>
        </View>

        <Text style={s.footer} fixed>{COMPANY.bank} — RIB : {COMPANY.rib}   |   {COMPANY.name} — {COMPANY.address}</Text>
      </Page>
    </Document>
  );
}
