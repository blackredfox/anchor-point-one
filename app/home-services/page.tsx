import type { Metadata } from "next";
import { ContactActions } from "@/components/ContactActions";
import { ConversionBlock } from "@/components/ConversionBlock";
import { MobileContactBar } from "@/components/MobileContactBar";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { StructuredData } from "@/components/StructuredData";
import { homeServices } from "@/lib/public-content";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Minor Home Services in Tampa Bay | TV Mounting, Assembly, Hardware & Caulking",
  description: "Select minor home services in Tampa Bay, including TV mounting, furniture assembly, door and cabinet hardware, shelving, blinds, curtain rods, mailboxes, caulking and punch-list tasks.",
  alternates: { canonical: "/home-services" },
  openGraph: { title: "Select Minor Home Services in Tampa Bay | Anchor Point One", description: "Practical, non-structural home services in Tampa Bay.", url: "/home-services", type: "website" },
  twitter: { card: "summary", title: "Minor Home Services | Anchor Point One", description: "Select minor home services in Tampa Bay." },
};

export default function HomeServicesPage() {
  return <main>
    <StructuredData value={{ "@context": "https://schema.org", "@type": "Service", name: "Select Minor Home Services", provider: { "@type": "LocalBusiness", name: siteConfig.name, url: siteConfig.url }, areaServed: siteConfig.serviceArea, serviceType: homeServices.map((service) => service.title) }} />
    <SiteHeader />
    <section className="inner-hero home-tone"><p className="eyebrow">Secondary service category</p><h1>Select Minor Home Services in Tampa Bay</h1><p>Anchor Point One provides select minor home services, assembly, mounting, hardware installation, caulking, sealing, and basic home punch-list support.</p><p>We focus on practical, non-structural tasks that can be completed safely and efficiently. Send photos or a short video and your city/ZIP so we can confirm whether the requested work is within our available service scope.</p><p><strong>No obligation just for reaching out.</strong></p><ContactActions context="home" /></section>
    <section className="section service-page"><div className="section-head"><div><p className="eyebrow">Available support</p><h2>Practical tasks, clearly scoped.</h2></div><p>Customer-supplied items, wall type, access, hardware, and requested location are reviewed before service is confirmed.</p></div><div className="detail-grid home-detail-grid">{homeServices.map((service, index) => <article className="detail-card" key={service.title}><span>{String(index + 1).padStart(2, "0")}</span><h2>{service.title}</h2><p>{service.intro}</p>{service.notes?.map((note) => <p className="scope-note" key={note}>{note}</p>)}</article>)}</div></section>
    <section className="scope-section section"><div><p className="eyebrow light">Service scope &amp; safety</p><h2>Some projects require a specialist.</h2></div><p>Anchor Point One does not modify building electrical wiring, install or alter circuits, modify plumbing systems, perform HVAC or refrigerant work, perform regulated roofing or ventilation work, alter structural components, or complete permitted work unless separately qualified and authorized for that specific scope. We confirm availability after reviewing the details.</p></section>
    <ConversionBlock context="home" />
    <SiteFooter />
    <MobileContactBar context="home" />
  </main>;
}
