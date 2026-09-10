import { cn } from "@/lib/utils";

function Bar({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded bg-muted", className)} />;
}

/** Encabezado de pantalla mientras carga. */
export function HeaderSkeleton() {
  return (
    <div className="mb-6">
      <Bar className="h-3 w-24" />
      <Bar className="mt-2 h-8 w-64" />
      <Bar className="mt-2 h-3 w-96 max-w-full" />
    </div>
  );
}

export function StatsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-lg border bg-card px-4 py-3">
          <Bar className="h-2.5 w-20" />
          <Bar className="mt-2 h-6 w-24" />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="rounded-lg border bg-card">
      <div className="border-b px-3 py-3"><Bar className="h-3 w-40" /></div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 border-b px-3 py-3 last:border-0" style={{ opacity: 1 - i * 0.12 }}>
          <Bar className="h-3 w-24" />
          <Bar className="h-3 flex-1" />
          <Bar className="h-3 w-20" />
          <Bar className="h-3 w-16" />
        </div>
      ))}
    </div>
  );
}

export function CardsSkeleton({ count = 2 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-lg border bg-card p-5">
          <Bar className="h-4 w-40" />
          <Bar className="mt-3 h-3 w-full" />
          <Bar className="mt-2 h-3 w-5/6" />
          <Bar className="mt-2 h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}

/** Pantalla completa mientras carga: se ve el mismo esqueleto en todas las secciones. */
export function PageSkeleton({ stats = 4, rows = 6 }: { stats?: number; rows?: number }) {
  return (
    <>
      <HeaderSkeleton />
      {stats > 0 && <StatsSkeleton count={stats} />}
      <TableSkeleton rows={rows} />
    </>
  );
}
