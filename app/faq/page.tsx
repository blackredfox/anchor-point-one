import type { Metadata } from "next";
import { ContactActions } from "@/components/ContactActions";
import { FaqAccordion } from "@/components/FaqAccordion";
import { MobileContactBar } from "@/components/MobileContactBar";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { StructuredData } from "@/components/StructuredData";
import { faqGroups, faqItems } from "@/lib/public-content";

export const metadata: Metadata = {
  title: "RV Service & Minor Home Service FAQ",
  description: "Answers about Anchor Point One mobile RV diagnostics, inspections, scheduling, service scope, photos, and select minor home services in Tampa Bay.",
  alternates: { canonical: "/faq" },
  openGraph: { title: "RV Service & Minor Home Service FAQ | Anchor Point One", description: "Answers about mobile RV and select minor home service requests.", url: "/faq", type: "website" },
  twitter: { card: "summary", title: "Service FAQ | Anchor Point One", description: "Mobile RV and select minor home service answers." },
};

export default function FaqPage() {
  return <main>
    <StructuredData value={{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqItems.map(([question, answer]) => ({ "@type": "Question", name: question, acceptedAnswer: { "@type": "Answer", text: answer } })) }} />
    <SiteHeader />
    <section className="inner-hero compact"><p className="eyebrow">Before you schedule</p><h1>Frequently Asked Questions</h1><p>Start with what you know and use the service request form. We review the information and explain the next step before any paid service begins.</p><ContactActions context="rv" /></section>
    <section className="section"><FaqAccordion groups={faqGroups} /></section>
    <section className="faq-conversion"><h2>Still not sure what is wrong?</h2><p>Send the symptom, city/ZIP, and any useful photos or a short video. Reaching out does not schedule or authorize paid work.</p><ContactActions context="rv" /></section>
    <SiteFooter />
    <MobileContactBar context="rv" />
  </main>;
}
