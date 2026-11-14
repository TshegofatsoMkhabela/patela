import { formatZarp } from "@/components/BalancePanel";
import { keccak256, toBytes } from "viem";
import { slaApprovalMessage, type SlaRecord } from "./sla";

type Page = { lines: string[]; links: { url: string; rect: number[] }[] };
const NAVY = "0.018 0.09 0.17";
const BLUE = "0.06 0.19 0.30";
const MUTED = "0.37 0.44 0.51";
const PAGE_W = 595;
const PAGE_H = 842;
const LEFT = 48;
const RIGHT = 547;

// PDF base fonts use WinAnsi. Preserve common punctuation and make unsupported glyphs explicit.
const pdfText = (s: string) =>
  s
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2022/g, "-")
    .replace(/[^\x20-\x7E\n]/g, "?")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");

function money(wei: string) {
  try {
    return `R ${formatZarp(BigInt(wei))}`;
  } catch {
    return "Not recorded";
  }
}

function wrap(text: string, max = 94): string[] {
  return text.split(/\r?\n/).flatMap((line) => {
    if (!line.trim()) return [""];
    const words = line.split(/\s+/);
    const out: string[] = [];
    let current = "";
    for (const word of words) {
      if (current && current.length + word.length + 1 > max) {
        out.push(current);
        current = "";
      }
      if (word.length > max) {
        if (current) out.push(current);
        for (let i = 0; i < word.length; i += max) out.push(word.slice(i, i + max));
        current = "";
      } else current = current ? `${current} ${word}` : word;
    }
    if (current) out.push(current);
    return out;
  });
}

/** A self-contained, selectable-text A4 PDF with an external-link annotation. */
export function buildSlaPdf(record: SlaRecord, signature: string): Uint8Array {
  const pages: Page[] = [];
  let page!: Page;
  let y = 0;
  const start = () => {
    page = { lines: [], links: [] };
    pages.push(page);
    page.lines.push(`${NAVY} rg 0 754 ${PAGE_W} 88 re f`);
    page.lines.push(`BT /F2 11 Tf 1 1 1 rg ${LEFT} 804 Td (PATELA) Tj ET`);
    page.lines.push(`BT /F2 22 Tf 1 1 1 rg ${LEFT} 774 Td (SERVICE LEVEL AGREEMENT) Tj ET`);
    y = 728;
  };
  const room = (needed: number) => {
    if (y - needed < 60) start();
  };
  const draw = (text: string, size = 10, color = NAVY, bold = false, indent = 0) => {
    room(size + 9);
    page.lines.push(
      `BT /${bold ? "F2" : "F1"} ${size} Tf ${color} rg ${LEFT + indent} ${y} Td (${pdfText(text)}) Tj ET`,
    );
    y -= size + 6;
  };
  const section = (title: string) => {
    room(36);
    y -= 8;
    draw(title, 11, BLUE, true);
    page.lines.push(`0.77 0.84 0.89 RG ${LEFT} ${y + 7} m ${RIGHT} ${y + 7} l S`);
    y -= 5;
  };
  const para = (text: string) => {
    for (const line of wrap(text)) draw(line, 9, NAVY);
    y -= 5;
  };
  const field = (label: string, value: string) => {
    for (const line of wrap(`${label}: ${value || "Not recorded"}`, 88)) draw(line, 9, NAVY);
  };
  start();
  draw(`Order ${record.orderId}  |  Chain order #${record.chainOrderId}`, 10, MUTED, true);
  draw(`Signed ${record.signedAt}  |  ${record.network} (chain ${record.chainId})`, 9, MUTED);
  y -= 8;

  section("1. Parties and purpose");
  field("Buyer", `${record.buyerEmail || "Email not recorded"}  /  ${record.buyerWallet}`);
  field("Supplier", record.supplierEmail || "Email not recorded");
  field("Supplier wallet", record.supplierWallet || "Not linked");
  para(
    "This record sets out the delivery scope and payment milestones for the order above. The buyer's wallet approval is shown below. Supplier approval is a separate event.",
  );

  section("2. Scope and service levels");
  para(record.agreementText || "No scope text was recorded for this order.");
  para(
    "Only targets, dates, locations and acceptance criteria stated in the scope above are agreed here. No additional service level or penalty is implied by this generated record.",
  );

  section("3. Handoffs, evidence and payment");
  para(
    "The order uses a supplier-to-driver pickup handoff and a driver-to-buyer delivery handoff. Each handoff requires the applicable verification recorded by the escrow workflow. The contract controls release of escrowed funds on the configured stages.",
  );
  field("Total escrow", money(record.totalWei));
  field("Driver at pickup", money(record.driverAtPickupWei));
  field("Supplier at pickup", money(record.supplierAtPickupWei));
  field("Supplier at delivery", money(record.supplierAtDeliveryWei));
  field("Refund deadline", record.refundDeadline);
  para(
    "Amounts and release rules should be checked against the deployed contract and the order's on-chain events. A dispute, refund or failed verification can affect release.",
  );

  section("4. Changes, exceptions and disputes");
  para(
    "Any change to scope, price or milestones should be recorded and approved by the relevant parties. The parties should document delays or non-performance promptly. Disputes may be raised through the order workflow; remedies and governing law depend on the parties' underlying agreement and applicable law.",
  );

  section("5. Blockchain reference");
  field("Escrow contract", record.contractAddress);
  field("Network", `${record.network} / chain ID ${record.chainId}`);
  if (record.contractUrl) {
    room(25);
    const linkY = y;
    draw("Open deployed escrow contract in block explorer", 9, "0.03 0.34 0.65", true);
    page.links.push({ url: record.contractUrl, rect: [LEFT, linkY - 3, 330, linkY + 12] });
    for (const line of wrap(record.contractUrl, 88)) draw(line, 8, MUTED);
  } else
    para(
      "Local demo network: no public contract explorer link is available. The contract address above is the local deployment reference.",
    );
  field("Agreement hash on chain", record.agreementHash);
  field(
    "Supplier acceptance",
    record.supplierAccepted ? "Observed on chain" : "Not observed on chain at generation time",
  );

  section("6. Buyer wallet approval");
  para(
    "The buyer approved the exact SLA record hash below with an EIP-191 wallet message. This proves control of the stated wallet at signing time; it does not independently establish the human signer's identity, authority, or an advanced electronic signature.",
  );
  field("Buyer wallet", record.buyerWallet);
  field("Browser-reported signing time", record.signedAt);
  field("SLA record hash", keccak256(toBytes(JSON.stringify(record))));
  field("Signature method", "EIP-191 personal message");
  for (const line of wrap(signature, 85)) draw(line, 8, MUTED);
  y -= 3;
  draw("SIGNED MESSAGE", 9, BLUE, true);
  for (const line of slaApprovalMessage(record).split("\n"))
    for (const part of wrap(line, 88)) draw(part, 8, MUTED);
  para(
    "The supplier is not signed by this buyer approval. This PDF is a generated record, not a certificate from an accredited authentication service provider.",
  );
  para(
    "The complete signed SLA record is attached as sla-record.json for independent verification, including any characters that this PDF font cannot display.",
  );

  pages.forEach((p, i) => {
    p.lines.push(`0.78 0.84 0.89 RG ${LEFT} 48 m ${RIGHT} 48 l S`);
    p.lines.push(
      `BT /F1 8 Tf ${MUTED} rg ${LEFT} 32 Td (Patela  |  Order ${pdfText(record.orderId)}) Tj ET`,
    );
    p.lines.push(`BT /F1 8 Tf ${MUTED} rg 505 32 Td (${i + 1} / ${pages.length}) Tj ET`);
  });

  const objects: string[] = [
    "",
    "",
    "",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
  ];
  const pageRefs: number[] = [];
  for (const p of pages) {
    const content = p.lines.join("\n") + "\n";
    const contentRef = objects.push(`<< /Length ${content.length} >>\nstream\n${content}endstream`);
    const annots = p.links.map(({ url, rect }) =>
      objects.push(
        `<< /Type /Annot /Subtype /Link /Rect [${rect.join(" ")}] /Border [0 0 0] /A << /S /URI /URI (${pdfText(url)}) >> >>`,
      ),
    );
    const pageRef = objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents ${contentRef} 0 R /Annots [${annots.map((n) => `${n} 0 R`).join(" ")}] >>`,
    );
    pageRefs.push(pageRef);
  }
  const evidence = JSON.stringify(
    { record, approvalMessage: slaApprovalMessage(record), signature },
    null,
    2,
  );
  const evidenceRef = objects.push(
    `<< /Type /EmbeddedFile /Subtype /application#2Fjson /Length ${new TextEncoder().encode(`${evidence}\n`).length} >>\nstream\n${evidence}\nendstream`,
  );
  const fileRef = objects.push(
    `<< /Type /Filespec /F (sla-record.json) /UF (sla-record.json) /EF << /F ${evidenceRef} 0 R >> >>`,
  );
  objects[0] = `<< /Type /Catalog /Pages 2 0 R /Names << /EmbeddedFiles << /Names [(sla-record.json) ${fileRef} 0 R] >> >> /AF [${fileRef} 0 R] >>`;
  objects[1] = `<< /Type /Pages /Kids [${pageRefs.map((n) => `${n} 0 R`).join(" ")}] /Count ${pageRefs.length} >>`;
  objects[2] = `<< /Producer (Patela) /Title (Service Level Agreement ${pdfText(record.orderId)}) /Subject (Buyer wallet signed SLA record) >>`;
  // Object 3 is Info; font objects start at 4 and 5.
  const bytes = new TextEncoder();
  let pdf = "%PDF-1.4\n%Patela\n";
  const offsets = [0];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(bytes.encode(pdf).length);
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref = bytes.encode(pdf).length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return bytes.encode(pdf);
}
