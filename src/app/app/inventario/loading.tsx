import { PageSkeleton } from "@/components/layout/skeleton";

export default function Loading() {
  return <PageSkeleton stats={5} rows={8} />;
}
