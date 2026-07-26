import { PageHeader } from "@/components/layout/page-header";
import { SupabaseNotice } from "@/components/layout/supabase-notice";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { Employee, EmployeeBalance, SalaryEntry, Leave } from "@/lib/supabase/types";
import { SalairesView } from "./salaires-view";

export const metadata = { title: "Salaires · AscoSys" };

async function getData(): Promise<{
  employees: Employee[];
  balances: EmployeeBalance[];
  entries: SalaryEntry[];
  leaves: Leave[];
} | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const [{ data: employees }, { data: balances }, { data: entries }, { data: leaves }] =
    await Promise.all([
      supabase.from("employees").select("*").order("name"),
      supabase.from("employee_balance").select("*"),
      supabase.from("salary_entries").select("*").order("date", { ascending: false }),
      supabase.from("leaves").select("*").order("date", { ascending: false }),
    ]);
  return {
    employees: employees ?? [],
    balances: balances ?? [],
    entries: entries ?? [],
    leaves: leaves ?? [],
  };
}

export default async function SalairesPage() {
  const data = await getData();
  if (data === null) {
    return (
      <div className="space-y-7">
        <PageHeader title="Salaires" description="Salaires, avances et congés du personnel" />
        <SupabaseNotice />
      </div>
    );
  }
  return (
    <SalairesView
      employees={data.employees}
      balances={data.balances}
      entries={data.entries}
      leaves={data.leaves}
    />
  );
}
