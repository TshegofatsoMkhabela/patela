"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  Compass,
  FileBadge2,
  KeyRound,
  Mail,
  PackageCheck,
  PackageSearch,
  Truck,
  UserRound,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import "@/styles/country-onboarding.css";

type Method = "code" | "password";
type Country = "ZA" | "KE" | "NA";
type OnboardingStep = 1 | 2 | 3 | 4 | 5 | 6;
type OnboardingAnswers = {
  onboardingVersion: 2;
  registrationCountry: Country;
  entityType: string;
  legalName: string;
  registrationNumber: string;
  taxId: string;
  actingCapacity: string;
  buyerType: "business" | "individual";
  buyingNeeds: string[];
  fullName?: string;
};

const countryOptions: { code: Country; name: string; detail: string; flag: string }[] = [
  { code: "KE", name: "Kenya", detail: "Kenyan buyer profile", flag: "/flags/ke.svg" },
  { code: "NA", name: "Namibia", detail: "Namibian buyer profile", flag: "/flags/na.svg" },
  {
    code: "ZA",
    name: "South Africa",
    detail: "South African buyer profile",
    flag: "/flags/za.svg",
  },
];

const entityOptions = {
  ZA: [
    {
      value: "company",
      label: "Registered company",
      detail: "Registered with CIPC",
      registry: "CIPC",
    },
    {
      value: "close-corporation",
      label: "Close corporation",
      detail: "Registered with CIPC",
      registry: "CIPC",
    },
    {
      value: "sole-trader",
      label: "Sole proprietor",
      detail: "Trading in your own name",
      registry: null,
    },
    { value: "individual", label: "Individual", detail: "Buying for yourself", registry: null },
  ],
  KE: [
    {
      value: "company",
      label: "Registered company",
      detail: "Registered with BRS",
      registry: "BRS",
    },
    {
      value: "llp",
      label: "Limited liability partnership",
      detail: "Registered with BRS",
      registry: "BRS",
    },
    {
      value: "business-name",
      label: "Registered business name",
      detail: "Sole proprietor or partnership",
      registry: "BRS",
    },
    { value: "individual", label: "Individual", detail: "Buying for yourself", registry: null },
  ],
  NA: [
    {
      value: "company",
      label: "Registered company",
      detail: "Registered with BIPA",
      registry: "BIPA",
    },
    {
      value: "close-corporation",
      label: "Close corporation",
      detail: "Registered with BIPA",
      registry: "BIPA",
    },
    {
      value: "sole-trader",
      label: "Sole trader",
      detail: "Trading in your own name",
      registry: null,
    },
    { value: "individual", label: "Individual", detail: "Buying for yourself", registry: null },
  ],
} as const;

function GoogleMark() {
  return (
    <svg className="pa-social-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M21.35 12.25c0-.73-.06-1.42-.18-2.09H12v3.95h5.24a4.48 4.48 0 0 1-1.95 2.94v2.44h3.16c1.85-1.7 2.9-4.2 2.9-7.24Z"
      />
      <path
        fill="#34A853"
        d="M12 21.5c2.64 0 4.85-.87 6.47-2.35l-3.16-2.44c-.88.59-2 .95-3.31.95-2.55 0-4.72-1.72-5.5-4.03H3.25v2.51A9.5 9.5 0 0 0 12 21.5Z"
      />
      <path
        fill="#FBBC05"
        d="M6.5 13.63a5.7 5.7 0 0 1 0-3.26V7.86H3.25a9.5 9.5 0 0 0 0 8.28l3.25-2.51Z"
      />
      <path
        fill="#EA4335"
        d="M12 6.34c1.44 0 2.72.5 3.74 1.46l2.8-2.8A9.1 9.1 0 0 0 12 2.5a9.5 9.5 0 0 0-8.75 5.36l3.25 2.51c.78-2.31 2.95-4.03 5.5-4.03Z"
      />
    </svg>
  );
}

function MetaMaskMark() {
  return (
    <svg className="pa-social-icon" viewBox="0 0 32 32" aria-hidden="true">
      <path fill="#E2761B" d="M29 3 18 11l2 5 8-3 1-10ZM3 3l11 8-2 5-8-3L3 3Z" />
      <path fill="#F6851B" d="m28 13-8 3 2 6 6-1V13ZM4 13v8l6 1 2-6-8-3Z" />
      <path fill="#763D16" d="m10 22 4 3 2-2-4-7-2 6Zm12 0-4 3-2-2 4-7 2 6Z" />
      <path fill="#E4761B" d="m14 25-4-3-3 2 5 4 2-3Zm4 0 4-3 3 2-5 4-2-3Z" />
      <path fill="#C0AD9E" d="m12 28 4 2 4-2-2-3h-4l-2 3Z" />
      <path fill="#F6851B" d="m12 16 4 3 4-3-2-5h-4l-2 5Z" />
    </svg>
  );
}

export function CountryOnboardingView() {
  const router = useRouter();
  const signupMode = true;
  const [method, setMethod] = useState<Method>("code");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sentCode, setSentCode] = useState("");
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const onboarding = signupMode;
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep>(1);
  const [registrationCountry, setRegistrationCountry] = useState<Country | null>(null);
  const [entityType, setEntityType] = useState("");
  const [legalName, setLegalName] = useState("");
  const [personName, setPersonName] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [taxId, setTaxId] = useState("");
  const [actingCapacity, setActingCapacity] = useState("");
  const [buyingNeeds, setBuyingNeeds] = useState<string[]>([]);
  const totalSteps = signupMode ? 6 : 5;
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const countryName = countryOptions.find((item) => item.code === registrationCountry)?.name;
  const selectedEntity = registrationCountry
    ? entityOptions[registrationCountry].find((item) => item.value === entityType)
    : undefined;
  const needsRegistry = Boolean(selectedEntity?.registry);
  const taxLabel =
    registrationCountry === "ZA"
      ? "SARS income tax reference"
      : registrationCountry === "KE"
        ? "KRA PIN"
        : "NamRA TIN";
  const canContinue =
    onboardingStep === 1
      ? Boolean(registrationCountry)
      : onboardingStep === 2
        ? Boolean(entityType)
        : onboardingStep === 3
          ? entityType === "individual"
            ? Boolean(personName.trim())
            : Boolean(legalName.trim() && (!needsRegistry || registrationNumber.trim()))
          : onboardingStep === 4
            ? Boolean(actingCapacity)
            : onboardingStep === 5
              ? buyingNeeds.length > 0
              : validEmail && (!sentCode || code.length === 6);

  function chooseCountry(country: Country) {
    if (registrationCountry !== country) {
      setEntityType("");
      setLegalName("");
      setPersonName("");
      setRegistrationNumber("");
      setTaxId("");
      setActingCapacity("");
    }
    setRegistrationCountry(country);
  }

  function chooseEntity(value: string) {
    if (entityType !== value) {
      setLegalName("");
      setPersonName("");
      setRegistrationNumber("");
      setTaxId("");
      setActingCapacity("");
    }
    setEntityType(value);
  }

  function issueCode() {
    let nextCode = String(Math.floor(100000 + Math.random() * 900000));
    if (nextCode === sentCode)
      nextCode = nextCode === "999999" ? "100000" : String(Number(nextCode) + 1);
    setSentCode(nextCode);
    setCode("");
    setCodeError("");
  }

  function signIn(answers?: OnboardingAnswers) {
    const accountEmail = email.trim().toLowerCase();
    const authUser = {
      fullName: accountEmail.split("@")[0],
      email: accountEmail,
      role: "buyer",
      roleTitle: "Commercial Buyer / Consignor",
      verified: false,
      demo: true,
      signedInAt: new Date().toISOString(),
    };
    try {
      const saved = localStorage.getItem("patela_auth_user");
      const existing = saved ? JSON.parse(saved) : null;
      const profileKey = `patela_demo_buyer:${accountEmail}`;
      const storedProfile = localStorage.getItem(profileKey);
      const profile = storedProfile
        ? JSON.parse(storedProfile)
        : existing?.email?.toLowerCase() === accountEmail
          ? existing
          : null;
      const updated = JSON.stringify({
        ...authUser,
        ...profile,
        ...answers,
        signedInAt: authUser.signedInAt,
      });
      localStorage.setItem(profileKey, updated);
      localStorage.setItem("patela_auth_user", updated);
      localStorage.setItem("patela_current_role", "client");
    } catch {
      toast.error("This browser could not save the demo session.");
      return;
    }
    toast.success(
      signupMode ? "Your Patela demo profile is ready." : "Signed in to the Patela demo workspace.",
    );
    router.push("/buyer");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.error("Enter a valid email address.");
      return;
    }
    if (method === "password") {
      if (!password) {
        toast.error("Enter your password.");
        return;
      }
      signIn();
      return;
    }
    if (!sentCode) {
      issueCode();
      return;
    }
    if (code !== sentCode) {
      setCodeError("That code does not match. Check the demo code and try again.");
      return;
    }
    signIn();
  }

  return (
    <main className="pa-page">
      <div className={`pa-shell${onboarding ? " pa-shell-onboarding" : ""}`}>
        <Link href="/" className="pa-brand" aria-label="Patela home">
          <Image src="/patela-logo.png" alt="Patela" width={252} height={41} priority />
        </Link>
        <h1>
          {onboarding
            ? onboardingStep === 1
              ? "Where is your profile based?"
              : onboardingStep === 2
                ? `How are you buying in ${countryName}?`
                : onboardingStep === 3
                  ? entityType === "individual"
                    ? "What is your full name?"
                    : "Tell us about your business"
                  : onboardingStep === 4
                    ? "What is your role?"
                    : onboardingStep === 5
                      ? "What will you use Patela for?"
                      : "Finish your demo profile"
            : "Sign in to your account"}
        </h1>
        {onboarding && (
          <p className="pa-onboarding-intro">
            {onboardingStep === 1
              ? "Choose where you or an existing business placing orders is based. This creates a Patela profile, not a registered business."
              : onboardingStep === 2
                ? "Choose the legal form used to place orders. Registry details apply only to registered entities."
                : onboardingStep === 3
                  ? entityType === "individual"
                    ? "Use the name you want on your buyer profile."
                    : `Enter the details for the business based in ${countryName}.`
                  : onboardingStep === 4
                    ? entityType === "individual"
                      ? "Will you place orders for yourself or act for someone else?"
                      : "Choose your relationship to the business placing orders."
                    : onboardingStep === 5
                      ? `Choose one or more for your profile in ${countryName}. You can change this later.`
                      : "Enter your email and confirm the demo code to open your workspace."}
          </p>
        )}
        <div className="pa-card">
          {onboarding ? (
            <form
              className="pa-onboarding"
              onSubmit={(event) => {
                event.preventDefault();
                if (onboardingStep !== totalSteps) return;
                if (signupMode && onboardingStep === 6) {
                  if (!validEmail) return;
                  if (!sentCode) {
                    issueCode();
                    return;
                  }
                  if (code !== sentCode) {
                    setCodeError("That code does not match. Check the demo code and try again.");
                    return;
                  }
                }
                if (
                  registrationCountry &&
                  entityType &&
                  actingCapacity &&
                  buyingNeeds.length &&
                  (entityType === "individual"
                    ? personName.trim()
                    : legalName.trim() && (!needsRegistry || registrationNumber.trim()))
                ) {
                  signIn({
                    onboardingVersion: 2,
                    registrationCountry,
                    entityType,
                    legalName: entityType === "individual" ? "" : legalName.trim(),
                    registrationNumber: needsRegistry ? registrationNumber.trim() : "",
                    taxId: entityType === "individual" ? "" : taxId.trim(),
                    actingCapacity,
                    buyerType: entityType === "individual" ? "individual" : "business",
                    buyingNeeds,
                    ...(entityType === "individual" ? { fullName: personName.trim() } : {}),
                  });
                }
              }}
            >
              {onboardingStep === 1 ? (
                <fieldset className="pa-choice-grid">
                  <legend className="pa-sr-only">Where is your profile based?</legend>
                  {countryOptions.map(({ code: value, name, detail, flag }) => (
                    <label key={value} className="pa-choice pa-country-choice">
                      <span className="pa-country-flag">
                        <Image src={flag} alt={`${name} flag`} width={42} height={28} />
                      </span>
                      <span className="pa-choice-copy">
                        <strong>{name}</strong>
                        <small>{detail}</small>
                      </span>
                      <input
                        type="radio"
                        name="registration-country"
                        value={value}
                        checked={registrationCountry === value}
                        onChange={() => chooseCountry(value)}
                      />
                    </label>
                  ))}
                </fieldset>
              ) : onboardingStep === 2 && registrationCountry ? (
                <fieldset className="pa-choice-list">
                  <legend className="pa-sr-only">Business form in {countryName}</legend>
                  {entityOptions[registrationCountry].map(({ value, label, detail }) => (
                    <label key={value} className="pa-choice">
                      <span className="pa-choice-icon">
                        {value === "individual" ? <UserRound size={21} /> : <Building2 size={21} />}
                      </span>
                      <span className="pa-choice-copy">
                        <strong>{label}</strong>
                        <small>{detail}</small>
                      </span>
                      <input
                        type="radio"
                        name="entity-type"
                        value={value}
                        checked={entityType === value}
                        onChange={() => chooseEntity(value)}
                      />
                    </label>
                  ))}
                </fieldset>
              ) : onboardingStep === 3 ? (
                <div className="pa-business-fields pa-details-step">
                  {entityType === "individual" ? (
                    <>
                      <label htmlFor="pa-person-name">Full name</label>
                      <input
                        id="pa-person-name"
                        value={personName}
                        onChange={(event) => setPersonName(event.target.value)}
                        placeholder="Enter your full name"
                        autoComplete="name"
                        maxLength={120}
                        required
                      />
                    </>
                  ) : (
                    <>
                      <label htmlFor="pa-legal-name">
                        {needsRegistry ? "Registered legal name" : "Your name or trading name"}
                      </label>
                      <input
                        id="pa-legal-name"
                        value={legalName}
                        onChange={(event) => setLegalName(event.target.value)}
                        placeholder={
                          needsRegistry ? "As shown on your registration" : "Name used for orders"
                        }
                        maxLength={120}
                        required
                      />
                      {needsRegistry && (
                        <>
                          <label htmlFor="pa-registration-number">
                            {selectedEntity?.registry} registration number
                          </label>
                          <input
                            id="pa-registration-number"
                            value={registrationNumber}
                            onChange={(event) => setRegistrationNumber(event.target.value)}
                            placeholder="Enter your business number"
                            maxLength={40}
                            required
                          />
                        </>
                      )}
                      <label htmlFor="pa-tax-id">
                        {taxLabel} <span>(optional for demo)</span>
                      </label>
                      <input
                        id="pa-tax-id"
                        value={taxId}
                        onChange={(event) => setTaxId(event.target.value)}
                        placeholder={`Enter your ${taxLabel}`}
                        maxLength={40}
                      />
                      <p className="pa-help">
                        Demo profile only. Use placeholders; numbers stay in this browser and are
                        not verified.
                      </p>
                    </>
                  )}
                </div>
              ) : onboardingStep === 4 ? (
                <fieldset className="pa-choice-list">
                  <legend className="pa-sr-only">What is your role?</legend>
                  {(entityType === "individual"
                    ? [
                        {
                          value: "self",
                          label: "For myself",
                          detail: "I will place my own orders",
                          Icon: UserRound,
                        },
                        {
                          value: "agent",
                          label: "For someone else",
                          detail: "I have authority to act for them",
                          Icon: BriefcaseBusiness,
                        },
                      ]
                    : [
                        {
                          value: "owner",
                          label: "Owner, director or partner",
                          detail: "I can act for this business",
                          Icon: Building2,
                        },
                        {
                          value: "employee",
                          label: "Authorised employee",
                          detail: "My business has given me authority",
                          Icon: UsersRound,
                        },
                        {
                          value: "agent",
                          label: "External agent",
                          detail: "I have written authority from the business",
                          Icon: FileBadge2,
                        },
                      ]
                  ).map(({ value, label, detail, Icon }) => (
                    <label key={value} className="pa-choice">
                      <span className="pa-choice-icon">
                        <Icon size={21} strokeWidth={1.8} />
                      </span>
                      <span className="pa-choice-copy">
                        <strong>{label}</strong>
                        <small>{detail}</small>
                      </span>
                      <input
                        type="radio"
                        name="acting-capacity"
                        value={value}
                        checked={actingCapacity === value}
                        onChange={() => setActingCapacity(value)}
                      />
                    </label>
                  ))}
                </fieldset>
              ) : onboardingStep === 5 ? (
                <fieldset className="pa-choice-list">
                  <legend className="pa-sr-only">What will you use Patela for?</legend>
                  {[
                    {
                      value: "source",
                      label: "Source goods",
                      detail: "Find suppliers and place orders",
                      Icon: PackageSearch,
                    },
                    {
                      value: "move",
                      label: "Move goods",
                      detail: "Arrange transport for an order",
                      Icon: Truck,
                    },
                    {
                      value: "receive",
                      label: "Receive deliveries",
                      detail: "Track and confirm handoffs",
                      Icon: PackageCheck,
                    },
                    {
                      value: "explore",
                      label: "Just exploring",
                      detail: "Take a look around the demo",
                      Icon: Compass,
                    },
                  ].map(({ value, label, detail, Icon }) => (
                    <label key={value} className="pa-choice">
                      <span className="pa-choice-icon">
                        <Icon size={21} strokeWidth={1.8} />
                      </span>
                      <span className="pa-choice-copy">
                        <strong>{label}</strong>
                        <small>{detail}</small>
                      </span>
                      <input
                        type="checkbox"
                        checked={buyingNeeds.includes(value)}
                        onChange={(event) =>
                          setBuyingNeeds((current) =>
                            event.target.checked
                              ? value === "explore"
                                ? ["explore"]
                                : [...current.filter((item) => item !== "explore"), value]
                              : current.filter((item) => item !== value),
                          )
                        }
                      />
                    </label>
                  ))}
                </fieldset>
              ) : (
                <div className="pa-business-fields pa-details-step">
                  <label htmlFor="pa-signup-email">Email address</label>
                  <input
                    id="pa-signup-email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      setSentCode("");
                      setCode("");
                      setCodeError("");
                    }}
                    required
                  />
                  {sentCode && (
                    <>
                      <label htmlFor="pa-signup-code">Demo code</label>
                      <InputOTP
                        id="pa-signup-code"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        pattern="[0-9]*"
                        aria-describedby="pa-signup-code-help"
                        aria-invalid={Boolean(codeError)}
                        value={code}
                        onChange={(value) => {
                          setCode(value.replace(/[^0-9]/g, ""));
                          setCodeError("");
                        }}
                      >
                        <InputOTPGroup className="pa-otp-group">
                          {Array.from({ length: 6 }, (_, index) => (
                            <InputOTPSlot key={index} index={index} className="pa-otp-slot" />
                          ))}
                        </InputOTPGroup>
                      </InputOTP>
                      <p className="pa-help" id="pa-signup-code-help" aria-live="polite">
                        Demo code: <strong>{sentCode}</strong>. No email was sent.
                      </p>
                      {codeError && (
                        <p className="pa-help" role="alert">
                          {codeError}
                        </p>
                      )}
                      <button className="pa-otp-resend" type="button" onClick={issueCode}>
                        Get a new demo code
                      </button>
                    </>
                  )}
                  {!sentCode && (
                    <p className="pa-help">
                      We&apos;ll show you a demo code. No email will be sent.
                    </p>
                  )}
                </div>
              )}
              <div
                className="pa-progress"
                aria-label={`Onboarding step ${onboardingStep} of ${totalSteps}`}
              >
                <div className="pa-progress-track" aria-hidden="true">
                  <span style={{ width: `${(onboardingStep / totalSteps) * 100}%` }} />
                </div>
                <span>
                  Step {onboardingStep} of {totalSteps}
                </span>
              </div>
              <div className="pa-onboarding-actions">
                <button
                  className="pa-back"
                  type="button"
                  onClick={() => {
                    if (onboardingStep === 1) {
                      router.push("/");
                    } else setOnboardingStep((onboardingStep - 1) as OnboardingStep);
                  }}
                >
                  <ArrowLeft size={17} /> Back
                </button>
                {onboardingStep < totalSteps ? (
                  <button
                    className="pa-submit"
                    type="button"
                    disabled={!canContinue}
                    onClick={() => setOnboardingStep((onboardingStep + 1) as OnboardingStep)}
                  >
                    Continue <ArrowRight size={17} />
                  </button>
                ) : (
                  <button className="pa-submit" type="submit" disabled={!canContinue}>
                    {signupMode && !sentCode ? "Send code" : "Open workspace"}{" "}
                    <ArrowRight size={17} />
                  </button>
                )}
              </div>
            </form>
          ) : (
            <>
              <form onSubmit={handleSubmit}>
                <div className="pa-tabs" role="group" aria-label="Sign in method">
                  <button
                    type="button"
                    aria-pressed={method === "code"}
                    className={method === "code" ? "active" : ""}
                    onClick={() => {
                      setMethod("code");
                      setSentCode("");
                      setCode("");
                      setCodeError("");
                    }}
                  >
                    <Mail size={17} /> Email code
                  </button>
                  <button
                    type="button"
                    aria-pressed={method === "password"}
                    className={method === "password" ? "active" : ""}
                    onClick={() => setMethod("password")}
                  >
                    <KeyRound size={17} /> Password
                  </button>
                </div>
                <label htmlFor="pa-email">Email</label>
                <input
                  id="pa-email"
                  type="email"
                  autoComplete="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setSentCode("");
                    setCode("");
                    setCodeError("");
                  }}
                  required
                />
                {method === "password" ? (
                  <>
                    <label htmlFor="pa-password" className="pa-secondary-label">
                      Password
                    </label>
                    <input
                      id="pa-password"
                      type="password"
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <p className="pa-help">Demo sign-in accepts any password.</p>
                  </>
                ) : sentCode ? (
                  <>
                    <label htmlFor="pa-code" className="pa-secondary-label">
                      Demo code
                    </label>
                    <InputOTP
                      id="pa-code"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      pattern="[0-9]*"
                      autoFocus
                      aria-describedby={codeError ? "pa-code-help pa-code-error" : "pa-code-help"}
                      aria-invalid={Boolean(codeError)}
                      value={code}
                      onChange={(value) => {
                        setCode(value.replace(/[^0-9]/g, ""));
                        setCodeError("");
                      }}
                      required
                    >
                      <InputOTPGroup className="pa-otp-group">
                        {Array.from({ length: 6 }, (_, index) => (
                          <InputOTPSlot key={index} index={index} className="pa-otp-slot" />
                        ))}
                      </InputOTPGroup>
                    </InputOTP>
                    <p className="pa-help" id="pa-code-help" aria-live="polite">
                      Demo code: <strong>{sentCode}</strong>. No email was sent.
                    </p>
                    {codeError && (
                      <p id="pa-code-error" className="pa-help" role="alert">
                        {codeError}
                      </p>
                    )}
                    <button className="pa-otp-resend" type="button" onClick={issueCode}>
                      Get a new demo code
                    </button>
                  </>
                ) : (
                  <p className="pa-help">We&apos;ll show you a demo code. No email will be sent.</p>
                )}
                <button className="pa-submit" type="submit">
                  {method === "password" ? "Sign in" : sentCode ? "Verify code" : "Send code"}
                </button>
              </form>
              <div className="pa-divider">
                <span>Or continue with</span>
              </div>
              <div className="pa-social">
                <button
                  type="button"
                  onClick={() => toast.info("Google sign-in is not connected in this demo.")}
                >
                  <GoogleMark /> Continue with Google
                </button>
                <button
                  type="button"
                  onClick={() => toast.info("MetaMask sign-in is not connected in this demo.")}
                >
                  <MetaMaskMark /> Continue with MetaMask
                </button>
              </div>
            </>
          )}
        </div>
        <p className="pa-signup">
          {signupMode ? (
            <>
              Already have an account? <Link href="/signin">Sign in</Link>
            </>
          ) : (
            <>
              Don&apos;t have an account? <Link href="/signup">Sign up</Link>
            </>
          )}
        </p>
        <p className="pa-demo">
          {signupMode
            ? "Patela product preview · Business registration and verification are not performed here"
            : "Patela product preview · Authentication is simulated"}
        </p>
      </div>
    </main>
  );
}
