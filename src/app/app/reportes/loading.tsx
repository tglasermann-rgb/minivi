import { PageSkeleton } from "@/components/layout/skeleton";

export default function Loading() {
  return <PageSkeleton stats={6} rows={6} />;
}
