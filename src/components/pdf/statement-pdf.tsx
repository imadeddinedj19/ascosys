import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { COMPANY } from "@/lib/company";
import { formatDZDPlain, formatNumberPlain, formatDate } from "@/lib/format";
import type { ClientStatement } from "@/lib/data/statement";

const styles = StyleSheet.create({
  page: { padding: 30, fontSize: 8, fontFamily: "Helvetica", color: "#111827" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  company: { fontSize: 13, fontFamily: "Helvetica-Bold", color: "#0f172a" },
  small: { fontSize: 7.5, color: "#475569", marginTop: 1 },
  fiscalBox: { fontSize: 7, color: "#334155", textAlign: "right" },
  rule: { borderBottomWidth: 1, borderBottomColor: "#0f172a", marginVertical: 6 },
  title: { fontSize: 14, fontFamily: "Helvetica-Bold", letterSpacing: 1, marginBottom: 2 },
  sub: { fontSize: 8, color: "#334155", marginBottom: 8 },
  clientName: { fontSize: 10, fontFamily: "Helvetica-Bold" },
  table: { borderWidth: 1, borderColor: "#cbd5e1", marginTop: 8 },
  th: { flexDirection: "row", backgroundColor: "#f1f5f9", borderBottomWidth: 1, borderBottomColor: "#cbd5e1" },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#eef2f7" },
  trSub: { flexDirection: "row", backgroundColor: "#f8fafc", borderBottomWidth: 0.5, borderBottomColor: "#cbd5e1" },
  cDate: { width: 55, padding: 3 },
  cDes: { flex: 1, padding: 3 },
  cQte: { width: 45, padding: 3, textAlign: "right" },
  cPu: { width: 50, padding: 3, textAlign: "right" },
  cAmt: { width: 65, padding: 3, textAlign: "right" },
  thText: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: "#334155" },
  bold: { fontFamily: "Helvetica-Bold" },
  muted: { color: "#64748b" },
  totals: { marginTop: 10, alignSelf: "flex-end", width: 240 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  totalFinal: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: "#0f172a", marginTop: 3, paddingTop: 4 },
  footer: { position: "absolute", bottom: 24, left: 30, right: 30, fontSize: 7, color: "#475569", borderTopWidth: 0.5, borderTopColor: "#cbd5e1", paddingTop: 5 },
});

export function StatementPDF({ statement }: { statement: ClientStatement }) {
  const c = statement.client;
  return (
    <Document title={`Releve ${c.company_name} ${statement.year}`} author={COMPANY.name}>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.company}>{COMPANY.name}</Text>
            <Text style={styles.small}>{COMPANY.activity}</Text>
            <Text style={styles.small}>{COMPANY.address}</Text>
          </View>
          <View style={styles.fiscalBox}>
            <Text>RC : {COMPANY.rc}</Text>
            <Text>NIF : {COMPANY.nif}</Text>
            <Text>Tél : {COMPANY.phone}</Text>
          </View>
        </View>
        <View style={styles.rule} />

        <Text style={styles.title}>RELEVÉ DE COMPTE</Text>
        <Text style={styles.sub}>Exercice {statement.year}</Text>
        <Text style={styles.clientName}>{c.company_name}</Text>
        {c.address ? <Text style={styles.small}>{c.address}</Text> : null}
        {c.client_type === "entreprise" && c.rc ? <Text style={styles.small}>RC : {c.rc}</Text> : null}
        {c.client_type === "artisan" && c.carte_artisan ? <Text style={styles.small}>Carte d&apos;artisan : {c.carte_artisan}</Text> : null}

        <View style={styles.table}>
          <View style={styles.th}>
            <Text style={[styles.cDate, styles.thText]}>Date</Text>
            <Text style={[styles.cDes, styles.thText]}>Désignation</Text>
            <Text style={[styles.cQte, styles.thText]}>Qté</Text>
            <Text style={[styles.cPu, styles.thText]}>P.U</Text>
            <Text style={[styles.cAmt, styles.thText]}>Crédit</Text>
            <Text style={[styles.cAmt, styles.thText]}>Versement</Text>
            <Text style={[styles.cAmt, styles.thText]}>Solde</Text>
          </View>

          <View style={styles.trSub}>
            <Text style={styles.cDate}>01/01/{statement.year}</Text>
            <Text style={[styles.cDes, styles.bold]}>Report à nouveau</Text>
            <Text style={styles.cQte}>—</Text>
            <Text style={styles.cPu}>—</Text>
            <Text style={styles.cAmt}>—</Text>
            <Text style={styles.cAmt}>—</Text>
            <Text style={[styles.cAmt, styles.bold]}>{formatDZDPlain(statement.reportANouveau)}</Text>
          </View>

          {statement.events.map((e, i) => e.kind === "order" ? (
            <View key={i} wrap={false}>
              {e.lines.map((l, j) => (
                <View style={styles.tr} key={`${i}-${j}`}>
                  <Text style={styles.cDate}>{j === 0 ? formatDate(e.date) : ""}</Text>
                  <Text style={[styles.cDes, styles.muted]}>{l.designation}</Text>
                  <Text style={[styles.cQte, styles.muted]}>{formatNumberPlain(l.quantite, 0)}</Text>
                  <Text style={[styles.cPu, styles.muted]}>{formatNumberPlain(l.prix_unitaire, 2)}</Text>
                  <Text style={[styles.cAmt, styles.muted]}>{formatDZDPlain(l.total)}</Text>
                  <Text style={styles.cAmt} />
                  <Text style={styles.cAmt} />
                </View>
              ))}
              <View style={styles.trSub}>
                <Text style={styles.cDate}>{e.lines.length === 0 ? formatDate(e.date) : ""}</Text>
                <Text style={[styles.cDes, styles.bold]}>Total {e.docType === "facture" ? "Facture" : "Bon"} N° {e.numero}</Text>
                <Text style={styles.cQte} />
                <Text style={styles.cPu} />
                <Text style={[styles.cAmt, styles.bold]}>{formatDZDPlain(e.total)}</Text>
                <Text style={styles.cAmt} />
                <Text style={[styles.cAmt, styles.bold]}>{formatDZDPlain(e.balance)}</Text>
              </View>
            </View>
          ) : (
            <View style={styles.tr} key={i}>
              <Text style={styles.cDate}>{formatDate(e.date)}</Text>
              <Text style={styles.cDes}>{e.label}</Text>
              <Text style={styles.cQte} />
              <Text style={styles.cPu} />
              <Text style={styles.cAmt} />
              <Text style={styles.cAmt}>{formatDZDPlain(e.montant)}</Text>
              <Text style={styles.cAmt}>{formatDZDPlain(e.balance)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text>Total crédit {statement.year}</Text>
            <Text>{formatDZDPlain(statement.totalCredit)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text>Total versements {statement.year}</Text>
            <Text>{formatDZDPlain(statement.totalVersement)}</Text>
          </View>
          <View style={styles.totalFinal}>
            <Text style={styles.bold}>Solde à payer</Text>
            <Text style={styles.bold}>{formatDZDPlain(statement.soldeFinal)}</Text>
          </View>
        </View>

        <Text style={styles.footer} fixed>
          {COMPANY.bank} — RIB : {COMPANY.rib}   |   {COMPANY.name}
        </Text>
      </Page>
    </Document>
  );
}
