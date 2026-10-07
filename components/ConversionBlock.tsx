import { ContactActions } from "@/components/ContactActions";
import { ServiceContext } from "@/lib/site-config";

export function ConversionBlock({ context }: { context: ServiceContext }) {
  const isRv = context === "rv";
  return (
    <section className={`conversion-block ${isRv ? "rv" : "home"}`}>
      <div>
        <p className="eyebrow">Start with a message</p>
        <h2>{isRv ? "Not Sure What Is Wrong?" : "Not Sure If Your Project Is Something We Handle?"}</h2>
        {isRv ? <>
          <p>You do not need to diagnose the issue yourself or know what part needs replacement.</p>
          <p>Send your city/ZIP, a short description, and photos or a short video if available.</p>
          <p>We will review the information and let you know the most appropriate next step.</p>
        </> : <>
          <p>Send your city/ZIP, a short description, and photos or a short video if available.</p>
          <p>We will review the information and let you know whether the request is within our available service scope and what the next step would be.</p>
        </>}
        <p><strong>No obligation just for reaching out.</strong></p>
        <ContactActions context={context} />
        {isRv && <small>If additional diagnosis or service is recommended, we explain the available options and any fees before paid work begins.</small>}
      </div>
    </section>
  );
}
