import Link from "next/link";
import { siteConfig } from "@/lib/site-config";

export function SiteFooter() {
  return (
    <footer>
      <div className="footer-brand">
        <div className="brand">
          <strong>{siteConfig.name}</strong>
          <span>{siteConfig.descriptor}</span>
        </div>
        <p>Based in Valrico, Florida — serving locations within approximately 50 miles. Service availability is confirmed before scheduling.</p>
        <a href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a>
        <Link className="button copper" href="/#request">Send a Service Request</Link>
        <small>No obligation just for reaching out.</small>
      </div>
      <nav aria-label="Footer navigation">
        <Link href="/#reviews">Customer Feedback</Link>
        <Link href="/faq">FAQ</Link>
        <Link href="/pricing-service-policy">Pricing &amp; Service Policy</Link>
        <Link href="/#about">About</Link>
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
      </nav>
    </footer>
  );
}
