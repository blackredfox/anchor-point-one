export const siteConfig = {
  name: "Anchor Point One",
  descriptor: "RV Services & Select Home Services",
  url: "https://anchorpoint.help",
  email: "service@anchorpoint.help",
  phoneE164: "+18134413696",
  phoneDisplay: "(813) 441-3696",
  serviceArea: "Within approximately 50 miles of Valrico, Florida",
} as const;

// Keep the new website-to-SMS acquisition flow off until the matching Twilio
// A2P message flow and samples have been approved. Existing request follow-ups
// by SMS continue to work independently of this flag.
export const directSmsInquiriesEnabled = false;

export type ServiceContext = "rv" | "home";

const smsTemplates: Record<ServiceContext, string> = {
  rv: [
    "Hi Anchor Point One,",
    "I need help with my RV.",
    "City / ZIP:",
    "RV year / make / model:",
    "What is happening:",
  ].join("\n"),
  home: [
    "Hi Anchor Point One,",
    "I need help with a home service request.",
    "City / ZIP:",
    "Service needed:",
    "Brief description:",
  ].join("\n"),
};

export function smsHref(context: ServiceContext, reference = "") {
  const suffix = reference ? `\nRequest reference: ${reference}` : "";
  return `sms:${siteConfig.phoneE164}?&body=${encodeURIComponent(`${smsTemplates[context]}${suffix}`)}`;
}
