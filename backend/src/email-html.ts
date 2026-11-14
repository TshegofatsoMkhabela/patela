import { formatUnits } from "viem";

/**
 * Branded HTML bodies for Patela emails, styled after the sign-in page: a deep navy page, the
 * Patela logo, a sentence-case heading, and a navy card with a light border. Email clients ignore
 * <style> blocks, translucency and web fonts unevenly, so everything is inline and solid, laid out
 * with tables, and Sora falls back to system sans-serif.
 */

/** What an order invite needs to show the invoice. Amounts are token base units (18 decimals). */
export type InvoiceDetails = {
  orderId: string;
  buyerEmail: string;
  totalWei: string;
  driverAtPickupWei: string;
  supplierAtPickupWei: string;
  supplierAtDeliveryWei: string;
  chainId: number;
  tokenAddress: string;
  escrowAddress: string;
  agreementHash: string;
  refundDeadline: string;
};

// The sign-in page's palette (src/styles/country-onboarding.css), made solid for email.
const PAGE = "#041d36";
const CARD = "#082640";
const BORDER = "#2f4d66";
const FIELD = "#062038";
const PILL = "#12334f";
const TEXT = "#ffffff";
const SUB = "#b3c4ce";
const LINE = "#1f3d58";
const INK = "#061d35";
const FONT = "Sora,'Segoe UI',Helvetica,Arial,sans-serif";
const MONO = "ui-monospace,Menlo,Consolas,monospace";

export const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/** 1000000000000000000000 -> "1,000.00" (two decimals, rounded down, thousands grouped). */
export function formatZarm(wei: string): string {
  const [whole, fraction = ""] = formatUnits(BigInt(wei), 18).split(".");
  return `${BigInt(whole).toLocaleString("en-US")}.${fraction.padEnd(2, "0").slice(0, 2)}`;
}

export const networkName = (chainId: number) =>
  chainId === 42220 ? "Celo" : chainId === 11142220 ? "Celo Sepolia (testnet)" : `Chain ${chainId}`;

const shortId = (id: string) => id.slice(0, 8).toUpperCase();

/** The site's own logo (light on navy). Without a public origin, a text wordmark stands in. */
function logo(): string {
  const origin = process.env.PUBLIC_ORIGIN;
  if (origin && /^https?:\/\//.test(origin)) {
    const src = escapeHtml(new URL("/patela-logo.png", origin).toString());
    return `<img src="${src}" width="210" alt="Patela" style="display:block;margin:0 auto;width:210px;max-width:100%;height:auto;border:0;">`;
  }
  return `<div style="font-family:${FONT};font-weight:800;font-size:26px;letter-spacing:1px;color:${TEXT};">PATELA.</div>`;
}

function shell(preheader: string, heading: string, body: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"><title>Patela</title></head>
<body style="margin:0;padding:0;background:${PAGE};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAGE};">
<tr><td align="center" style="padding:40px 16px;font-family:${FONT};color:${TEXT};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:500px;">
<tr><td align="center">${logo()}</td></tr>
<tr><td align="center"><h1 style="margin:18px 0;font-family:${FONT};font-size:26px;font-weight:600;letter-spacing:-1px;color:${TEXT};">${heading}</h1></td></tr>
<tr><td style="background:${CARD};border:1px solid ${BORDER};border-radius:21px;padding:24px;font-family:${FONT};font-size:14px;line-height:1.55;color:${TEXT};">
${body}
</td></tr>
<tr><td align="center" style="padding:20px 8px 0;font-family:${FONT};font-size:12px;line-height:1.5;color:${SUB};">
  Patela &middot; Every handoff accounted for.<br>
  You received this because someone used this address on Patela. If that wasn't you, ignore this email.
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

export function loginCodeHtml(code: string): string {
  const digits = escapeHtml(code);
  return shell(
    `Your Patela sign-in code is ${code}`,
    "Your sign-in code",
    `<p style="margin:0 0 16px;">Enter this code on Patela to finish signing in.</p>
<div style="background:${FIELD};border:1px solid ${BORDER};border-radius:12px;padding:20px;text-align:center;">
  <div style="font-family:${MONO};font-size:36px;font-weight:700;letter-spacing:10px;color:${TEXT};">${digits}</div>
</div>
<p style="margin:16px 0 0;color:${SUB};font-size:12px;">It expires in 10 minutes and works once. Patela will never ask you for this code by phone or chat.</p>`,
  );
}

function row(label: string, value: string, opts: { strong?: boolean } = {}) {
  const weight = opts.strong ? "700" : "400";
  return `<tr>
  <td style="padding:10px 0;border-bottom:1px solid ${LINE};font-weight:${weight};color:${TEXT};">${label}</td>
  <td align="right" style="padding:10px 0;border-bottom:1px solid ${LINE};font-weight:${weight};color:${TEXT};white-space:nowrap;">${value}</td>
</tr>`;
}

function detail(label: string, value: string, mono = false) {
  return `<tr><td style="padding:4px 12px 4px 0;color:${SUB};font-size:12px;vertical-align:top;white-space:nowrap;">${label}</td>
<td style="padding:4px 0;font-size:12px;color:${TEXT};word-break:break-all;${mono ? `font-family:${MONO};` : ""}">${value}</td></tr>`;
}

const SECTION_TITLE =
  `font-family:${FONT};font-size:15px;font-weight:600;color:${TEXT};`;

export function orderInviteHtml(options: {
  role: "supplier" | "driver";
  acceptUrl: string;
  agreementText?: string;
  invoice?: InvoiceDetails;
}): string {
  const { role, invoice } = options;
  const href = escapeHtml(options.acceptUrl);
  // White pill with navy text, like the sign-in page's active tab.
  const button = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 8px;"><tr>
<td align="center" style="background:${TEXT};border-radius:11px;">
  <a href="${href}" style="display:block;padding:14px 24px;font-family:${FONT};font-weight:600;font-size:15px;color:${INK};text-decoration:none;">Review &amp; accept</a>
</td></tr></table>
<p style="margin:0;color:${SUB};font-size:12px;text-align:center;">The link works once. Accepting asks you to sign with your wallet.</p>`;

  const agreement = options.agreementText
    ? `<div style="margin:24px 0 8px;${SECTION_TITLE}">Agreement</div>
<div style="background:${FIELD};border:1px solid ${BORDER};border-radius:10px;padding:12px 14px;white-space:pre-wrap;">${escapeHtml(options.agreementText)}</div>`
    : "";

  let invoiceBlock = "";
  if (invoice) {
    const zar = (wei: string) => `${formatZarm(wei)} ZARm`;
    const payout =
      role === "supplier"
        ? (BigInt(invoice.supplierAtPickupWei) + BigInt(invoice.supplierAtDeliveryWei)).toString()
        : invoice.driverAtPickupWei;
    const deadline = new Date(invoice.refundDeadline).toUTCString().replace(" GMT", " UTC");
    invoiceBlock = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;">
<tr><td style="${SECTION_TITLE}">Invoice</td>
<td align="right" style="font-family:${MONO};font-size:12px;color:${SUB};">ORDER ${escapeHtml(shortId(invoice.orderId))}</td></tr>
</table>
<p style="margin:4px 0 10px;color:${SUB};font-size:12px;">From ${escapeHtml(invoice.buyerEmail)}. The buyer locks the full amount in escrow; each payment releases at its handoff.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
${row("Driver &middot; paid at pickup", zar(invoice.driverAtPickupWei))}
${row("Supplier &middot; paid at pickup", zar(invoice.supplierAtPickupWei))}
${row("Supplier &middot; paid at delivery", zar(invoice.supplierAtDeliveryWei))}
${row("Total held in escrow", zar(invoice.totalWei), { strong: true })}
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;background:${PILL};border-radius:11px;">
<tr><td style="padding:12px 14px;font-weight:600;color:${TEXT};">Your payout</td>
<td align="right" style="padding:12px 14px;font-weight:700;color:${TEXT};white-space:nowrap;">${zar(payout)}</td></tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
${detail("Network", escapeHtml(networkName(invoice.chainId)))}
${detail("Token", `ZARm &middot; ${escapeHtml(invoice.tokenAddress)}`, true)}
${detail("Escrow contract", escapeHtml(invoice.escrowAddress), true)}
${detail("Agreement hash", escapeHtml(invoice.agreementHash), true)}
${detail("Refund if undelivered", escapeHtml(deadline))}
</table>`;
  }

  const intro =
    role === "supplier"
      ? "A buyer wants to place an order with you. Review the agreement and invoice, then accept the contract on Celo."
      : "A supplier wants you to carry this order. Review the payment, then accept the contract on Celo.";

  return shell(
    `You're invited as the ${role} on a Patela order`,
    `You're invited as the ${role}`,
    `<p style="margin:0;">${intro}</p>
${invoiceBlock}
${agreement}
${button}
<p style="margin:20px 0 0;padding:12px 14px;border:1px solid ${BORDER};border-radius:10px;background:${FIELD};font-size:12px;color:${SUB};">Before signing, check your wallet shows the same network, ZARm amount and escrow contract as this email.</p>`,
  );
}
