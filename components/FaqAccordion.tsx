"use client";

import { useState } from "react";

type FaqGroup = {
  title: string;
  items: readonly (readonly [string, string])[];
};

export function FaqAccordion({ groups }: { groups: readonly FaqGroup[] }) {
  const [openId, setOpenId] = useState("general-0");

  return <div className="faq-groups">
    {groups.map((group, groupIndex) => <section key={group.title} aria-labelledby={`faq-group-${groupIndex}`}>
      <h2 id={`faq-group-${groupIndex}`}>{group.title}</h2>
      <div className="faq-list">
        {group.items.map(([question, answer], itemIndex) => {
          const id = `${group.title.toLowerCase().replaceAll(" ", "-")}-${itemIndex}`;
          const expanded = openId === id;
          return <article className="faq-item" key={question}>
            <h3><button type="button" aria-expanded={expanded} aria-controls={`faq-panel-${id}`} id={`faq-button-${id}`} onClick={() => setOpenId(expanded ? "" : id)}>{question}</button></h3>
            <div id={`faq-panel-${id}`} role="region" aria-labelledby={`faq-button-${id}`} hidden={!expanded}><p>{answer}</p></div>
          </article>;
        })}
      </div>
    </section>)}
  </div>;
}
