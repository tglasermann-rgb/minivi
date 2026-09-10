import { PageSkeleton } from "@/components/layout/skeleton";

export default function Loading() {
  return <PageSkeleton stats={0} rows={6} />;
}
