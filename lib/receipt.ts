import { fmt, dTime, lkr } from "./format";
import { stLabel, txTitle, txVia, type DB, type Tx } from "./backend";

/* A transaction's receipt as a PDF, built in the browser. jsPDF loads only when a receipt is made. */

type Row = [label: string, value: string, strong?: boolean];

/** The receipt's sections, mirroring the transaction detail screen. */
function sections(db: DB, t: Tx): Row[][] {
  const fx = t.kind === "sell" || t.kind === "remit";
  const details: Row[] = [["Payment", txVia(db, t)]]; // status is the pill under the amount
  if (t.account) details.push([t.kind === "reload" ? "Mobile" : "Account", t.account]);
  if (t.payee) details.push([t.payee.self ? "Paid to" : "Recipient", t.payee.name], ["Bank", `${t.payee.bank} ${t.payee.account}`]);
  if (t.purpose && t.kind === "remit") details.push(["Purpose", `${t.payee?.relationship ?? ""} · ${t.purpose}`]);

  const amounts: Row[] = [];
  if (fx) {
    amounts.push([t.kind === "sell" ? "Sold" : "Sent", `${fmt(t.usdt)} USDT`]);
    if (t.fees_usdt !== undefined) amounts.push(["Fees", `${fmt(t.fees_usdt)} USDT`]);
    if (t.rate) amounts.push(["Rate", `1 USDT = LKR ${fmt(t.rate)}`]);
    const done = t.state === "completed";
    amounts.push([t.kind === "sell" ? (done ? "You received" : "You receive") : done ? "They received" : "They receive", lkr(t.lkr || t.quoted_lkr || 0), true]);
  } else {
    if (t.usdt) {
      amounts.push(["Paid in USDT", `${fmt(t.usdt)} USDT`], ["Conversion fee", `${fmt(t.fees_usdt)} USDT`]);
      if (t.rate) amounts.push(["Rate", `1 USDT = LKR ${fmt(t.rate)}`]);
    }
    amounts.push(["Subtotal", lkr(t.lkr)], ["Fee", lkr(t.fee_lkr || 0)], ["Total", lkr((t.lkr || 0) + (t.fee_lkr || 0)), true]);
  }

  const refs: Row[] = [];
  if (t.bank_ref) refs.push(["Bank ref", t.bank_ref]);
  if (t.transfer_ref) refs.push(["Transfer ref", t.transfer_ref]);
  if (t.biller_ref) refs.push(["Biller ref", t.biller_ref]);
  refs.push(["CeyPay ref", t.ref || t.id]);

  return [details, amounts, refs];
}

const C = { brand: "#1c6ef5", ink: "#0f172a", fg: "#334155", muted: "#64748b", line: "#e2e8f0", card: "#f8fafc", ok: "#15803d", okSoft: "#dcfce7" };

export async function receiptPdf(db: DB, t: Tx): Promise<File> {
  const { jsPDF } = await import("jspdf");
  const W = 420;
  const M = 28;
  const TOP = 208;
  const labelW = 110;
  const valueW = W - M * 2 - 24 - labelW;
  // Measure first: long values (refs) wrap, and the page is exactly as tall as its content.
  const measure = new jsPDF({ unit: "pt" }).setFont("helvetica", "normal").setFontSize(10);
  const groups = sections(db, t).map((rows) => {
    const lines = rows.map(([, v]) => measure.splitTextToSize(v, valueW) as string[]);
    const hs = lines.map((l) => 14 + l.length * 13);
    return { rows, lines, hs, h: hs.reduce((a, b) => a + b, 0) + 6 };
  });
  const H = TOP + groups.reduce((a, g) => a + g.h + 12, 0) + 40;
  const pdf = new jsPDF({ unit: "pt", format: [W, H] });
  const title = txTitle(db, t);
  const amount = `${t.kind === "sell" ? "+" : ""}${lkr(t.lkr || t.quoted_lkr)}`;

  // Brand band
  pdf.setFillColor(C.brand).rect(0, 0, W, 64, "F");
  pdf.setFont("helvetica", "bold").setFontSize(20).setTextColor("#ffffff").text("CeyPay", M, 40);
  pdf.setFont("helvetica", "normal").setFontSize(11).text("Receipt", W - M, 40, { align: "right" });

  // Headline: what, when, how much, and its status
  let y = 100;
  pdf.setFont("helvetica", "normal").setFontSize(11).setTextColor(C.muted).text(title, W / 2, y, { align: "center" });
  y += 34;
  pdf.setFont("helvetica", "bold").setFontSize(26).setTextColor(t.state === "completed" && t.kind === "sell" ? C.ok : C.ink).text(amount, W / 2, y, { align: "center" });
  y += 20;
  pdf.setFont("helvetica", "normal").setFontSize(10).setTextColor(C.muted).text(dTime(t.created), W / 2, y, { align: "center" });
  y += 18;
  const status = stLabel(t.state);
  const sw = pdf.setFontSize(9).getTextWidth(status) + 18;
  const done = t.state === "completed";
  pdf.setFillColor(done ? C.okSoft : C.line).roundedRect(W / 2 - sw / 2, y, sw, 18, 9, 9, "F");
  pdf.setTextColor(done ? C.ok : C.fg).text(status, W / 2, y + 12.5, { align: "center" });
  y = TOP;

  // Sections as cards of label/value rows
  for (const { rows, lines, hs, h: ch } of groups) {
    pdf.setFillColor(C.card).setDrawColor(C.line).roundedRect(M, y, W - M * 2, ch, 10, 10, "FD");
    let ry = y + 3;
    rows.forEach(([label, , strong], i) => {
      if (i) pdf.setDrawColor(C.line).line(M + 12, ry, W - M - 12, ry);
      const base = ry + 18;
      pdf.setFont("helvetica", "normal").setFontSize(10).setTextColor(C.muted).text(label, M + 12, base);
      pdf.setFont("helvetica", strong ? "bold" : "normal").setTextColor(strong ? C.ink : C.fg).text(lines[i], W - M - 12, base, { align: "right" });
      ry += hs[i];
    });
    y += ch + 12;
  }

  pdf.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(C.muted);
  pdf.text(`Generated ${dTime(Date.now())} · ceypay.io`, W / 2, H - 24, { align: "center" });

  return new File([pdf.output("blob")], `CeyPay-receipt-${t.ref || t.id}.pdf`, { type: "application/pdf" });
}

/** Builds the receipt and saves it to the device. */
export async function downloadReceipt(db: DB, t: Tx) {
  const file = await receiptPdf(db, t);
  const url = URL.createObjectURL(file);
  Object.assign(document.createElement("a"), { href: url, download: file.name }).click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
