import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Website, service-request, and messaging terms for Anchor Point One.",
  alternates: { canonical: "/terms" },
};

export default function TermsOfService() {
  return (
    <main className="legal">
      <header className="legal-header">
        <Link className="brand" href="/">
          <strong>Anchor Point One</strong>
          <span>RV Services &amp; Select Home Services</span>
        </Link>
        <Link href="/">Return to website</Link>
      </header>
      <article className="legal-content">
        <p className="eyebrow">Terms of Service</p>
        <h1>Website and messaging terms.</h1>
        <p className="legal-date">Effective September 13, 2026</p>

        <p>
          These terms apply to anchorpoint.help, service-request communications,
          and related services and messaging offered under the Anchor Point One
          brand.
        </p>

        <h2>Service requests</h2>
        <p>
          Submitting a request does not create an appointment, guarantee
          availability, establish a final price, or require Anchor Point One to
          perform work. Scope, location, timing, pricing, parts, and any
          applicable licensing or permit limitations must be confirmed before
          service.
        </p>
        <p>
          Sending an SMS or MMS, submitting a website form, or sharing photos
          or video is a request for review only. It does not authorize a paid
          diagnostic visit, repair, parts, or an appointment.
        </p>

        <h2>Pricing and approval</h2>
        <p>
          Current standard visit pricing and examples are published in our{" "}
          <Link href="/pricing-service-policy">Pricing &amp; Service Policy</Link>.
          Applicable scope, service-area eligibility, additional labor, parts,
          materials, extended travel, and appointment details are confirmed
          before paid service or added charges proceed.
        </p>

        <h2>Customer information</h2>
        <p>
          You agree to provide accurate contact and service information and to
          describe the issue honestly. Do not use the website for emergencies,
          unlawful requests, harassment, spam, or content that infringes the
          rights of others.
        </p>

        <h2>SMS messaging terms</h2>
        <p>
          If you check the SMS consent box, you agree to receive
          service-related text messages about your Anchor Point One request,
          including scheduling and follow-up. Message frequency varies. Message
          and data rates may apply. Reply STOP to unsubscribe or HELP for help.
          Consent is not a condition of purchase.
        </p>

        <p>
          Supported carriers are not liable for delayed or undelivered
          messages. You are responsible for charges imposed by your mobile
          provider and for keeping your phone number current. After opting out,
          you may still communicate by email or through your private request
          link.
        </p>

        <h2>Phone calls and voicemail</h2>
        <p>
          If you choose to leave a voicemail after the recorded notice, you
          consent to that voicemail being recorded and made available to the
          Anchor Point One service team for responding to your request. You may
          hang up and contact us by text or through the website instead.
        </p>

        <h2>Website availability</h2>
        <p>
          We work to keep the website and request records available, but the
          service may occasionally be interrupted or contain errors. The website
          is provided on an as-available basis to the extent permitted by law.
        </p>

        <h2>Privacy</h2>
        <p>
          Our collection and use of personal information are described in the{" "}
          <Link href="/privacy">Privacy Policy</Link>.
        </p>

        <h2>Changes and contact</h2>
        <p>
          We may update these terms as the website and communications service
          evolve. Continued use after an update means the revised terms apply.
          Questions may be sent to{" "}
          <a href="mailto:service@anchorpoint.help">service@anchorpoint.help</a>.
        </p>
      </article>
    </main>
  );
}
