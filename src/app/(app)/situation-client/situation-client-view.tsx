"use client";

import { Fragment, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Scale, TrendingUp, Wallet } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty,
} from "@/components/ui/table";
import { formatDZD, formatNumber, formatDate } from "@/lib/format";
import type { Client } from "@/lib/supabase/types";
import type { ClientStatement } from "@/lib/data/statement";

export function SituationClientView({
  clients, selectedClientId, year, statement,
}: {
  clients: Client[];
  selectedClientId: string;
  year: number;
  statement: ClientStatement | null;
}) {
  const router = useRouter();
  const clientOptions = useMemo(() => clients.map((c) => ({ value: c.id, label: c.company_name })), [clients]);
  const years = statement?.years?.length ? statement.years : [year, year - 1, year - 2];

  function go(clientId: string, y: number) {
    if (!clientId) { router.push(`/situation-client`); return; }
    router.push(`/situation-client?client=${clientId}&year=${y}`);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Situation client"
        description="Relevé de compte : commandes détaillées et versements dans l'ordre chronologique"
        actions={
          statement ? (
            <Link href={`/situation-client/pdf?client=${selectedClientId}&year=${year}`} target="_blank">
              <Button variant="secondary" size="sm"><FileText className="size-4" /> Relevé PDF</Button>
            </Link>
          ) : undefined
        }
      />

      <Card>
        <CardContent className="grid gap-4 pt-5 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <Label htmlFor="client">Client</Label>
            <Combobox
              id="client"
              value={selectedClientId}
              onChange={(v) => go(v, year)}
              options={clientOptions}
              placeholder="— Sélectionner un client —"
              searchPlaceholder="Rechercher un client…"
            />
          </div>
          <div>
            <Label htmlFor="year">Année</Label>
            <Select id="year" value={String(year)} onChange={(e) => go(selectedClientId, Number(e.target.value))} disabled={!selectedClientId}>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </Select>
          </div>
        </CardContent>
      </Card>

      {!statement ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Sélectionnez un client pour afficher sa situation.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label={`Total crédit (${year})`} value={formatDZD(statement.totalCredit)} icon={TrendingUp} />
            <StatCard label={`Versements (${year})`} value={formatDZD(statement.totalVersement)} icon={Wallet} accent="success" />
            <StatCard label="Solde final" value={formatDZD(statement.soldeFinal)} icon={Scale} accent={statement.soldeFinal > 0 ? "warning" : "success"} />
          </div>

          <Card>
            <CardContent className="pt-5">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Désignation</TableHead>
                    <TableHead className="text-right">Qté</TableHead>
                    <TableHead className="text-right">P.U</TableHead>
                    <TableHead className="text-right">Crédit</TableHead>
                    <TableHead className="text-right">Versement</TableHead>
                    <TableHead className="text-right">Solde</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="text-muted-foreground" colSpan={6}>Report à nouveau au 1ᵉʳ janvier {year}</TableCell>
                    <TableCell className="text-right font-medium">{formatDZD(statement.reportANouveau)}</TableCell>
                  </TableRow>

                  {statement.events.length === 0 ? (
                    <TableEmpty colSpan={7}>Aucun mouvement en {year}.</TableEmpty>
                  ) : statement.events.map((e, i) => e.kind === "order" ? (
                    <Fragment key={i}>
                      {e.lines.map((l, j) => (
                        <TableRow key={`${i}-${j}`} className="border-b-0">
                          <TableCell className="text-muted-foreground">{j === 0 ? formatDate(e.date) : ""}</TableCell>
                          <TableCell className="text-muted">{l.designation}</TableCell>
                          <TableCell className="text-right text-muted">{formatNumber(l.quantite, 0)}</TableCell>
                          <TableCell className="text-right text-muted">{formatNumber(l.prix_unitaire, 2)}</TableCell>
                          <TableCell className="text-right text-muted">{formatDZD(l.total)}</TableCell>
                          <TableCell />
                          <TableCell />
                        </TableRow>
                      ))}
                      <TableRow className="bg-surface-2/50">
                        <TableCell>{e.lines.length === 0 ? formatDate(e.date) : ""}</TableCell>
                        <TableCell className="font-semibold text-foreground">Total {e.docType === "facture" ? "Facture" : "Bon"} N° {e.numero}</TableCell>
                        <TableCell />
                        <TableCell />
                        <TableCell className="text-right font-semibold text-foreground">{formatDZD(e.total)}</TableCell>
                        <TableCell />
                        <TableCell className="text-right font-semibold text-foreground">{formatDZD(e.balance)}</TableCell>
                      </TableRow>
                    </Fragment>
                  ) : (
                    <TableRow key={i}>
                      <TableCell className="text-muted whitespace-nowrap">{formatDate(e.date)}</TableCell>
                      <TableCell className="font-medium text-success">{e.label}</TableCell>
                      <TableCell />
                      <TableCell />
                      <TableCell />
                      <TableCell className="text-right font-medium text-success">{formatDZD(e.montant)}</TableCell>
                      <TableCell className="text-right font-medium text-foreground">{formatDZD(e.balance)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
