import { formatUnits } from "viem";

/**
 * Branded HTML bodies for Patela emails, styled after the landing page: deep navy and white
 * condensed capitals. Email clients ignore <style> blocks and web fonts unevenly,
 * so everything is inline, laid out with tables, and the display face falls back to Impact.
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

const NAVY = "#01172d";
const WHITE = "#ffffff";
/** A pale navy tint for the page and boxes, so the palette stays navy and white. */
const TINT = "#eef2f7";
const SUB = "#5b6575";
const LINE = "#dfe5ec";
const DISPLAY = "'Mona Sans','Arial Narrow',Impact,sans-serif";
const BODY = "Helvetica,Arial,sans-serif";
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

function shell(preheader: string, headline: string, body: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><title>Patela</title></head>
<body style="margin:0;padding:0;background:${TINT};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${TINT};">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:18px;overflow:hidden;">
<tr><td style="background:${NAVY};padding:28px 32px 36px;">
  <div style="font-family:${DISPLAY};font-weight:800;font-size:22px;letter-spacing:1px;color:${WHITE};"><span style="font-style:italic;">//</span> PATELA.</div>
  <h1 style="margin:28px 0 0;font-family:${DISPLAY};font-weight:800;font-size:40px;line-height:1;letter-spacing:-0.5px;text-transform:uppercase;color:${WHITE};">${headline}</h1>
</td></tr>
<tr><td style="padding:32px;font-family:${BODY};font-size:15px;line-height:1.55;color:${NAVY};">
${body}
</td></tr>
<tr><td style="padding:20px 32px 28px;border-top:1px solid ${LINE};font-family:${BODY};font-size:12px;line-height:1.5;color:${SUB};">
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
    "Your sign-in<br>code.",
    `<p style="margin:0 0 20px;">Enter this code on Patela to finish signing in.</p>
<div style="background:${TINT};border-radius:14px;padding:22px;text-align:center;">
  <div style="font-family:${MONO};font-size:38px;font-weight:700;letter-spacing:10px;color:${NAVY};">${digits}</div>
</div>
<p style="margin:20px 0 0;color:${SUB};font-size:13px;">It expires in 10 minutes and works once. Patela will never ask you for this code by phone or chat.</p>`,
  );
}

function row(label: string, value: string, opts: { strong?: boolean } = {}) {
  const weight = opts.strong ? "700" : "400";
  return `<tr>
  <td style="padding:10px 0;border-bottom:1px solid ${LINE};font-weight:${weight};color:${NAVY};">${label}</td>
  <td align="right" style="padding:10px 0;border-bottom:1px solid ${LINE};font-weight:${weight};color:${NAVY};white-space:nowrap;">${value}</td>
</tr>`;
}

function detail(label: string, value: string, mono = false) {
  return `<tr><td style="padding:4px 12px 4px 0;color:${SUB};font-size:12px;vertical-align:top;white-space:nowrap;">${label}</td>
<td style="padding:4px 0;font-size:12px;word-break:break-all;${mono ? `font-family:${MONO};` : ""}">${value}</td></tr>`;
}

export function orderInviteHtml(options: {
  role: "supplier" | "driver";
  acceptUrl: string;
  agreementText?: string;
  invoice?: InvoiceDetails;
}): string {
  const { role, invoice } = options;
  const href = escapeHtml(options.acceptUrl);
  const button = `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 8px;"><tr>
<td style="background:${NAVY};border-radius:999px;">
  <a href="${href}" style="display:inline-block;padding:15px 30px;font-family:${DISPLAY};font-weight:800;font-size:16px;letter-spacing:1px;text-transform:uppercase;color:${WHITE};text-decoration:none;">Review &amp; accept</a>
</td></tr></table>
<p style="margin:0;color:${SUB};font-size:12px;">The link works once. Accepting asks you to sign with your wallet.</p>`;

  const agreement = options.agreementText
    ? `<h2 style="margin:28px 0 8px;font-family:${DISPLAY};font-weight:800;font-size:18px;text-transform:uppercase;">Agreement</h2>
<div style="background:${TINT};border-radius:12px;padding:14px 16px;white-space:pre-wrap;">${escapeHtml(options.agreementText)}</div>`
    : "";

  let invoiceBlock = "";
  if (invoice) {
    const zar = (wei: string) => `${formatZarm(wei)} ZARm`;
    const payout =
      role === "supplier"
        ? (BigInt(invoice.supplierAtPickupWei) + BigInt(invoice.supplierAtDeliveryWei)).toString()
        : invoice.driverAtPickupWei;
    const deadline = new Date(invoice.refundDeadline).toUTCString().replace(" GMT", " UTC");
    invoiceBlock = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;">
<tr><td style="font-family:${DISPLAY};font-weight:800;font-size:18px;text-transform:uppercase;">Invoice</td>
<td align="right" style="font-family:${MONO};font-size:12px;color:${SUB};">ORDER ${escapeHtml(shortId(invoice.orderId))}</td></tr>
</table>
<p style="margin:4px 0 12px;color:${SUB};font-size:13px;">From ${escapeHtml(invoice.buyerEmail)}. The buyer locks the full amount in escrow; each payment releases at its handoff.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
${row("Driver &middot; paid at pickup", zar(invoice.driverAtPickupWei))}
${row("Supplier &middot; paid at pickup", zar(invoice.supplierAtPickupWei))}
${row("Supplier &middot; paid at delivery", zar(invoice.supplierAtDeliveryWei))}
${row("Total held in escrow", zar(invoice.totalWei), { strong: true })}
${row("Your payout", zar(payout), { strong: true })}
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;">
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
    `You're the<br>${role}.`,
    `<p style="margin:0;">${intro}</p>
${invoiceBlock}
${agreement}
${button}
<p style="margin:24px 0 0;padding:12px 14px;border-left:3px solid ${NAVY};background:${TINT};font-size:12px;color:${NAVY};">Before signing, check your wallet shows the same network, ZARm amount and escrow contract as this email.</p>`,
  );
}
