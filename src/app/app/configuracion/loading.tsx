import { HeaderSkeleton, CardsSkeleton } from "@/components/layout/skeleton";

export default function Loading() {
  return (
    <>
      <HeaderSkeleton />
      <CardsSkeleton count={3} />
    </>
  );
}
