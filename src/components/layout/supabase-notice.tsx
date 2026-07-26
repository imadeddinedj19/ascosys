import { Database } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

/** Affiché dans les modules quand Supabase n'est pas encore connecté. */
export function SupabaseNotice() {
  return (
    <Card className="border-warning/30 bg-warning/5">
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <span className="rounded-full border border-warning/30 bg-warning/10 p-3 text-warning">
          <Database className="size-6" />
        </span>
        <p className="text-sm font-medium text-warning">Base de données non connectée</p>
        <p className="max-w-md text-sm text-warning/80">
          Pour utiliser ce module, créez un projet Supabase, renseignez vos clés dans{" "}
          <code className="font-mono">.env.local</code>, puis exécutez{" "}
          <code className="font-mono">supabase/migrations/0001_init.sql</code>.
        </p>
      </CardContent>
    </Card>
  );
}
