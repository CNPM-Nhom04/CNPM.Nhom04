import { ApprovalList } from "@/components/approvals/ApprovalList";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ versionId?: string }>;
}) {
  const { versionId } = await searchParams;
  return <ApprovalList versionId={versionId} />;
}
