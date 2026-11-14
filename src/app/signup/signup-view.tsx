"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { SiteNav } from "@/components/SiteNav";
import { Reveal } from "@/components/Reveal";
import { GoogleSignInButton, googleSignInAvailable } from "@/components/GoogleSignInButton";
import { useBackendTask } from "@/hooks/use-backend-task";
import {
  isEmail,
  isOtpCode,
  patelaApi,
  saveAuthUser,
  toAuthUser,
  type Profile,
} from "@/lib/patela-api";

export type RoleType = "buyer" | "carrier" | "supplier" | "driver" | "auditor";

interface RoleConfig {
  id: RoleType;
  title: string;
  badge: string;
  desc: string;
  redirectUrl: string;
  pill: string;
  badgeClass: string;
  steps: {
    title: string;
    subtitle: string;
    fields: {
      id: string;
      label: string;
      type: "text" | "select" | "multiselect" | "number";
      placeholder?: string;
      options?: string[];
      required?: boolean;
    }[];
  }[];
}

const ROLES: RoleConfig[] = [
  {
    id: "buyer",
    title: "Commercial Buyer / Consignor",
    badge: "Buyer & Consignor",
    desc: "Procuring bulk commodities, funding escrow, managing multi-destination consignments.",
    redirectUrl: "/buyer",
    pill: "CLIENT",
    badgeClass: "badge badge-gold",
    steps: [
      {
        title: "Company & CIPC Registration",
        subtitle: "Provide your registered South African business entity information.",
        fields: [
          {
            id: "companyName",
            label: "Registered Company Name",
            type: "text",
            placeholder: "e.g. Anglo African Resources (Pty) Ltd",
            required: true,
          },
          {
            id: "cipcNumber",
            label: "CIPC Registration Number",
            type: "text",
            placeholder: "e.g. 2019/549120/07",
            required: true,
          },
          {
            id: "vatNumber",
            label: "SARS VAT Number (Optional)",
            type: "text",
            placeholder: "e.g. 4820192841",
          },
        ],
      },
      {
        title: "Commodity & Procurement Sector",
        subtitle: "Select the primary goods you procure and dispatch across South Africa.",
        fields: [
          {
            id: "commoditySectors",
            label: "Primary Cargo & Commodity Categories",
            type: "multiselect",
            options: [
              "Metallurgical Minerals (Bauxite, Coal, Chrome)",
              "Agricultural Produce (Maize, Grain, Sugar)",
              "Heavy Machinery & Industrial Equipment",
              "Fast Moving Consumer Goods (FMCG)",
              "Petroleum & Chemical Liquid Bulks",
            ],
            required: true,
          },
        ],
      },
      {
        title: "Logistics Corridors & Volumes",
        subtitle: "Where does your cargo originate and discharge?",
        fields: [
          {
            id: "originDepots",
            label: "Primary Origin Loading Points",
            type: "text",
            placeholder: "e.g. Witbank / Postmasburg / Steelpoort",
            required: true,
          },
          {
            id: "dischargePorts",
            label: "Primary Delivery Terminals / Ports",
            type: "text",
            placeholder: "e.g. Richards Bay Dry Bulk Terminal / Durban Pier 2",
            required: true,
          },
          {
            id: "monthlyVolume",
            label: "Estimated Monthly Cargo Volume",
            type: "select",
            options: [
              "Under 1,000 MT per month",
              "1,000 MT – 10,000 MT per month",
              "10,000 MT – 50,000 MT per month",
              "50,000+ MT bulk industrial volume",
            ],
            required: true,
          },
        ],
      },
      {
        title: "Banking & Settlement Method",
        subtitle: "Configure your South African Rand escrow funding preference.",
        fields: [
          {
            id: "bankPartner",
            label: "Primary Business Banking Institution",
            type: "select",
            options: [
              "Standard Bank South Africa",
              "First National Bank (FNB)",
              "Nedbank Group",
              "Absa Corporate & Investment Banking",
              "Investec Bank",
            ],
            required: true,
          },
          {
            id: "escrowFundingMethod",
            label: "Preferred Escrow Deposit Method",
            type: "select",
            options: [
              "Standard Bank Client Trust Account (Direct EFT)",
              "Ozow Instant Bank Settlement",
              "ZARP Rand-Pegged Stablecoin (Base Sepolia)",
            ],
            required: true,
          },
        ],
      },
    ],
  },
  {
    id: "carrier",
    title: "Freight Logistics Carrier / Fleet Operator",
    badge: "Freight Carrier",
    desc: "Transporting cargo, bidding on freight corridors, managing drivers and vehicle assets.",
    redirectUrl: "/html/worker-dashboard.html",
    pill: "WORKER",
    badgeClass: "badge badge-blue",
    steps: [
      {
        title: "Fleet Capacity & Configuration",
        subtitle: "Tell us about your active heavy vehicle fleet and configurations.",
        fields: [
          {
            id: "fleetSize",
            label: "Commercial Fleet Size",
            type: "select",
            options: [
              "Owner Operator (1–2 trucks)",
              "Small Fleet (3–10 trucks)",
              "Medium Fleet (11–35 trucks)",
              "Enterprise Logistics Operator (35+ trucks)",
            ],
            required: true,
          },
          {
            id: "trailerTypes",
            label: "Primary Trailer Configurations",
            type: "multiselect",
            options: [
              "Side-Tippers (Bulk Minerals)",
              "Flatbeds / Superlinks (General Freight)",
              "Tautliners / Curtain-side (FMCG)",
              "Refrigerated (Reefers)",
              "Liquid / Chemical Tankers",
            ],
            required: true,
          },
        ],
      },
      {
        title: "Carrier CIPC & Operating Compliance",
        subtitle: "Confirm road freight operating compliance and permits.",
        fields: [
          {
            id: "carrierCompanyName",
            label: "Registered Carrier Business Name",
            type: "text",
            placeholder: "e.g. Trans-Limpopo Freight Logistics (Pty) Ltd",
            required: true,
          },
          {
            id: "cipcNumber",
            label: "CIPC Registration Number",
            type: "text",
            placeholder: "e.g. 2018/392819/07",
            required: true,
          },
          {
            id: "crossBorderPermit",
            label: "Cross-Border Road Transport Agency (CBRTA) Permit",
            type: "select",
            options: ["Yes – Licensed for SADC Corridors", "No – Domestic South Africa Only"],
          },
        ],
      },
      {
        title: "Goods-in-Transit (GIT) Insurance",
        subtitle: "Provide verified GIT insurance cover required for high-value cargo.",
        fields: [
          {
            id: "gitInsurer",
            label: "Insurance Underwriter",
            type: "text",
            placeholder: "e.g. Santam Commercial / Old Mutual Insure",
            required: true,
          },
          {
            id: "gitPolicyNumber",
            label: "GIT Policy Number",
            type: "text",
            placeholder: "e.g. POL-ZA-89102-GIT",
            required: true,
          },
          {
            id: "gitCoverLimit",
            label: "Maximum GIT Cover Limit per Consignment",
            type: "select",
            options: [
              "R 1,000,000 ZAR per load",
              "R 2,500,000 ZAR per load",
              "R 5,000,000 ZAR per load",
              "R 10,000,000+ ZAR high-value cargo",
            ],
            required: true,
          },
        ],
      },
      {
        title: "Operating Corridors & Driver Dispatch",
        subtitle: "Where do your trucks run and how do you dispatch driver guest links?",
        fields: [
          {
            id: "primaryCorridors",
            label: "Main Transport Corridors",
            type: "text",
            placeholder: "e.g. Johannesburg to Richards Bay / Sishen to Saldanha",
            required: true,
          },
          {
            id: "dispatchMobile",
            label: "Central Dispatch Mobile (SMS / WhatsApp for Driver Tokens)",
            type: "text",
            placeholder: "+27 82 555 0199",
            required: true,
          },
        ],
      },
    ],
  },
  {
    id: "supplier",
    title: "Supplier / Commodity Producer",
    badge: "Supplier / Producer",
    desc: "Supplying bulk commodities, confirming dispatch weighbridge slips, receiving milestone payouts.",
    redirectUrl: "/html/worker-dashboard.html",
    pill: "SUPPLIER",
    badgeClass: "badge badge-blue",
    steps: [
      {
        title: "Commodity & Production Profile",
        subtitle: "Details of commodities or products dispatched from your facility.",
        fields: [
          {
            id: "commodityType",
            label: "Primary Commodity Supplied",
            type: "text",
            placeholder: "e.g. Metallurgical Bauxite / Chrome Concentrate",
            required: true,
          },
          {
            id: "mineLocation",
            label: "Loading Facility / Mine Site Location",
            type: "text",
            placeholder: "e.g. Steelpoort Mine Complex, Limpopo",
            required: true,
          },
          {
            id: "weighbridgeStandard",
            label: "On-Site Certified Weighbridge Available?",
            type: "select",
            options: [
              "Yes – SABS Calibrated Certified Weighbridge",
              "No – Off-Site Third-Party Scale",
            ],
          },
        ],
      },
      {
        title: "Commercial Terms & Incoterms",
        subtitle: "Define your baseline dispatch terms.",
        fields: [
          {
            id: "incoterms",
            label: "Standard Contract Terms (Incoterms 2020)",
            type: "select",
            options: [
              "FCA – Free Carrier (Loaded onto buyer-contracted carrier)",
              "FOB – Free on Board (Loaded onto vessel at port)",
              "EXW – Ex Works (Picked up at mine gate)",
              "CIF – Cost, Insurance and Freight",
            ],
            required: true,
          },
          {
            id: "advanceDispatchPercent",
            label: "Standard Dispatch Advance Tranche Expectation",
            type: "select",
            options: [
              "20% advance upon gate exit dual signature",
              "30% advance with weighbridge slip",
              "10% advance / 90% terminal delivery",
            ],
          },
        ],
      },
      {
        title: "Settlement Payout Account",
        subtitle: "Provide bank details for rule-triggered tranche payouts in ZAR.",
        fields: [
          {
            id: "payoutBank",
            label: "Receiving Bank",
            type: "select",
            options: ["Standard Bank", "First National Bank", "Nedbank", "Absa", "Investec"],
            required: true,
          },
          {
            id: "payoutAccountNumber",
            label: "Account Number",
            type: "text",
            placeholder: "e.g. 1019283746",
            required: true,
          },
          {
            id: "payoutBranchCode",
            label: "Branch Code",
            type: "text",
            placeholder: "e.g. 051001",
            required: true,
          },
        ],
      },
    ],
  },
  {
    id: "driver",
    title: "Frontline Driver / Warehouse Clerk",
    badge: "Frontline Logistics",
    desc: "Physical cargo handling, mobile guest handoffs without apps or wallets, tailgate signatures.",
    redirectUrl: "/html/guest-handoff.html",
    pill: "DRIVER",
    badgeClass: "badge badge-gold",
    steps: [
      {
        title: "Driver Credentials & License",
        subtitle: "Personal identification for physical custody handoff verification.",
        fields: [
          {
            id: "driverIdNumber",
            label: "South African ID or Foreign Passport Number",
            type: "text",
            placeholder: "e.g. 880415 5129 083",
            required: true,
          },
          {
            id: "licenseCode",
            label: "Driver License Code",
            type: "select",
            options: [
              "Code 14 (EC) – Heavy Articulated Vehicle",
              "Code 10 (C1) – Heavy Rigid Vehicle",
              "Warehouse Forklift / Reach Truck Operator",
              "Weighbridge & Yard Receiving Clerk",
            ],
            required: true,
          },
        ],
      },
      {
        title: "Mobile Number for Guest Handoffs",
        subtitle: "Single-use handoff links are sent via SMS or WhatsApp to this smartphone.",
        fields: [
          {
            id: "driverPhone",
            label: "Smartphone Mobile Number",
            type: "text",
            placeholder: "+27 72 345 6789",
            required: true,
          },
          {
            id: "preferredFleet",
            label: "Current Transporter or Warehouse Facility",
            type: "text",
            placeholder: "e.g. Trans-Limpopo Freight / City Deep Cross-Dock",
          },
        ],
      },
      {
        title: "Quick Sign-Off Security PIN",
        subtitle: "Choose a 4-digit PIN for swift dual-party verification at loading gates.",
        fields: [
          {
            id: "driverPin",
            label: "4-Digit Custody Sign-Off PIN",
            type: "text",
            placeholder: "e.g. 4892",
            required: true,
          },
        ],
      },
    ],
  },
  {
    id: "auditor",
    title: "Forensic Auditor / Regulatory Inspector",
    badge: "Auditor & Inspector",
    desc: "Read-only custody inspection, SHA-256 byte proof verification, Base Sepolia block checks.",
    redirectUrl: "/html/auditor-trail.html",
    pill: "AUDITOR",
    badgeClass: "badge badge-neutral",
    steps: [
      {
        title: "Auditing Firm & Accreditation",
        subtitle: "Professional affiliation and credentials.",
        fields: [
          {
            id: "firmName",
            label: "Auditing Firm / Regulatory Agency",
            type: "text",
            placeholder: "e.g. Deloitte Logistics Audit / SARS Customs Inspection",
            required: true,
          },
          {
            id: "accreditationNumber",
            label: "Professional Registration Number (IRBA / SAICA / Customs Broker)",
            type: "text",
            placeholder: "e.g. IRBA-2024-9182",
            required: true,
          },
        ],
      },
      {
        title: "Inspection Scope",
        subtitle: "Define your compliance mandate on Patella.",
        fields: [
          {
            id: "auditScope",
            label: "Audit & Verification Scope",
            type: "multiselect",
            options: [
              "Bank Client Trust Account Solvency & Reconciliation",
              "Two-Party Custody Chain & Dual Digital Signatures",
              "Document Byte Hashing & Base Sepolia Block Anchors",
              "Isolated Dispute Reserve Holding Compliance",
            ],
            required: true,
          },
        ],
      },
      {
        title: "Cryptographic Attestation Key",
        subtitle: "Configure public key for signing audit certificates.",
        fields: [
          {
            id: "auditorPublicKey",
            label: "Verification Public Key / Fingerprint (Optional)",
            type: "text",
            placeholder: "0x4f8a92... or leave blank to auto-generate WebCrypto key",
          },
        ],
      },
    ],
  },
];

export function SignUpView() {
  const router = useRouter();

  // Step 1: Initial signup fields
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("+27 ");
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");
  const [demoCode, setDemoCode] = useState("");
  const [busy, runBackend] = useBackendTask("Sign-up failed. Try again.");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<RoleType>("buyer");

  // Workflow stages: "register" -> "onboarding" -> "completed"
  const [stage, setStage] = useState<"register" | "onboarding" | "completed">("register");

  // Step 2: Progressive Questionnaire index (one question by one question)
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [extraData, setExtraData] = useState<Record<string, string | string[]>>({});

  const activeRoleConfig = ROLES.find((r) => r.id === role) || ROLES[0];
  const totalExtraSteps = activeRoleConfig.steps.length;
  const currentStep = activeRoleConfig.steps[currentStepIdx] || activeRoleConfig.steps[0];

  function detailsAreValid(): boolean {
    if (!fullName.trim() || fullName.trim().length < 3) {
      toast.error("Please enter your full legal name (at least 3 characters).");
      return false;
    }
    if (!isEmail(email.trim())) {
      toast.error("Please enter a valid business email address.");
      return false;
    }
    if (!phone.trim() || phone.trim().length < 8) {
      toast.error("Please enter a valid South African mobile number (+27).");
      return false;
    }
    return true;
  }

  // The account exists once the email is verified (the session cookie is set);
  // save the name on it, then onboard.
  async function accountCreated() {
    const named = await patelaApi.updateName(fullName.trim());
    setProfile(named);
    saveAuthUser({ ...toAuthUser(named), phone });
    toast.success(
      `Account created for ${named.full_name ?? fullName}. Let's complete your ${activeRoleConfig.badge} profile.`,
    );
    setStage("onboarding");
    setCurrentStepIdx(0);
  }

  function handleInitialSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!detailsAreValid()) return;
    const address = email.trim();
    if (!codeSent) {
      runBackend(async () => {
        const result = await patelaApi.requestOtp(address);
        setCodeSent(true);
        if (result.demo && isOtpCode(result.code ?? "")) {
          setCode(result.code!);
          setDemoCode(result.code!);
          toast.info("Demo code filled in. Select Verify code.");
        } else {
          toast.info("Code requested. Enter the 6-digit code to create your account.");
        }
      });
      return;
    }
    if (!isOtpCode(code)) {
      toast.error("Enter the 6-digit code.");
      return;
    }
    runBackend(async () => {
      await patelaApi.verifyOtp(address, code);
      await accountCreated();
    });
  }

  function handleGoogle(credential: string) {
    if (!detailsAreValid()) return;
    runBackend(async () => {
      await patelaApi.googleSignIn(credential);
      await accountCreated();
    });
  }

  function handleFieldChange(fieldId: string, value: string) {
    setExtraData((prev) => ({ ...prev, [fieldId]: value }));
  }

  function handleMultiSelectToggle(fieldId: string, option: string) {
    setExtraData((prev) => {
      const currentList = Array.isArray(prev[fieldId]) ? (prev[fieldId] as string[]) : [];
      if (currentList.includes(option)) {
        return { ...prev, [fieldId]: currentList.filter((x) => x !== option) };
      } else {
        return { ...prev, [fieldId]: [...currentList, option] };
      }
    });
  }

  function handleNextStep(e: React.FormEvent) {
    e.preventDefault();
    // Validate current step required fields
    for (const f of currentStep.fields) {
      if (f.required) {
        const val = extraData[f.id];
        if (!val || (Array.isArray(val) && val.length === 0)) {
          toast.error(`Please provide ${f.label} before continuing.`);
          return;
        }
      }
    }

    if (currentStepIdx < totalExtraSteps - 1) {
      setCurrentStepIdx((idx) => idx + 1);
    } else {
      // Finished all extra questions one by one!
      const appRole = role === "buyer" ? "client" : role === "auditor" ? "auditor" : "worker";
      // Demo: the backend cannot store marketplace roles or onboarding answers
      // yet, so they stay in this browser next to the real account's details.
      const userProfile = {
        ...(profile ? toAuthUser(profile) : {}),
        fullName: profile?.full_name ?? fullName,
        email: profile?.email ?? email,
        phone,
        role: appRole,
        rawRole: role,
        roleTitle: activeRoleConfig.title,
        extraData,
        extraDataStoredLocally: true,
        registeredAt: new Date().toISOString(),
        verified: true,
      };
      saveAuthUser(userProfile);
      try {
        localStorage.setItem("patela_current_role", appRole);
      } catch {
        /* storage unavailable: the role stays in memory only */
      }
      setStage("completed");
      toast.success("All profile details verified!");
    }
  }

  function handlePrevStep() {
    if (currentStepIdx > 0) {
      setCurrentStepIdx((idx) => idx - 1);
    } else {
      setStage("register");
    }
  }

  return (
    <div className="pt-app" style={{ minHeight: "100vh" }}>
      <SiteNav />
      <main className="pt-wrap" style={{ maxWidth: 880, padding: "40px 20px 100px" }}>
        {/* Stage 1: Initial Registration */}
        {stage === "register" && (
          <Reveal>
            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <span className="pt-eyebrow">Enterprise Supply Chain Onboarding</span>
              <h1 className="pt-h2" style={{ margin: "10px auto 14px", maxWidth: "22ch" }}>
                Create your Patella account.
              </h1>
              <p className="pt-lead" style={{ margin: "0 auto", maxWidth: "56ch" }}>
                Select your role in the supply chain corridor. After signing up, we will configure
                your profile with step-by-step role information.
              </p>
              <p
                className="pt-card"
                style={{
                  margin: "18px auto 0",
                  maxWidth: "60ch",
                  padding: "14px 18px",
                  fontSize: "0.9rem",
                }}
              >
                Buying in the escrow demo?{" "}
                <Link
                  href="/signin?next=/orders/new"
                  style={{ color: "#ffe2b2", fontWeight: 600, textDecoration: "underline" }}
                >
                  Sign in with an email code
                </Link>{" "}
                — your Patela account is created on first sign-in. The profile questions below are a
                demo preview stored in this browser only.
              </p>
            </div>

            <form
              className="pt-form pt-card"
              onSubmit={handleInitialSubmit}
              style={{ padding: "36px 32px" }}
            >
              <div style={{ marginBottom: 12 }}>
                <label className="pt-flabel" style={{ marginBottom: 14, display: "block" }}>
                  1. Select your role in the supply chain:
                </label>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: 12,
                  }}
                >
                  {ROLES.map((r) => {
                    const isSelected = role === r.id;
                    return (
                      <div
                        key={r.id}
                        onClick={() => setRole(r.id)}
                        style={{
                          border: `1px solid ${isSelected ? "rgba(255, 228, 182, 0.7)" : "rgba(196, 214, 232, 0.16)"}`,
                          background: isSelected
                            ? "rgba(255, 226, 178, 0.09)"
                            : "rgba(255, 255, 255, 0.02)",
                          borderRadius: 14,
                          padding: "16px 14px",
                          cursor: "pointer",
                          transition: "all 0.3s ease",
                          boxShadow: isSelected ? "0 0 20px rgba(255, 224, 176, 0.15)" : "none",
                        }}
                      >
                        <div
                          style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}
                        >
                          <span
                            className={r.badgeClass}
                            style={{
                              fontSize: "0.68rem",
                              padding: "2px 7px",
                              letterSpacing: "0.04em",
                            }}
                          >
                            {r.pill}
                          </span>
                          <span
                            style={{
                              fontWeight: 600,
                              fontSize: "0.95rem",
                              color: isSelected ? "#ffe2b2" : "#fff",
                            }}
                          >
                            {r.badge}
                          </span>
                        </div>
                        <p
                          style={{
                            margin: 0,
                            fontSize: "0.8rem",
                            color: "#a2a9b8",
                            lineHeight: 1.4,
                          }}
                        >
                          {r.desc}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                  gap: 18,
                }}
              >
                <div className="pt-field">
                  <label htmlFor="fn">Full Name / Primary Contact</label>
                  <input
                    id="fn"
                    className="pt-in"
                    placeholder="e.g. Alex Vance"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
                <div className="pt-field">
                  <label htmlFor="em">Business Email</label>
                  <input
                    id="em"
                    type="email"
                    className="pt-in"
                    placeholder="alex@resources.co.za"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setCodeSent(false);
                      setCode("");
                      setDemoCode("");
                    }}
                    required
                  />
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                  gap: 18,
                }}
              >
                <div className="pt-field">
                  <label htmlFor="ph">Mobile Number (SMS / WhatsApp +27)</label>
                  <input
                    id="ph"
                    className="pt-in"
                    placeholder="+27 82 000 0000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                  />
                  <small>
                    Used for two-party mobile handoffs and instant release notifications.
                  </small>
                </div>
                <div className="pt-field">
                  <label htmlFor="otp">Email verification code</label>
                  {codeSent ? (
                    <>
                      <input
                        id="otp"
                        className="pt-in"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        placeholder="6-digit code"
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        required
                      />
                      <small>Valid for 10 minutes. Change the email above to start again.</small>
                      {demoCode ? (
                        <small>
                          Demo code: <strong>{demoCode}</strong> (filled in above)
                        </small>
                      ) : null}
                    </>
                  ) : (
                    <small>
                      No password needed. When demo email delivery is off, the 6-digit code appears
                      here instead.
                    </small>
                  )}
                </div>
              </div>

              <div className="pt-field">
                {googleSignInAvailable ? <GoogleSignInButton onCredential={handleGoogle} /> : null}
                <small>
                  Your role and onboarding answers are kept in this browser only (demo) until the
                  Patela server can store them.
                </small>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginTop: 24,
                  flexWrap: "wrap",
                  gap: 14,
                }}
              >
                <span style={{ fontSize: "0.85rem", color: "#a2a9b8" }}>
                  Already registered?{" "}
                  <Link href="/signin" style={{ color: "#ffe2b2", textDecoration: "underline" }}>
                    Sign in here
                  </Link>
                </span>
                <button
                  type="submit"
                  className="pt-btn"
                  disabled={busy}
                  style={{ padding: "12px 28px", fontSize: "0.95rem" }}
                >
                  <span>
                    {busy
                      ? "Please wait…"
                      : codeSent
                        ? `Verify & Proceed to ${activeRoleConfig.badge} Profile`
                        : "Send Verification Code"}
                  </span>
                  <span aria-hidden="true">→</span>
                </button>
              </div>
            </form>
          </Reveal>
        )}

        {/* Stage 2: Progressive One-By-One Questionnaire */}
        {stage === "onboarding" && (
          <Reveal>
            <div style={{ marginBottom: 28 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 12,
                }}
              >
                <span className="pt-eyebrow" style={{ margin: 0 }}>
                  {activeRoleConfig.title} Onboarding
                </span>
                <span
                  className="pt-badge"
                  style={{ borderColor: "rgba(255, 228, 182, 0.4)", color: "#ffe2b2" }}
                >
                  Step {currentStepIdx + 1} of {totalExtraSteps}
                </span>
              </div>
              {/* Progress bar */}
              <div
                style={{
                  width: "100%",
                  height: 6,
                  background: "rgba(255, 255, 255, 0.08)",
                  borderRadius: 999,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${((currentStepIdx + 1) / totalExtraSteps) * 100}%`,
                    background: "linear-gradient(90deg, #ffe2b2, #96c4f4)",
                    transition: "width 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
                  }}
                />
              </div>
            </div>

            <form
              className="pt-form pt-card"
              onSubmit={handleNextStep}
              style={{ padding: "36px 32px" }}
            >
              <div>
                <h2 className="pt-h2" style={{ fontSize: "1.45rem", margin: "0 0 6px" }}>
                  {currentStep.title}
                </h2>
                <p style={{ color: "#a2a9b8", fontSize: "0.95rem", margin: "0 0 24px" }}>
                  {currentStep.subtitle}
                </p>
              </div>

              <div style={{ display: "grid", gap: 20 }}>
                {currentStep.fields.map((f) => {
                  const val = extraData[f.id] || "";
                  return (
                    <div className="pt-field" key={f.id}>
                      <label htmlFor={f.id}>
                        {f.label} {f.required && <span style={{ color: "#ffe2b2" }}>*</span>}
                      </label>

                      {f.type === "text" && (
                        <input
                          id={f.id}
                          className="pt-in"
                          placeholder={f.placeholder}
                          value={typeof val === "string" ? val : ""}
                          onChange={(e) => handleFieldChange(f.id, e.target.value)}
                          required={f.required}
                        />
                      )}

                      {f.type === "select" && f.options && (
                        <select
                          id={f.id}
                          className="pt-in"
                          style={{ background: "#050b18", color: "#fff" }}
                          value={typeof val === "string" ? val : f.options[0]}
                          onChange={(e) => handleFieldChange(f.id, e.target.value)}
                          required={f.required}
                        >
                          <option value="" disabled>
                            Select an option...
                          </option>
                          {f.options.map((opt) => (
                            <option key={opt} value={opt} style={{ background: "#050b18" }}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      )}

                      {f.type === "multiselect" && f.options && (
                        <div style={{ display: "grid", gap: 8, marginTop: 4 }}>
                          {f.options.map((opt) => {
                            const selectedList = Array.isArray(val) ? val : [];
                            const isChecked = selectedList.includes(opt);
                            return (
                              <div
                                key={opt}
                                onClick={() => handleMultiSelectToggle(f.id, opt)}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 12,
                                  padding: "12px 14px",
                                  borderRadius: 12,
                                  cursor: "pointer",
                                  border: `1px solid ${isChecked ? "rgba(255, 228, 182, 0.6)" : "rgba(196, 214, 232, 0.15)"}`,
                                  background: isChecked
                                    ? "rgba(255, 226, 178, 0.08)"
                                    : "rgba(255, 255, 255, 0.02)",
                                  color: isChecked ? "#ffe2b2" : "#d8dfeb",
                                  transition: "all 0.2s ease",
                                }}
                              >
                                <span
                                  style={{
                                    width: 18,
                                    height: 18,
                                    borderRadius: 4,
                                    border: `1px solid ${isChecked ? "#ffe2b2" : "rgba(196, 214, 232, 0.3)"}`,
                                    display: "grid",
                                    placeItems: "center",
                                    background: isChecked ? "#ffe2b2" : "transparent",
                                    color: "#02060f",
                                  }}
                                >
                                  {isChecked ? (
                                    <svg
                                      viewBox="0 0 16 16"
                                      width="11"
                                      height="11"
                                      stroke="#02060f"
                                      strokeWidth="2.5"
                                      fill="none"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      aria-hidden="true"
                                    >
                                      <path d="M3 8.5 L6.5 12 L13 4" />
                                    </svg>
                                  ) : null}
                                </span>
                                <span style={{ fontSize: "0.9rem" }}>{opt}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginTop: 32,
                  gap: 14,
                }}
              >
                <button
                  type="button"
                  onClick={handlePrevStep}
                  className="pt-btn ghost"
                  style={{ padding: "10px 20px" }}
                >
                  <span>← Previous</span>
                </button>
                <button type="submit" className="pt-btn" style={{ padding: "12px 28px" }}>
                  <span>
                    {currentStepIdx === totalExtraSteps - 1
                      ? "Complete Verification & Finish Setup →"
                      : "Save & Next Step →"}
                  </span>
                </button>
              </div>
            </form>
          </Reveal>
        )}

        {/* Stage 3: Completed Profile Confirmation */}
        {stage === "completed" && (
          <Reveal>
            <div className="pt-card" style={{ padding: "48px 36px", textAlign: "center" }}>
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: "50%",
                  background:
                    "linear-gradient(135deg, rgba(255, 228, 182, 0.25), rgba(150, 196, 244, 0.25))",
                  border: "1px solid rgba(255, 228, 182, 0.6)",
                  display: "grid",
                  placeItems: "center",
                  margin: "0 auto 20px",
                }}
              >
                <svg
                  viewBox="0 0 24 24"
                  width="32"
                  height="32"
                  stroke="#ffe2b2"
                  strokeWidth="2.2"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <span className="pt-eyebrow">Onboarding Complete</span>
              <h1 className="pt-h2" style={{ margin: "8px 0 12px" }}>
                Welcome to Patella, {fullName}!
              </h1>
              <p className="pt-lead" style={{ maxWidth: "54ch", margin: "0 auto 28px" }}>
                Your {activeRoleConfig.title} credentials and corridor details have been verified in
                the demo registry. You now have full access to your role workspace.
              </p>

              <div
                style={{
                  background: "rgba(2, 6, 15, 0.5)",
                  border: "1px solid rgba(217, 195, 154, 0.3)",
                  borderRadius: 14,
                  padding: "20px",
                  textAlign: "left",
                  maxWidth: 600,
                  margin: "0 auto 32px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 14,
                  }}
                >
                  <span style={{ fontWeight: 600, color: "#ffe2b2", fontSize: "0.95rem" }}>
                    Verified Profile Summary
                  </span>
                  <span className="badge badge-gold" style={{ fontSize: "0.75rem" }}>
                    CIPC Verified Demo
                  </span>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 12,
                    fontSize: "0.85rem",
                  }}
                >
                  <div>
                    <span style={{ color: "#7c8596" }}>Role / Model:</span>
                    <div style={{ color: "#fff", fontWeight: 500 }}>{activeRoleConfig.badge}</div>
                  </div>
                  <div>
                    <span style={{ color: "#7c8596" }}>Contact Email:</span>
                    <div style={{ color: "#fff", fontWeight: 500 }}>{email}</div>
                  </div>
                  <div>
                    <span style={{ color: "#7c8596" }}>Mobile / Dispatch:</span>
                    <div style={{ color: "#fff", fontWeight: 500 }}>{phone}</div>
                  </div>
                  <div>
                    <span style={{ color: "#7c8596" }}>Assigned Workspace:</span>
                    <div style={{ color: "#96c4f4", fontWeight: 500 }}>
                      {activeRoleConfig.redirectUrl}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "center", gap: 14, flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="pt-btn"
                  onClick={() => router.push(activeRoleConfig.redirectUrl)}
                  style={{ padding: "14px 36px", fontSize: "1rem" }}
                >
                  <span>Launch {activeRoleConfig.badge} Workspace</span>
                  <span aria-hidden="true">→</span>
                </button>
                <Link
                  href="/html/index.html"
                  className="pt-btn ghost"
                  style={{ padding: "14px 28px" }}
                >
                  <span>Return to Blueprint Hub</span>
                </Link>
              </div>
            </div>
          </Reveal>
        )}
      </main>
    </div>
  );
}
