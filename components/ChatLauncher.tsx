import { directSmsInquiriesEnabled, smsHref } from "@/lib/site-config";

export function ChatLauncher() {
  if (!directSmsInquiriesEnabled) return null;
  return <div className="launcher"><a className="chatbutton" href={smsHref("rv")}>Text Us Your RV Issue</a></div>;
}
