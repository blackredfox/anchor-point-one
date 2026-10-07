import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Privacy practices for Anchor Point One service requests and communications.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPolicy() {
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
        <p className="eyebrow">Privacy Policy</p>
        <h1>How we handle your information.</h1>
        <p className="legal-date">Effective September 13, 2026</p>

        <p>
          This policy explains how Anchor Point One collects, uses, and
          protects information submitted through anchorpoint.help.
        </p>

        <h2>Information we collect</h2>
        <p>
          When you request service, we collect the information you provide,
          including your name, mobile phone number, optional email address, city,
          ZIP code, preferred contact method, service category, request
          description, optional RV type or equipment details, photos, short
          videos, messages, voicemail recordings, call metadata, and SMS consent
          choice. We also retain
          service-request status and communication history so we can respond
          and coordinate service.
        </p>

        <h2>Phone calls and voicemail</h2>
        <p>
          When you call our business number, we may collect the calling phone
          number, call timestamps and status, and any voicemail you choose to
          leave. The greeting tells you before recording begins. We associate
          the call and recording with the applicable service-request thread so
          our service team can review and respond. Voicemail transcription is
          used only if that optional feature is enabled.
        </p>

        <h2>How we use information</h2>
        <p>
          We use your information to evaluate and respond to requests, confirm
          service scope and availability, schedule work, provide service-related
          updates, maintain business records, prevent misuse, and operate and
          improve the website.
        </p>

        <h2>Text messaging</h2>
        <p>
          If you voluntarily opt in, we may send service-related text messages
          about your Anchor Point One request, including scheduling and follow-up.
          Message frequency varies. Message and data rates may apply. Reply STOP
          to opt out or HELP for help. Consent to text messages is not a
          condition of purchase.
        </p>
        <p>
          When you initiate a text or media message to our business number, we
          collect the sending phone number, message content, attached media,
          timestamps, delivery information, and related conversation history so
          we can review and respond to the request. Incoming SMS and MMS
          messages are associated with the applicable service-request thread.
        </p>
        <p>
          Mobile opt-in information and consent are not sold or shared with
          third parties for their own marketing or promotional purposes. We may
          share information with service providers only as needed to deliver
          requested communications and operate the service.
        </p>

        <h2>Service providers and disclosures</h2>
        <p>
          We use service providers for website hosting, database storage, email,
          and text-message delivery. They process information on our behalf
          under their own security and privacy obligations. We may also disclose
          information when required by law, to protect rights or safety, or in
          connection with a legitimate business transfer.
        </p>

        <h2>Retention and security</h2>
        <p>
          We retain service-request records for as long as reasonably necessary
          for customer service, operations, legal obligations, and dispute
          resolution. We use reasonable administrative and technical safeguards,
          but no internet transmission or storage system can be guaranteed
          completely secure.
        </p>

        <h2>Your choices</h2>
        <p>
          You may decline SMS consent and still submit a service request. You
          may opt out of text messages at any time by replying STOP. To ask about
          your information, request a correction, or request deletion where
          applicable, email{" "}
          <a href="mailto:service@anchorpoint.help">service@anchorpoint.help</a>.
        </p>

        <h2>Updates and contact</h2>
        <p>
          We may update this policy as the service changes. The effective date
          above will show the latest revision. Questions may be sent to{" "}
          <a href="mailto:service@anchorpoint.help">service@anchorpoint.help</a>.
        </p>
      </article>
    </main>
  );
}
