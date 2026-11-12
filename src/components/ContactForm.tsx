"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Reveal } from "@/components/Reveal";

const TOPICS = ["Hiring", "Finding work", "Partnerships", "Press", "Security"];

export function ContactForm() {
  const [topic, setTopic] = useState(TOPICS[0]);
  const [sent, setSent] = useState(false);
  if (sent)
    return (
      <Reveal className="pt-card pt-mt">
        <h3>Thanks, we got your message.</h3>
        <p>
          This form is a demo for now, so nothing was actually sent. A real inbox will be connected
          soon.
        </p>
      </Reveal>
    );
  return (
    <Reveal>
      <form
        className="pt-form"
        style={{ maxWidth: 680 }}
        onSubmit={(e) => {
          e.preventDefault();
          setSent(true);
          toast.success("Message received (demo).");
        }}
      >
        <div className="pt-field">
          <label htmlFor="cn">Name</label>
          <input id="cn" className="pt-in" required />
        </div>
        <div className="pt-field">
          <label htmlFor="ce">Email</label>
          <input id="ce" type="email" className="pt-in" required />
        </div>
        <div className="pt-field">
          <span className="pt-flabel">Topic</span>
          <div className="pt-coins">
            {TOPICS.map((t) => (
              <button
                type="button"
                key={t}
                className={`pt-coin ${topic === t ? "on" : ""}`}
                aria-pressed={topic === t}
                onClick={() => setTopic(t)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="pt-field">
          <label htmlFor="cm">Message</label>
          <textarea id="cm" className="pt-in" required />
        </div>
        <div>
          <button className="pt-btn" type="submit">
            Send message →
          </button>
        </div>
      </form>
    </Reveal>
  );
}
