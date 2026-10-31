import { ApprovalDetail } from "@/components/approvals/ApprovalDetail";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ApprovalDetail key={id} id={id} />;
}
