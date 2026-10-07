import Link from "next/link";

export function PricingSummary({ compact = false }: { compact?: boolean }) {
  return (
    <section className={`pricing-summary ${compact ? "compact" : "section"}`} aria-labelledby="diagnostic-visit-price">
      <div>
        <p className="eyebrow light">Clear pricing before scheduling</p>
        <h2 id="diagnostic-visit-price">Diagnostic and Service Visit</h2>
        <p className="price"><strong>$150</strong><span>travel within our standard service area + up to 45 minutes onsite</span></p>
      </div>
      <div className="pricing-details">
        <p>The visit includes mobile travel within approximately 50 miles of Valrico and up to 45 minutes of onsite diagnostic or repair time. Exact location eligibility is confirmed before scheduling.</p>
        <p><strong>Additional time:</strong> $90 per hour, billed in 15-minute increments of $22.50, only after customer approval.</p>
        <p>Parts, materials, extended travel, and other approved charges are additional. There is no separate mobile, trip, or service-call fee.</p>
        <Link className="button light-outline" href="/pricing-service-policy">View Pricing &amp; Service Policy</Link>
      </div>
    </section>
  );
}
