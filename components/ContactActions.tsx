import Link from "next/link";
import { directSmsInquiriesEnabled, ServiceContext, smsHref } from "@/lib/site-config";

export function ContactActions({ context, className = "" }: { context: ServiceContext; className?: string }) {
  const label = context === "rv"
    ? "Text Us Your RV Issue — No Obligation"
    : "Text Us Your Home Service Request — No Obligation";

  return (
    <div className={`actions contact-actions ${className}`.trim()}>
      {directSmsInquiriesEnabled && <a className="button copper" href={smsHref(context)}>{label}</a>}
      <Link className={`button ${directSmsInquiriesEnabled ? "outline" : "copper"}`} href="/#request">Send Service Request</Link>
    </div>
  );
}
