import { HeaderSkeleton, StatsSkeleton, CardsSkeleton } from "@/components/layout/skeleton";

export default function Loading() {
  return (
    <>
      <HeaderSkeleton />
      <StatsSkeleton count={4} />
      <CardsSkeleton count={2} />
    </>
  );
}
