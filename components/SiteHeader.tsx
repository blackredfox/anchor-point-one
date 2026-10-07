"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { siteConfig } from "@/lib/site-config";

const links = [
  ["Home", "/"],
  ["Mobile RV Services", "/rv-services"],
  ["Home Services", "/home-services"],
  ["Gallery", "/#gallery"],
  ["How It Works", "/#process"],
  ["FAQ", "/faq"],
  ["About", "/#about"],
  ["Diagnostic and Service Visit", "/pricing-service-policy"],
  ["Contact", "/#request"],
] as const;

function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Main navigation">
      {links.map(([label, href]) => <Link href={href} key={href} onClick={onNavigate}>{label}</Link>)}
    </nav>
  );
}

export function SiteHeader() {
  const mobileNavigationRef = useRef<HTMLDetailsElement>(null);

  function closeMobileNavigation() {
    if (mobileNavigationRef.current) mobileNavigationRef.current.open = false;
  }

  useEffect(() => {
    const details = mobileNavigationRef.current;
    if (!details) return;

    function handlePointerDown(event: PointerEvent) {
      if (details.open && event.target instanceof Node && !details.contains(event.target)) {
        details.open = false;
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && details.open) {
        details.open = false;
        details.querySelector("summary")?.focus();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <header className="header">
      <Link className="brand" href="/">
        <strong>{siteConfig.name}</strong>
        <span>{siteConfig.descriptor}</span>
      </Link>
      <div className="desktop-navigation"><Navigation /></div>
      <details className="mobile-navigation" ref={mobileNavigationRef}>
        <summary>Menu</summary>
        <Navigation onNavigate={closeMobileNavigation} />
      </details>
      <Link className="button copper header-request" href="/#request">Send Service Request</Link>
    </header>
  );
}
