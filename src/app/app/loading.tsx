import { PageSkeleton } from "@/components/layout/skeleton";

export default function Loading() {
  return <PageSkeleton stats={4} rows={4} />;
}
