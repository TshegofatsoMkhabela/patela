"use client";

import Link from "next/link";
import Image from "next/image";
import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, Check, Menu, X } from "lucide-react";

const desktopAnimation = "/freezpak-logistics.json";
const mobileAnimation = "/freezpak-logistics-mobile.json";

type LottiePlayer = {
  totalFrames: number;
  goToAndStop: (frame: number, isFrame: boolean) => void;
  destroy: () => void;
  addEventListener: (event: string, callback: () => void) => void;
};
type LottieGlobal = {
  loadAnimation: (options: {
    container: Element;
    renderer: "svg";
    loop: boolean;
    autoplay: boolean;
    path: string;
    rendererSettings: { preserveAspectRatio: string };
  }) => LottiePlayer;
};

const journey = [
  "An order begins with shared terms. Buyer, supplier and carrier can see the same goods, route and delivery requirements.",
  "Every parcel is mapped to the people and stops responsible for moving it, from the port to the final receiving point.",
  "The payment plan is agreed before dispatch, with each tranche tied to a clear, verifiable milestone.",
  "Goods move across road, rail, ports and warehouses while the active custody holder stays visible.",
  "At the handoff, driver and receiver confirm from a mobile link. No app or crypto wallet is required.",
  "A verified event can satisfy the agreed release rule, while an exception holds only the affected parcel.",
  "The journey ends with a chronological record of custody, decisions and payment status for every party.",
];

const services = [
  {
    title: "Orders & agreements",
    text: "Create one shared record for goods, parties, terms and the route ahead.",
    href: "/how-it-works",
  },
  {
    title: "Multi-hop routing",
    text: "Model direct deliveries or complex road, rail, port and warehouse corridors.",
    href: "/how-it-works",
  },
  {
    title: "Custody handoffs",
    text: "Record who released and received a parcel at every transfer point.",
    href: "/html/guest-handoff.html",
  },
  {
    title: "Mobile guest access",
    text: "Give frontline teams a short-lived link with no registration or app download.",
    href: "/html/guest-handoff.html",
  },
  {
    title: "Payment rules",
    text: "Tie payment tranches to milestones that both sides can inspect.",
    href: "/for-clients",
  },
  {
    title: "Isolated disputes",
    text: "Hold the affected tranche while unaffected consignments keep moving.",
    href: "/how-it-works",
  },
  {
    title: "Partner coordination",
    text: "Keep buyers, suppliers and freight operators working from one order.",
    href: "/for-workers",
  },
  {
    title: "Audit trail",
    text: "Follow the sequence of handoffs, agreement versions and release decisions.",
    href: "/security",
  },
];

const corridors = [
  {
    eyebrow: "CORRIDOR VIEW 01 / 03",
    title: "Road freight",
    text: "Track each leg from dispatch to receiving, with the current custody holder visible across carriers and depots.",
    route: "Johannesburg → Durban",
  },
  {
    eyebrow: "CORRIDOR VIEW 02 / 03",
    title: "Port to inland",
    text: "Connect port release, cross-dock transfer and inland delivery in one continuous order history.",
    route: "Durban → Gauteng",
  },
  {
    eyebrow: "CORRIDOR VIEW 03 / 03",
    title: "Split consignments",
    text: "Follow separate parcels to separate destinations without losing the agreement that connects them.",
    route: "Cape Town → Multi-stop",
  },
];

const clamp = (value: number) => Math.max(0, Math.min(1, value));

export function PatelaHome() {
  const foldRef = useRef<HTMLElement>(null);
  const desktopRef = useRef<HTMLDivElement>(null);
  const mobileRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const copyRefs = useRef<(HTMLParagraphElement | null)[]>([]);
  const skipRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLSpanElement>(null);
  const playersRef = useRef<LottiePlayer[]>([]);
  const [lottieReady, setLottieReady] = useState(false);
  const [corridor, setCorridor] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const fold = foldRef.current;
    if (!fold) return;
    let frame = 0;
    const update = () => {
      const distance = Math.max(1, fold.offsetHeight - window.innerHeight);
      const progress = clamp(-fold.getBoundingClientRect().top / distance);
      playersRef.current.forEach((player) => {
        if (player.totalFrames) player.goToAndStop(progress * (player.totalFrames - 1), true);
      });
      if (titleRef.current)
        titleRef.current.style.transform = `scale(${1 - 0.7 * clamp(progress / 0.085)})`;
      const sequence = clamp((progress - 0.045) / 0.955) * journey.length;
      copyRefs.current.forEach((element, index) => {
        if (!element) return;
        const phase = sequence - index;
        const enter = clamp(phase * 4);
        const exit = clamp((phase - 0.86) * 4);
        element.style.opacity = String(enter * (1 - exit));
        element.style.transform = `translateY(${(1 - enter) * 100 - exit * 100}%)`;
      });
      if (skipRef.current) {
        const visibility = clamp((progress - 0.035) * 30);
        skipRef.current.style.opacity = String(visibility);
        skipRef.current.style.transform = `translateY(${(1 - visibility) * -100}%)`;
      }
      if (progressRef.current) progressRef.current.style.width = `${progress * 100}%`;
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    update();
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  useEffect(() => {
    if (!lottieReady) return;
    const lottie = (window as Window & { lottie?: LottieGlobal }).lottie;
    if (!lottie || !desktopRef.current || !mobileRef.current) return;
    const onLoad = () => window.dispatchEvent(new Event("resize"));
    const players = [
      lottie.loadAnimation({
        container: desktopRef.current,
        renderer: "svg",
        loop: false,
        autoplay: false,
        path: desktopAnimation,
        rendererSettings: { preserveAspectRatio: "xMidYMid meet" },
      }),
      lottie.loadAnimation({
        container: mobileRef.current,
        renderer: "svg",
        loop: false,
        autoplay: false,
        path: mobileAnimation,
        rendererSettings: { preserveAspectRatio: "xMidYMid meet" },
      }),
    ];
    playersRef.current = players;
    players.forEach((player) => player.addEventListener("DOMLoaded", onLoad));
    return () => {
      players.forEach((player) => player.destroy());
      playersRef.current = [];
    };
  }, [lottieReady]);

  return (
    <div className="fp-page">
      <Script
        src="/lottie.min.js"
        strategy="afterInteractive"
        onReady={() => setLottieReady(true)}
      />
      <header className="fp-header">
        <Link href="/" className="fp-logo" aria-label="Patela home">
          <Image src="/patela-logo.png" alt="Patela" width={252} height={41} priority />
        </Link>
        <nav className={menuOpen ? "fp-nav fp-nav-open" : "fp-nav"} aria-label="Main navigation">
          <a href="#services" onClick={() => setMenuOpen(false)}>
            Our platform
          </a>
          <a href="#network" onClick={() => setMenuOpen(false)}>
            Corridors
          </a>
          <a href="#about" onClick={() => setMenuOpen(false)}>
            About us
          </a>
          <Link href="/how-it-works">How it works</Link>
          <Link href="/contact">Contact</Link>
          <Link className="fp-nav-talk" href="/signup">
            GET STARTED
          </Link>
          <Link className="fp-nav-login" href="/signin">
            LOG IN
          </Link>
        </nav>
        <button
          className="fp-menu-toggle"
          type="button"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? <X /> : <Menu />}
        </button>
      </header>

      <main>
        <section className="fp-fold" ref={foldRef} aria-label="The Patela order journey">
          <div className="fp-fold-sticky">
            <div className="fp-lottie fp-lottie-desktop" ref={desktopRef} aria-hidden="true" />
            <div className="fp-lottie fp-lottie-mobile" ref={mobileRef} aria-hidden="true" />
            <div className="fp-fold-overlay">
              <div className="fp-fold-inner">
                <h1 ref={titleRef}>
                  Every handoff.
                  <br />
                  Accounted for.
                </h1>
                <div className="fp-fold-copy" aria-live="off">
                  {journey.map((line, index) => (
                    <p
                      key={line}
                      ref={(element) => {
                        copyRefs.current[index] = element;
                      }}
                    >
                      {line}
                    </p>
                  ))}
                </div>
                <div className="fp-fold-skip" ref={skipRef}>
                  <a href="#services">
                    Skip introduction <ArrowDown size={16} />
                  </a>
                  <div className="fp-progress">
                    <span ref={progressRef} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="fp-services" id="services">
          <div className="fp-wide">
            <div className="fp-section-top">
              <span>01 / THE PLATFORM</span>
              <span>ONE ORDER. EVERY HANDOFF.</span>
            </div>
            <h2>Our platform</h2>
          </div>
          <div className="fp-service-list">
            {services.map((service, index) => (
              <Link className="fp-service-row" href={service.href} key={service.title}>
                <span className="fp-service-number">{String(index + 1).padStart(2, "0")}</span>
                <h3>{service.title}</h3>
                <p>{service.text}</p>
                <span className="fp-service-arrow">
                  <ArrowUpRight size={26} />
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className="fp-network" id="network">
          <div className="fp-wide">
            <div className="fp-section-top">
              <span>02 / THE NETWORK</span>
              <span>BUILT FOR SOUTH AFRICAN CORRIDORS</span>
            </div>
            <h2>Our corridors</h2>
            <p className="fp-network-subtitle">
              A clear line of sight, however many times the goods change hands.
            </p>
            <div className="fp-map" aria-label="Example South African logistics corridor network">
              <div className="fp-map-grid" />
              <span className="fp-map-label fp-label-jhb">JOHANNESBURG</span>
              <span className="fp-map-label fp-label-dbn">DURBAN</span>
              <span className="fp-map-label fp-label-cpt">CAPE TOWN</span>
              <span className="fp-map-label fp-label-gqe">GQEBERHA</span>
              <span className="fp-map-label fp-label-rb">RICHARDS BAY</span>
              <svg
                className="fp-map-lines"
                viewBox="0 0 1000 470"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <path d="M285 335 518 160 733 275 780 168 M285 335 625 360 733 275" />
                <circle cx="285" cy="335" r="7" />
                <circle cx="518" cy="160" r="7" />
                <circle cx="733" cy="275" r="7" />
                <circle cx="625" cy="360" r="7" />
                <circle cx="780" cy="168" r="7" />
              </svg>
              <div className="fp-map-caption">
                Illustrative corridor view · Not facility locations
              </div>
            </div>
            <div className="fp-network-bottom">
              <p>
                From direct deliveries to multi-stop road, rail, port and warehouse routes, Patela
                keeps the order, active custody holder and agreed payment rules connected.
              </p>
              <Link href="/signin" className="fp-pill fp-pill-red">
                ENTER WORKSPACE <ArrowUpRight size={16} />
              </Link>
            </div>
          </div>
        </section>

        <section className="fp-corridor">
          <div className="fp-wide fp-corridor-inner">
            <div className="fp-corridor-visual">
              <span>TRANSPORTATION NETWORK</span>
              <div className="fp-corridor-road">
                <i />
                <i />
                <i />
              </div>
              <strong>{corridors[corridor].route}</strong>
            </div>
            <div className="fp-corridor-copy">
              <span>{corridors[corridor].eyebrow}</span>
              <h2>{corridors[corridor].title}</h2>
              <p>{corridors[corridor].text}</p>
              <Link href="/how-it-works">
                LEARN MORE <ArrowUpRight size={16} />
              </Link>
              <div className="fp-slider-controls">
                <button
                  type="button"
                  aria-label="Previous corridor"
                  onClick={() => setCorridor((corridor + corridors.length - 1) % corridors.length)}
                >
                  <ArrowLeft />
                </button>
                <button
                  type="button"
                  aria-label="Next corridor"
                  onClick={() => setCorridor((corridor + 1) % corridors.length)}
                >
                  <ArrowRight />
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="fp-about" id="about">
          <div className="fp-wide">
            <div className="fp-section-top">
              <span>03 / ABOUT US</span>
              <span>MORE THAN A TRACKING DOT</span>
            </div>
            <div className="fp-about-grid">
              <div className="fp-about-art" aria-hidden="true">
                <div className="fp-art-card fp-art-card-one">
                  <span>01</span>
                  <strong>ORDER</strong>
                  <small>AGREED</small>
                </div>
                <div className="fp-art-card fp-art-card-two">
                  <span>02</span>
                  <strong>CUSTODY</strong>
                  <small>VERIFIED</small>
                </div>
                <div className="fp-art-card fp-art-card-three">
                  <span>03</span>
                  <strong>PAYMENT</strong>
                  <small>BY RULE</small>
                </div>
              </div>
              <div className="fp-about-copy">
                <h2>About us</h2>
                <h3>MORE THAN JUST LOGISTICS.</h3>
                <p>
                  Patela is a coordination platform for the moments when commercial goods change
                  hands. Buyers, suppliers and carriers work from one order, one route and one
                  versioned set of payment rules.
                </p>
                <p>
                  Two-party mobile handoffs create an auditable record. If one parcel has an
                  exception, the rest of the order can continue. The demo shows the intended
                  journey; live banking, escrow and settlement integrations are still required.
                </p>
                <Link href="/about" className="fp-outline-link">
                  LEARN MORE <ArrowUpRight size={16} />
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="fp-closing">
          <div className="fp-wide fp-closing-inner">
            <div>
              <span>THE PATELA PROMISE</span>
              <h2>
                Months of waiting.
                <br />
                Seconds to confirm.
              </h2>
            </div>
            <div>
              <p>
                Traditional payment terms can stretch 60–90 days. Patela&apos;s mobile handoff is
                designed for two people to confirm a transfer in under 60 seconds, giving the agreed
                release rules a clear event to act on.
              </p>
              <Link href="/signup" className="fp-outline-link">
                GET STARTED <ArrowUpRight size={16} />
              </Link>
            </div>
          </div>
        </section>
      </main>
      <footer className="fp-footer">
        <div className="fp-wide">
          <div className="fp-footer-grid">
            <div>
              <Link href="/" className="fp-logo fp-footer-logo">
                <Image src="/patela-logo.png" alt="Patela" width={252} height={41} />
              </Link>
              <p>Every handoff accounted for.</p>
            </div>
            <div>
              <h3>Platform</h3>
              {services.slice(0, 5).map((service) => (
                <Link href={service.href} key={service.title}>
                  {service.title}
                </Link>
              ))}
            </div>
            <div>
              <h3>Explore</h3>
              <Link href="/how-it-works">How it works</Link>
              <Link href="/about">About us</Link>
              <Link href="/security">Security</Link>
              <Link href="/contact">Contact</Link>
            </div>
            <div>
              <h3>Your workspace</h3>
              <Link href="/signin">Log in</Link>
              <Link href="/signup">Get started</Link>
              <Link href="/html/guest-handoff.html">Guest handoff demo</Link>
            </div>
          </div>
          <div className="fp-footer-bottom">
            <span>© 2026 Patela · Product preview</span>
            <div>
              <Link href="/privacy">Privacy</Link>
              <Link href="/terms">Terms</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
