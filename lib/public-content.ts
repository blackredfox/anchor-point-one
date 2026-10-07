export type ServiceSection = {
  title: string;
  intro: string;
  items?: string[];
  notes?: string[];
};

export const rvServices: ServiceSection[] = [
  {
    title: "Mobile RV Diagnostics",
    intro: "We provide practical on-site diagnostic support for common RV concerns. You do not need to identify the failed part before contacting us. We start with the reported symptom, assess accessible systems, and explain recommended next steps before additional work or parts are approved.",
    items: ["No power or intermittent power", "Battery or charging concerns", "Shore-power, fuse, breaker, switch, or control concerns", "A/C runs but does not cool", "Water leaks or low water pressure", "Water pump, faucet, toilet, fitting, or plumbing concerns", "Roof-seal and water-entry concerns", "Slide-out, awning, or exterior-component concerns", "Common RV appliance operational concerns"],
  },
  {
    title: "RV Inspections & Owner Support",
    intro: "Available services include visual and functional assessments of accessible systems and components at the time of service.",
    items: ["Pre-Purchase RV Inspection", "RV System Inspection", "Pre-Trip Inspection", "Seasonal Inspection", "Roof & Seal Inspection", "Basic Water-Intrusion Check", "New Owner RV Orientation", "New RV Delivery Walk-Through Support"],
    notes: ["Inspection scope is confirmed before scheduling.", "Inspections are not a guarantee against hidden, intermittent, age-related, or future failures."],
  },
  {
    title: "Rooftop RV A/C Diagnostics",
    intro: "We assess common rooftop RV A/C performance and control concerns.",
    items: ["A/C runs but does not cool", "Fan runs but compressor does not start", "A/C starts intermittently", "Breaker trips when A/C starts", "Weak airflow or unusual noise", "Thermostat or control concerns", "Water dripping from the A/C area", "Power-supply concerns affecting A/C operation"],
    notes: ["We test the reported issue and explain recommended repair options before additional work or parts are approved. Refrigerant and other regulated HVAC work is outside the advertised service scope."],
  },
  {
    title: "Electrical & Power-System Concerns",
    intro: "We provide diagnostic support for common 12 VDC and 120 VAC RV electrical concerns.",
    items: ["No 12 V power", "Battery not charging", "Shore-power concerns", "Converter/charger operation", "Fuses and breakers", "Lights, outlets, switches, and controls", "Intermittent electrical issues", "Wiring and connection concerns", "Exterior-light and trailer-connection concerns"],
    notes: ["When testing confirms a failed component, repair or replacement options are discussed before parts are ordered or installed."],
  },
  {
    title: "Plumbing & Water-System Concerns",
    intro: "We provide mobile diagnostic and repair support for common RV fresh-water and interior plumbing concerns.",
    items: ["Water leaks inside or underneath the RV", "Water pump concerns", "Low water pressure", "Faucets, fixtures, and fittings", "Toilet, flush, seal, and water-supply concerns", "PEX plumbing and accessible plumbing connections", "Drain and waste-system related concerns"],
    notes: ["Repair or component replacement may be recommended after diagnosis, subject to equipment condition, access, parts availability, and customer approval. Propane and gas-system repair is outside the advertised service scope."],
  },
  {
    title: "Roof, Seal & Water-Intrusion Service",
    intro: "We provide inspection and diagnostic support for visible roof-seal deterioration, water-entry concerns, accessible seams, roof vents, skylights, A/C openings, windows, slide-out areas, and other exterior locations.",
    items: ["Water stains or visible moisture", "Leak near a roof vent, skylight, A/C, antenna, or seam", "Cracked, loose, or deteriorated sealant", "Roof-maintenance concerns", "Water entry near windows or slide-out areas", "Visible exterior seal or caulking concerns"],
    notes: ["We document visible conditions and recommend localized maintenance, resealing, repair, or referral when a larger repair may be needed.", "Service scope is limited to the specific area described on the invoice. RV water intrusion can have multiple entry points and hidden damage that may not be visible during the initial visit."],
  },
  {
    title: "Seasonal Maintenance & New Owner Orientation",
    intro: "New-owner orientation helps customers understand their RV’s main systems, controls, shutoffs, routine maintenance needs, and common operating practices.",
    items: ["Pre-trip system checks", "Seasonal maintenance checks", "Roof and seal maintenance review", "Basic battery and power-system review", "Winterization", "De-winterization", "New Owner RV Orientation", "New RV Delivery Walk-Through Support"],
    notes: ["Service scope is confirmed before scheduling."],
  },
];

export const homeServices: ServiceSection[] = [
  { title: "TV Mounting", intro: "Mounting of customer-supplied TV brackets and televisions to suitable wall surfaces. Wall type, TV size, bracket, and desired location are confirmed before scheduling." },
  { title: "Furniture Assembly", intro: "Assembly of customer-supplied furniture, shelving units, storage units, tables, beds, desks, and similar items." },
  { title: "Door Locks & Hardware", intro: "Potential services include door lock replacement, deadbolt installation, door and cabinet hardware replacement, and basic door adjustments.", notes: ["No structural modification or regulated electrical work is included."] },
  { title: "Shelving & Wall Accessories", intro: "Potential services include shelving, curtain rods, blinds, mailboxes, and similar minor home accessories." },
  { title: "Caulking & Sealing", intro: "Caulking and sealing for accessible, non-structural areas around fixtures, trim, windows, doors, and similar locations. Scope is confirmed after photos or an on-site assessment." },
  { title: "Minor Repairs & Punch Lists", intro: "Potential services include minor door adjustments, trim and baseboard adjustments, hardware issues, basic rental turnover tasks, and home punch-list tasks." },
  { title: "Portable Appliance Placement & Setup", intro: "Unpacking, positioning, leveling, and basic setup of eligible customer-supplied portable appliances when no modification of electrical wiring, plumbing, dryer venting, cabinetry, countertops, HVAC, or permitted building systems is required." },
];

const generalFaqItems = [
  ["Do you provide mobile service?", "Yes. Anchor Point One provides on-site service at homes, RV parks, campgrounds, storage locations, and businesses within the available service area."],
  ["Do I need to know what is wrong before contacting you?", "No. Describe what is happening and send photos or a short video if available. You do not need to identify the failed component, know what repair is required, or choose a diagnostic method."],
  ["What happens after I contact you?", "We review the information and recommend the most appropriate next step. We may request additional photos, video, model information, or other details first. You decide whether to proceed."],
  ["Does sending a message mean I have scheduled service?", "No. Initial contact is only a request for review. A paid service is scheduled only after the appropriate scope, pricing, location, and appointment details have been explained and accepted."],
  ["Do I have to choose between remote and onsite diagnosis?", "No. Start by telling us what is happening. We review the information and determine what type of assistance may be appropriate."],
  ["What information should I send?", "Please send your city and ZIP code, a short description of the issue, and photos or a short video when possible. For RV service, include the RV type, year, make, model, and equipment model information if available."],
  ["Do you provide an estimate before repairs?", "Yes. After diagnosis, we explain the recommended repair, estimated labor, required parts, and expected cost before performing additional work or ordering parts."],
] as const;

const pricingFaqItems = [
  ["What does the $150 Diagnostic and Service Visit include?", "It includes mobile travel within our standard service area and up to 45 minutes of onsite diagnostic or repair time. It also includes an explanation of what was found and the recommended next step when the work cannot reasonably be completed during the initial visit."],
  ["Is there a separate mobile, trip, or service-call fee?", "No. The $150 is one combined Diagnostic and Service Visit that includes standard-area travel and the first 45 minutes onsite."],
  ["How is time after the first 45 minutes billed?", "Additional onsite time is $90 per hour, billed in 15-minute increments of $22.50. Additional time continues only after customer approval."],
  ["Are parts, materials, or extended travel included?", "No. Parts, materials, extended travel, and other approved charges are additional. Any added charge is explained and approved before it is incurred."],
  ["Can you install a part I already purchased?", "Contact us before purchasing or scheduling. We review the part, model information, condition, access, and requested work, then confirm whether the item can be used and how it affects scope and pricing before you decide."],
  ["What if another visit is needed?", "If a return visit is recommended, we explain why and confirm its scope, applicable pricing, parts, and appointment details before scheduling it. A return visit is not automatically authorized by the first request or visit."],
] as const;

const rvFaqItems = [
  ["Do you come to RV parks, campgrounds, storage facilities, and private homes?", "Yes, when the location is within our available service area and access is permitted. Send your city or ZIP code and location type so we can confirm availability."],
  ["What should I send for an RV A/C or equipment issue?", "Send your city or ZIP, RV year/make/model, equipment model label if available, a description of the symptom, photos, and the available power source or utilities when relevant."],
  ["Can you tell me which RV part I need from a photo?", "Photos and model information can help narrow down possible causes. Many RV issues require on-site testing before a part can be correctly identified. We do not recommend ordering major parts before the cause is confirmed."],
  ["Do I need to be present during the RV appointment?", "Someone with access to the RV should be available at the beginning of the appointment to explain the issue and authorize recommended work."],
] as const;

const homeFaqItems = [
  ["What minor home services do you offer?", "We offer select minor home services such as TV mounting, furniture assembly, locks and hardware, shelving, curtain rods, blinds, mailboxes, caulking, basic door adjustments, trim support, and punch-list tasks."],
  ["Do you repair drywall or match paint?", "No. We do not currently offer drywall repair, texture matching, paint matching, or painting."],
  ["Can you install customer-supplied items?", "Yes, for eligible minor-service projects. Please make sure the correct item, mounting hardware, and manufacturer instructions are available before the appointment."],
  ["Can you mount a TV on any wall?", "We review wall type, TV size, bracket type, location, and access before confirming service. Some wall surfaces or mounting conditions may require a different solution or may not be suitable for standard mounting."],
  ["Do you perform electrical, plumbing, HVAC, structural, or permitted home work?", "We do not modify building electrical wiring, install or alter circuits, modify plumbing systems, perform HVAC or refrigerant work, alter structural components, or complete permitted work unless separately qualified and authorized for that specific scope."],
] as const;

export const faqItems = [
  ...generalFaqItems,
  ...pricingFaqItems,
  ...rvFaqItems,
  ...homeFaqItems,
] as const;

export const faqGroups = [
  { title: "General", items: generalFaqItems },
  { title: "Pricing", items: pricingFaqItems },
  { title: "RV Services", items: rvFaqItems },
  { title: "Home Services", items: homeFaqItems },
] as const;
