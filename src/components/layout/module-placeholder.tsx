import { Construction } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";

export function ModulePlaceholder({ title, milestone }: { title: string; milestone: string }) {
  return (
    <div className="space-y-7">
      <PageHeader title={title} />
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <span className="rounded-full border border-border bg-surface-2 p-3 text-primary">
            <Construction className="size-6" />
          </span>
          <p className="text-sm font-medium text-foreground">Module en construction</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Ce module sera disponible prochainement ({milestone}).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
