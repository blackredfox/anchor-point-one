/* eslint-disable @next/next/no-img-element -- Gallery sources and the existing public assets are rendered directly by Sites. */
import type { Metadata } from "next";
import Link from "next/link";
import { ChatLauncher } from "@/components/ChatLauncher";
import { ContactActions } from "@/components/ContactActions";
import { MobileContactBar } from "@/components/MobileContactBar";
import { PricingSummary } from "@/components/PricingSummary";
import { RequestForm } from "@/components/RequestForm";
import { ReviewsSection } from "@/components/ReviewsSection";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { StructuredData } from "@/components/StructuredData";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Mobile RV Diagnostics & Repair Support in Tampa Bay",
  description: "Mobile RV diagnostics, inspections, maintenance and repair support, plus select minor home services in the Tampa Bay area.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Mobile RV Diagnostics & Repair Support in Tampa Bay | Anchor Point One",
    description: "Tell us what is happening. We review your request and recommend the most appropriate next step.",
    url: "/",
    type: "website",
  },
  twitter: { card: "summary", title: "Anchor Point One", description: "Mobile RV diagnostics and repair support in Tampa Bay." },
};

const rvSummary = ["Mobile RV Diagnostics", "RV Inspections & Owner Support", "Rooftop A/C Diagnostics", "Electrical & Power-System Concerns", "Plumbing & Water-System Concerns", "Roof, Seal & Water-Intrusion Service", "Seasonal Maintenance & New Owner Orientation"];
const homeSummary = ["TV mounting", "Furniture assembly", "Door and cabinet hardware", "Shelving", "Blinds", "Curtain rods", "Caulking", "Minor punch-list tasks"];
const steps = [
  "Tell us what is happening in a service request. Include your city/ZIP and photos or a short video if available.",
  "We review the information. You do not need to know what part is bad or what repair is needed.",
  "We recommend the next step and may request more information first.",
  "You decide whether to proceed. Initial contact does not obligate you to purchase service.",
  "If paid service is appropriate, we explain scope, pricing, and appointment details before scheduling.",
  "No additional labor, parts, materials, or other charges are added without your approval.",
];
const gallery = [
  { src: "https://drive.google.com/thumbnail?id=1aT1J7wDB4wtB2uSza9_LyQB7i_7XV2ph&sz=w1600", alt: "Technician checking an RV rooftop air conditioner with test equipment", title: "Roof A/C Diagnostics", category: "RV Service" },
  { src: "https://drive.google.com/thumbnail?id=18MU76gc_51xVErH1KwOhIyjWea_pYSUs&sz=w1600", alt: "Electrical diagnostic work with professional testing tools", title: "Electrical Diagnostics", category: "RV Service" },
  { src: "https://drive.google.com/thumbnail?id=1JkO7u2fzm3e9yO76-HzIzMcA4n8-GMSF&sz=w1600", alt: "Technician completing service work on an RV roof", title: "RV Roof Service", category: "RV Service" },
  { src: "https://drive.google.com/thumbnail?id=14doSWXKJOHOVSmNcf0LJEhYqrXS4WGmB&sz=w1600", alt: "Accessible PEX plumbing connections during RV service", title: "PEX Plumbing Service", category: "RV Service" },
  { src: "https://drive.google.com/thumbnail?id=1Ezvc8T4HQMDiO_PQv0NM0uIYvWkzV1ew&sz=w1600", alt: "RV water pump being inspected during mobile service", title: "Water Pump Service", category: "RV Service" },
  { src: "https://drive.google.com/thumbnail?id=1m_UKM5cu_krG2htW6LCAtn53HfeyGSVW&sz=w1600", alt: "Completed localized resealing work on an RV roof", title: "Roof Resealing", category: "RV Service" },
  { src: "https://drive.google.com/thumbnail?id=1UeQN0KLr-W3FYZdp6AR-Ovz38UsoKw-T&sz=w1600", alt: "RV roof vent replacement in progress", title: "Roof Vent Service", category: "RV Service" },
];

export default function Home() {
  return (
    <main>
      <StructuredData value={{
        "@context": "https://schema.org",
        "@type": "LocalBusiness",
        name: siteConfig.name,
        url: siteConfig.url,
        telephone: siteConfig.phoneE164,
        email: siteConfig.email,
        areaServed: siteConfig.serviceArea,
        address: { "@type": "PostalAddress", addressLocality: "Valrico", addressRegion: "FL", addressCountry: "US" },
        description: "Mobile RV diagnostics, inspections, maintenance and repair support, plus select minor home services.",
      }} />
      <SiteHeader />

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">Valrico, Florida · Approximately 50-mile service area</p>
          <h1>Mobile RV Diagnostics, Inspections &amp; Repair Support in Tampa Bay</h1>
          <p className="lead">Not sure what is wrong with your RV? You do not need to guess, diagnose the issue yourself, or know what part needs replacement.</p>
          <p>Send your city/ZIP, a short description, and photos or a short video if available. We will review the information, let you know whether we can help, and explain the most appropriate next step.</p>
          <p><strong>No obligation just for reaching out.</strong></p>
          <ContactActions context="rv" />
          <small className="support-text">If an on-site visit or detailed diagnostic support is recommended, we explain the available options and any fees before paid work begins.</small>
        </div>
        <div className="hero-photo">
          <img src="/hero-neutral-mobile-service.png" alt="Mobile service technician at a Tampa Bay property with an organized service van" />
          <div className="photo-note"><small>We come to you</small><strong>Valrico + approximately 50 miles</strong></div>
        </div>
      </section>

      <div className="trust"><span>Request review first</span><span>Mobile convenience</span><span>Clear next steps</span><span>Approval before added work</span></div>

      <section className="section" id="services">
        <div className="section-head"><div><p className="eyebrow">Primary service</p><h2>Mobile RV Services</h2></div><p>Anchor Point One provides RV diagnostics, inspections, maintenance, and repair support at homes, RV parks, campgrounds, storage locations, and businesses within the available service area.</p></div>
        <article className="service-card dark featured-service"><div className="service-list">{rvSummary.map((item) => <span key={item}>{item}</span>)}</div><Link className="button light-outline" href="/rv-services">Explore RV Services</Link></article>
        <div className="section-head secondary-heading"><div><p className="eyebrow">Also available</p><h2>Select Minor Home Services</h2></div><p>Practical, non-structural support for Tampa Bay homeowners, landlords, and property managers.</p></div>
        <article className="service-card cream"><div className="service-list">{homeSummary.map((item) => <span key={item}>{item}</span>)}</div><Link className="button outline" href="/home-services">Explore Home Services</Link></article>
      </section>

      <section className="section gallery-section" id="gallery">
        <div className="section-head"><div><p className="eyebrow">Real work. Real experience.</p><h2>RV &amp; Home Service Gallery</h2></div><p>Real RV diagnostics, maintenance, and repair-support work completed with care. Public items outside the current service scope have been removed.</p></div>
        <div className="gallery-grid">{gallery.map((item, index) => <figure className={index === 0 || index === 3 ? "featured" : ""} key={item.src}><img src={item.src} alt={item.alt} loading={index < 2 ? "eager" : "lazy"} /><figcaption><small>{item.category}</small><strong>{item.title}</strong></figcaption></figure>)}</div>
        <ContactActions context="rv" className="center-actions" />
      </section>

      <section className="section cream-bg" id="process">
        <div className="section-head"><div><p className="eyebrow">Simple from the start</p><h2>How It Works</h2></div><p>Tell us what is happening. We review it. We recommend the next step. You decide whether to proceed.</p></div>
        <div className="steps six-steps">{steps.map((step, index) => <article key={step}><span>{String(index + 1).padStart(2, "0")}</span><p>{step}</p></article>)}</div>
        <ContactActions context="rv" className="center-actions" />
      </section>

      <section className="trust-panel section">
        <div><p className="eyebrow light">What to expect</p><h2>Clear Communication. Mobile Convenience. No Surprise Repairs.</h2></div>
        <ul><li>We review your request before recommending a service.</li><li>We explain service options and fees before paid work begins.</li><li>We explain recommended repairs before continuing.</li><li>We obtain approval before additional labor or parts are used.</li></ul>
      </section>

      <section className="faq-home section" id="faq">
        <div>
          <p className="eyebrow">Helpful answers</p>
          <h2>Frequently Asked Questions</h2>
          <p>Find answers about contacting us, pricing, RV and home services, photos and videos, and what happens after you send a request.</p>
          <Link className="button outline" href="/faq">View All Frequently Asked Questions</Link>
        </div>
      </section>

      <section className="about" id="about">
        <div className="about-copy">
          <p className="eyebrow light">About Anchor Point One</p><h2>Experience you can rely on.</h2>
          <p>With over 8 years of hands-on technical experience, we provide reliable mobile RV services and select minor home services within the available area around Valrico.</p>
          <p>Our focus includes RV inspections, diagnostics, maintenance, and repair support, along with practical non-structural home tasks that fit our available scope.</p>
          <p>Our goal is simple: honest recommendations, quality workmanship, fair communication, and dependable service. We take pride in doing the job right and treating every customer&apos;s property with care and respect.</p>
          <Link href="#request">Start a service request →</Link>
        </div>
        <aside className="owner-profile"><div className="owner-photo"><img src="/andre-owner.png" alt="Andrei, owner and mobile service technician at Anchor Point One" /></div><div className="owner-caption"><small>Meet Andrei</small><strong>Andrei — Owner &amp; Mobile Service Technician</strong><span>Over 8 years of hands-on technical experience</span></div><div className="about-stats"><p><strong>Approximately 50 miles</strong><span>Current service radius from Valrico; availability confirmed before scheduling</span></p><p><strong>RV first</strong><span>Diagnostics, inspections, maintenance, and repair support</span></p><p><strong>1 direct contact</strong><span>No call-center handoffs</span></p></div></aside>
      </section>

      <PricingSummary />

      <ReviewsSection />

      <section className="request-section section" id="request">
        <div><p className="eyebrow light">Request review</p><h2>Not Sure What Service You Need?</h2><h3 className="request-subhead">You do not need to diagnose the problem yourself.</h3><p>Send your RV issue, city/ZIP, and photos or a short video with the structured service request form. We review the information and recommend the most appropriate next step before you commit to paid service.</p><ContactActions context="rv" /><p>Submitting this form does not schedule service or commit you to paid work.</p><div className="area"><small>Service area</small><strong>Within approximately 50 miles of Valrico, Florida</strong><p>Final availability depends on location, scope, access, and any licensing or permit requirements.</p></div></div>
        <RequestForm />
      </section>

      <SiteFooter />
      <MobileContactBar context="rv" />
      <ChatLauncher />
    </main>
  );
}
