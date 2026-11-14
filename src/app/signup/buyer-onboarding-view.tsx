"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CircleHelp,
  Factory,
  MapPin,
  PackageCheck,
  ShoppingBag,
  Truck,
  UserRound,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { SiteNav } from "@/components/SiteNav";
import { ApiError, isOtpCode, patelaApi, saveAuthUser, toAuthUser } from "@/lib/patela-api";
import "@/styles/buyer-onboarding.css";

const buyerTypes = [
  {
    id: "business",
    title: "Registered business",
    detail: "Buy or consign goods for your company.",
    icon: Building2,
  },
  {
    id: "individual",
    title: "Individual buyer",
    detail: "Explore a purchase in your own name.",
    icon: UserRound,
  },
  {
    id: "representative",
    title: "Buying on behalf of a client",
    detail: "Manage orders for another organisation.",
    icon: ShoppingBag,
  },
] as const;

const buyingNeeds = [
  {
    id: "source",
    title: "Source goods",
    detail: "Find suppliers and compare offers.",
    icon: Factory,
  },
  {
    id: "move",
    title: "Move goods",
    detail: "Plan a route and track each handoff.",
    icon: Truck,
  },
  {
    id: "receive",
    title: "Receive deliveries",
    detail: "Confirm arrival and condition.",
    icon: PackageCheck,
  },
  {
    id: "explore",
    title: "I am still exploring",
    detail: "See how the buyer workspace works.",
    icon: CircleHelp,
  },
] as const;

const walletChoices = [
  {
    id: "connect",
    title: "Connect an existing wallet",
    detail: "Approve a connection in your wallet extension.",
    icon: Wallet,
  },
  {
    id: "address",
    title: "Add my public wallet address",
    detail: "Save a public 0x address for the preview.",
    icon: MapPin,
  },
  {
    id: "later",
    title: "I need a wallet first",
    detail: "Finish the buyer profile and set one up later.",
    icon: CircleHelp,
  },
] as const;

type BuyerType = (typeof buyerTypes)[number]["id"];
type BuyingNeed = (typeof buyingNeeds)[number]["id"];
type WalletChoice = (typeof walletChoices)[number]["id"];

const addressPattern = /^0x[a-fA-F0-9]{40}$/;

export function BuyerOnboardingView() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [buyerType, setBuyerType] = useState<BuyerType | null>(null);
  const [needs, setNeeds] = useState<BuyingNeed[]>([]);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [organisation, setOrganisation] = useState("");
  const [walletChoice, setWalletChoice] = useState<WalletChoice | null>(null);
  const [walletAddress, setWalletAddress] = useState("");
  const [busy, setBusy] = useState(false);

  function toggleNeed(value: BuyingNeed) {
    setNeeds((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
    );
  }

  function saveBuyer(address: string | null, walletStatus: "connected" | "provided" | "pending") {
    try {
      const signedIn = JSON.parse(localStorage.getItem("patela_auth_user") || "{}");
      saveAuthUser({
        ...signedIn,
        role: "client",
        rawRole: "buyer",
        roleTitle: "Buyer / Consignor",
        buyerType,
        buyingNeeds: needs,
        organisation: organisation.trim() || null,
        walletAddress: address,
        walletStatus,
        verified: true,
        registeredAt: new Date().toISOString(),
      });
      localStorage.setItem("patela_current_role", "client");
      const prototypeState = JSON.parse(localStorage.getItem("patela_proto_state_v3") || "{}");
      prototypeState.walletConnected = walletStatus === "connected";
      localStorage.setItem("patela_proto_state_v3", JSON.stringify(prototypeState));
    } catch {
      toast.error("This browser could not save your preview profile.");
      return;
    }
    toast.success("Buyer profile saved for the Patela preview.");
    router.push("/buyer");
  }

  async function continueFlow(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (step === 0) {
      if (!buyerType) return toast.error("Choose the kind of buyer you are.");
      setStep(1);
      return;
    }
    if (step === 1) {
      if (!needs.length) return toast.error("Choose at least one buying need.");
      setStep(2);
      return;
    }
    if (step === 2) {
      if (!fullName.trim()) return toast.error("Enter your name.");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
        return toast.error("Enter a valid email address.");
      if (buyerType !== "individual" && !organisation.trim())
        return toast.error("Enter the organisation you represent.");
      setBusy(true);
      try {
        if (!codeSent) {
          await patelaApi.requestOtp(email.trim());
          setCodeSent(true);
          toast.info("Enter the 6-digit code sent to your email.");
          return;
        }
        if (!isOtpCode(code)) return toast.error("Enter the 6-digit code.");
        await patelaApi.verifyOtp(email.trim(), code);
        const profile = await patelaApi.updateName(fullName.trim());
        saveAuthUser(toAuthUser(profile));
        setStep(3);
      } catch (error) {
        toast.error(error instanceof ApiError ? error.message : "Could not create the account.");
      } finally {
        setBusy(false);
      }
      return;
    }
    if (!walletChoice) return toast.error("Choose how you will handle your wallet.");
    if (walletChoice === "later") return saveBuyer(null, "pending");
    if (walletChoice === "address") {
      if (!addressPattern.test(walletAddress.trim()))
        return toast.error("Enter a valid public Ethereum wallet address.");
      return saveBuyer(walletAddress.trim(), "provided");
    }

    const provider = (
      window as Window & {
        ethereum?: { request: (request: { method: string }) => Promise<unknown> };
      }
    ).ethereum;
    if (!provider) return toast.error("No wallet extension was found in this browser.");
    setBusy(true);
    try {
      const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
      const address = accounts[0];
      if (!addressPattern.test(address || "")) throw new Error("No wallet address returned");
      saveBuyer(address, "connected");
    } catch {
      toast.error("Wallet connection was cancelled or unavailable.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ob-page">
      <SiteNav />
      <main className="ob-main">
        <div className="ob-intro">
          <span>Patela buyer onboarding</span>
          <p>From months to seconds. Start with your buyer profile.</p>
        </div>
        <section className="ob-card" aria-labelledby="ob-title">
          <div className="ob-top">
            <span>STEP {String(step + 1).padStart(2, "0")} / 04</span>
            <span>BUYER SETUP</span>
          </div>
          <div className="ob-track" aria-hidden="true">
            <span style={{ width: `${((step + 1) / 4) * 100}%` }} />
          </div>

          {step === 0 && (
            <>
              <h1 id="ob-title">What kind of buyer are you?</h1>
              <p className="ob-lead">
                Choose the profile that best matches how you will use Patela.
              </p>
              <div className="ob-options" role="radiogroup" aria-label="Buyer type">
                {buyerTypes.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={buyerType === item.id ? "ob-option ob-selected" : "ob-option"}
                    role="radio"
                    aria-checked={buyerType === item.id}
                    onClick={() => setBuyerType(item.id)}
                  >
                    <span className="ob-icon">
                      <item.icon size={22} strokeWidth={1.8} />
                    </span>
                    <span className="ob-option-text">
                      <strong>{item.title}</strong>
                      <small>{item.detail}</small>
                    </span>
                    <span className="ob-choice">
                      {buyerType === item.id && <Check size={14} strokeWidth={3} />}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <h1 id="ob-title">What do you need Patela for?</h1>
              <p className="ob-lead">Select as many as you like. You can change this later.</p>
              <div className="ob-options" role="group" aria-label="Buying needs">
                {buyingNeeds.map((item) => {
                  const selected = needs.includes(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={selected ? "ob-option ob-selected" : "ob-option"}
                      aria-pressed={selected}
                      onClick={() => toggleNeed(item.id)}
                    >
                      <span className="ob-icon">
                        <item.icon size={22} strokeWidth={1.8} />
                      </span>
                      <span className="ob-option-text">
                        <strong>{item.title}</strong>
                        <small>{item.detail}</small>
                      </span>
                      <span className="ob-choice">
                        {selected && <Check size={14} strokeWidth={3} />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h1 id="ob-title">Tell us about the buyer.</h1>
              <p className="ob-lead">
                These details label your preview profile. No ID or bank details are needed here.
              </p>
              <form id="ob-details-form" className="ob-fields" onSubmit={continueFlow}>
                <label htmlFor="ob-name">Full name</label>
                <input
                  id="ob-name"
                  autoComplete="name"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Your name"
                  required
                  disabled={codeSent}
                />
                <label htmlFor="ob-email">
                  {buyerType === "individual" ? "Email address" : "Work email"}
                </label>
                <input
                  id="ob-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder={buyerType === "individual" ? "you@example.com" : "you@company.co.za"}
                  required
                  disabled={codeSent}
                />
                {buyerType !== "individual" && (
                  <>
                    <label htmlFor="ob-organisation">Organisation</label>
                    <input
                      id="ob-organisation"
                      autoComplete="organization"
                      value={organisation}
                      onChange={(event) => setOrganisation(event.target.value)}
                      placeholder="Company or client name"
                      required
                      disabled={codeSent}
                    />
                  </>
                )}
                {codeSent ? (
                  <>
                    <label htmlFor="ob-code">Email verification code</label>
                    <input
                      id="ob-code"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      value={code}
                      onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
                      placeholder="6-digit code"
                      required
                    />
                  </>
                ) : null}
              </form>
              <p className="ob-legal">
                {codeSent
                  ? `We sent a code to ${email.trim()}.`
                  : "We verify your email before creating the buyer account."}{" "}
                <Link href="/privacy">How data is handled</Link>
              </p>
            </>
          )}

          {step === 3 && (
            <>
              <h1 id="ob-title">How will you use a wallet?</h1>
              <p className="ob-lead">
                Choose a wallet path. Only a public address is used in this preview.
              </p>
              <div className="ob-options" role="radiogroup" aria-label="Wallet setup">
                {walletChoices.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={walletChoice === item.id ? "ob-option ob-selected" : "ob-option"}
                    role="radio"
                    aria-checked={walletChoice === item.id}
                    onClick={() => setWalletChoice(item.id)}
                  >
                    <span className="ob-icon">
                      <item.icon size={22} strokeWidth={1.8} />
                    </span>
                    <span className="ob-option-text">
                      <strong>{item.title}</strong>
                      <small>{item.detail}</small>
                    </span>
                    <span className="ob-choice">
                      {walletChoice === item.id && <Check size={14} strokeWidth={3} />}
                    </span>
                  </button>
                ))}
              </div>
              {walletChoice === "address" && (
                <div className="ob-fields ob-wallet-field">
                  <label htmlFor="ob-wallet-address">Public wallet address</label>
                  <input
                    id="ob-wallet-address"
                    inputMode="text"
                    autoComplete="off"
                    spellCheck={false}
                    value={walletAddress}
                    onChange={(event) => setWalletAddress(event.target.value)}
                    placeholder="0x…"
                  />
                </div>
              )}
              <p className="ob-legal">
                Never enter a seed phrase or private key. Connection is not identity verification or
                live payment setup.
              </p>
            </>
          )}

          <div className="ob-bottom">
            <div className="ob-dots" aria-label={`Step ${step + 1} of 4`}>
              {[0, 1, 2, 3].map((index) => (
                <span key={index} className={index === step ? "active" : ""} />
              ))}
            </div>
            <div className="ob-actions">
              <button
                type="button"
                className="ob-back"
                onClick={() => (step ? setStep(step - 1) : router.push("/"))}
              >
                <ArrowLeft size={18} /> Back
              </button>
              <button
                type={step === 2 ? "submit" : "button"}
                form={step === 2 ? "ob-details-form" : undefined}
                className="ob-continue"
                onClick={step === 2 ? undefined : () => continueFlow()}
                disabled={busy}
              >
                {busy
                  ? step === 2
                    ? "Checking…"
                    : "Connecting…"
                  : step === 2 && codeSent
                    ? "Verify & continue"
                    : step === 2
                      ? "Send code"
                      : step === 3
                        ? "Finish setup"
                        : "Continue"}{" "}
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
