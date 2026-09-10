import { HeaderSkeleton, CardsSkeleton, TableSkeleton } from "@/components/layout/skeleton";

export default function Loading() {
  return (
    <>
      <HeaderSkeleton />
      <div className="mb-6"><CardsSkeleton count={2} /></div>
      <TableSkeleton rows={5} />
    </>
  );
}
