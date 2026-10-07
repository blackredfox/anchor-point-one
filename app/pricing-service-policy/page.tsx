import type { Metadata } from "next";
import Link from "next/link";
import { ContactActions } from "@/components/ContactActions";
import { MobileContactBar } from "@/components/MobileContactBar";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { StructuredData } from "@/components/StructuredData";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "RV Diagnostic Visit Pricing & Service Policy",
  description: "Anchor Point One RV Diagnostic and Service Visit pricing: $150 includes standard-area travel and up to 45 minutes onsite, with additional time billed in 15-minute increments after approval.",
  alternates: { canonical: "/pricing-service-policy" },
  openGraph: { title: "RV Service Pricing | Anchor Point One", description: "$150 includes standard-area mobile travel and up to 45 minutes onsite.", url: "/pricing-service-policy", type: "website" },
  twitter: { card: "summary", title: "RV Service Pricing | Anchor Point One", description: "$150 includes standard-area mobile travel and up to 45 minutes onsite." },
};

const examples = [
  ["Up to 45 minutes onsite", "$150.00"],
  ["Up to 60 minutes onsite", "$172.50"],
  ["Up to 75 minutes onsite", "$195.00"],
  ["Up to 90 minutes onsite", "$217.50"],
  ["Up to 105 minutes onsite", "$240.00"],
  ["Up to 120 minutes onsite", "$262.50"],
] as const;

export default function PricingServicePolicyPage() {
  return <main>
    <StructuredData value={{ "@context": "https://schema.org", "@type": "Service", name: "Diagnostic and Service Visit", provider: { "@type": "LocalBusiness", name: siteConfig.name, url: siteConfig.url }, areaServed: siteConfig.serviceArea, offers: { "@type": "Offer", price: "150", priceCurrency: "USD", description: "Mobile travel within the standard service area and up to 45 minutes of onsite diagnostic or repair time." } }} />
    <SiteHeader />
    <section className="inner-hero compact"><p className="eyebrow">RV service pricing</p><h1>Pricing &amp; Service Policy</h1><p>The first message or service request is free and does not create a paid appointment. We review the information, recommend the next step, and explain applicable pricing before you decide whether to proceed.</p><ContactActions context="rv" /><div className="actions"><Link className="button outline" href="/">Back to Home</Link></div></section>
    <section className="section pricing-policy">
      <div className="section-head"><div><p className="eyebrow">Standard visit</p><h2>Diagnostic and Service Visit — $150</h2></div><p>The $150 visit includes mobile travel within our standard service area and up to 45 minutes of onsite diagnostic or repair time. There is no separate mobile fee, trip fee, or service-call fee.</p></div>
      <div className="pricing-policy-grid">
        <article><h2>What is included</h2><ul><li>Mobile travel within approximately 50 miles of Valrico, subject to location confirmation</li><li>Up to 45 minutes onsite</li><li>Diagnostic or repair work that can reasonably be completed in that time</li><li>An explanation of what was found</li><li>A recommended next step when more work is needed</li></ul></article>
        <article><h2>Additional time</h2><p>Additional onsite time after the included 45 minutes is $90 per hour and is billed in 15-minute increments.</p><p><strong>Each additional 15 minutes is $22.50.</strong></p><p>Additional labor continues only after customer approval.</p></article>
      </div>
      <div className="pricing-table-wrap"><table className="pricing-table"><caption>Examples of onsite visit totals</caption><thead><tr><th scope="col">Onsite time</th><th scope="col">Visit total</th></tr></thead><tbody>{examples.map(([time, price]) => <tr key={time}><td>{time}</td><td>{price}</td></tr>)}</tbody></table></div>
      <div className="pricing-notes"><h2>Parts, materials &amp; travel</h2><p>Parts, materials, extended travel, and other approved charges are additional. No additional labor, part, material, travel, or other charge is added without customer approval.</p><p>The standard service area is the current service area within approximately 50 miles of Valrico, Florida. Exact availability and any extended-travel charge are confirmed before scheduling.</p><h2>Scheduling</h2><p>Sending an SMS, submitting a service request, or sharing photos or video does not schedule a visit or authorize paid work. If an onsite visit is appropriate, scope, price, location, and appointment details are confirmed first.</p></div>
    </section>
    <section className="faq-conversion"><h2>Tell us what is happening.</h2><p>You do not need to diagnose the problem. We will review the information, recommend the next step, and explain applicable pricing before you decide.</p><ContactActions context="rv" /></section>
    <SiteFooter />
    <MobileContactBar context="rv" />
  </main>;
}
