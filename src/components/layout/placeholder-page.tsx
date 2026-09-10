import { PageHeader } from "./page-header";
import { Card, CardContent } from "@/components/ui/card";

export function PlaceholderPage({ title, phase, description }: { title: string; phase: number; description: string }) {
  return (
    <>
      <PageHeader eyebrow={`Fase ${phase}`} title={title} description={description} />
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
          <p className="font-display text-lg">Todavía no está construido.</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Esta sección llega en la fase {phase} del plan (ver <code className="font-mono">docs/PLAN.md</code>).
          </p>
        </CardContent>
      </Card>
    </>
  );
}
