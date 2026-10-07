import type { Metadata } from "next";
import Link from "next/link";
import { requireChatGPTUser } from "@/app/chatgpt-auth";
import { getAdminIdentity } from "@/lib/admin";
import { OwnerDashboard } from "@/components/OwnerDashboard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Owner Desk",
  robots: { index: false, follow: false },
};

type PageProps = {
  searchParams: Promise<{ request?: string | string[] }>;
};

const requestIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function OwnerContent({ requestId, returnTo }: { requestId: string; returnTo: string }) {
  const user = await requireChatGPTUser(returnTo);
  const admin = await getAdminIdentity();
  if (!admin) {
    return <main className="center"><div>
      <p className="eyebrow">Anchor Point One Owner Desk</p>
      <h1>Owner access is not enabled for this account.</h1>
      <p>Signed in as {user.email}. This address must be added to the approved owner list.</p>
      <Link className="button outline" href="/">Return to Website</Link>
    </div></main>;
  }
  return <OwnerDashboard initialRequestId={requestId} />;
}

export default async function Page({ searchParams }: PageProps) {
  const requested = (await searchParams).request;
  const candidate = Array.isArray(requested) ? requested[0] : requested;
  const requestId = candidate && requestIdPattern.test(candidate) ? candidate : "";
  const returnTo = requestId ? `/owner?request=${encodeURIComponent(requestId)}` : "/owner";
  return <OwnerContent requestId={requestId} returnTo={returnTo} />;
}
