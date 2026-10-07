import Link from "next/link";
import { directSmsInquiriesEnabled, ServiceContext, smsHref } from "@/lib/site-config";

export function MobileContactBar({ context = "rv" }: { context?: ServiceContext }) {
  return (
    <nav className="mobile-contact-bar" aria-label="Quick contact">
      {directSmsInquiriesEnabled && <a href={smsHref(context)}>{context === "rv" ? "Text RV Issue" : "Text Home Request"}</a>}
      <Link href="/#request">Send Service Request</Link>
    </nav>
  );
}
