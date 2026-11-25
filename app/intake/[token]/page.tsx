import type { Metadata } from "next";
import { RequestForm } from "@/components/RequestForm";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "Send a Service Request",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

export default async function IntakePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <main>
      <SiteHeader />
      <section className="request-section section">
        <div>
          <p className="eyebrow light">Short service request</p>
          <h1>Tell us what is happening.</h1>
          <p>Send a brief description of your RV issue and photos if helpful. There is no obligation.</p>
        </div>
        <RequestForm callToken={token} />
      </section>
      <SiteFooter />
    </main>
  );
}
