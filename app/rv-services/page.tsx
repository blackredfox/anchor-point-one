import type { Metadata } from "next";
import { ContactActions } from "@/components/ContactActions";
import { ConversionBlock } from "@/components/ConversionBlock";
import { MobileContactBar } from "@/components/MobileContactBar";
import { PricingSummary } from "@/components/PricingSummary";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { StructuredData } from "@/components/StructuredData";
import { rvServices } from "@/lib/public-content";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Mobile RV Diagnostics & Repair Support in Tampa Bay",
  description: "Mobile RV diagnostics, inspections, maintenance, A/C, electrical, plumbing, roof-seal and water-intrusion support in Tampa Bay. Send your RV issue and photos to Anchor Point One.",
  alternates: { canonical: "/rv-services" },
  openGraph: { title: "Mobile RV Diagnostics & Repair Support in Tampa Bay | Anchor Point One", description: "Mobile RV diagnostics, inspections, maintenance and repair support in Tampa Bay.", url: "/rv-services", type: "website" },
  twitter: { card: "summary", title: "Mobile RV Services | Anchor Point One", description: "Mobile RV diagnostics and repair support in Tampa Bay." },
};

export default function RvServicesPage() {
  return <main>
    <StructuredData value={{ "@context": "https://schema.org", "@type": "Service", name: "Mobile RV Diagnostics, Inspections & Repair Support", provider: { "@type": "LocalBusiness", name: siteConfig.name, url: siteConfig.url }, areaServed: siteConfig.serviceArea, serviceType: rvServices.map((service) => service.title) }} />
    <SiteHeader />
    <section className="inner-hero"><p className="eyebrow">Mobile service · Tampa Bay</p><h1>Mobile RV Diagnostics, Inspections &amp; Repair Support in Tampa Bay</h1><p>Not sure what is wrong with your RV? You do not need to identify a failed part before contacting us. Send the symptom, city/ZIP, RV details, and photos or a short video if available. We review the information and recommend the most appropriate next step.</p><p><strong>No obligation just for reaching out.</strong></p><ContactActions context="rv" /><small>If an on-site visit or detailed diagnostic support is recommended, available scope and fees are explained before paid work begins.</small></section>
    <PricingSummary compact />
    <section className="section service-page"><div className="section-head"><div><p className="eyebrow">Available support</p><h2>Start with the symptom.</h2></div><p>Service scope is confirmed before scheduling. Photos or video help us understand the request but do not guarantee a diagnosis without testing.</p></div><div className="detail-grid">{rvServices.map((service, index) => <article className="detail-card" key={service.title}><span>{String(index + 1).padStart(2, "0")}</span><h2>{service.title}</h2><p>{service.intro}</p>{service.items && <ul>{service.items.map((item) => <li key={item}>{item}</li>)}</ul>}{service.notes?.map((note) => <p className="scope-note" key={note}>{note}</p>)}</article>)}</div></section>
    <ConversionBlock context="rv" />
    <SiteFooter />
    <MobileContactBar context="rv" />
  </main>;
}
