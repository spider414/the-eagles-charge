import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { format } from "date-fns";

const BRAND_LOGO = "/brand-logo.png";
const BRAND_NAME = "HARMIC RECHARGE";
const BRAND_SUPPORT = "harmicrecharge@harmicglobal.com";

export interface ReceiptDoc {
  title?: string;
  reference: string;
  transactionId: string;
  amount: number;
  moneyIn?: boolean;
  status: string;
  date: string | Date;
  rows: Array<[string, string]>;
  pins?: string[];
}

const loadImageAsDataURL = (src: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.getContext("2d")!.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = src;
  });

const statusColor = (status: string): [number, number, number] => {
  switch (status) {
    case "completed": return [34, 197, 94];
    case "failed": return [239, 68, 68];
    case "pending": return [234, 179, 8];
    case "processing": return [59, 130, 246];
    case "refunded": return [168, 85, 247];
    default: return [100, 100, 100];
  }
};

const money = (n: number) => `NGN ${n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Build a branded A5-ish receipt PDF. Returns the jsPDF instance. */
export const buildReceiptPdf = async (doc: ReceiptDoc): Promise<jsPDF> => {
  const w = 105; // mm width (A6 width)
  const rowCount = doc.rows.length + (doc.pins?.length ?? 0) * 1.6;
  const h = Math.max(148, 104 + rowCount * 7);
  const pdf = new jsPDF({ unit: "mm", format: [w, h] });

  // ---- Header band
  pdf.setFillColor(15, 15, 17);
  pdf.rect(0, 0, w, 34, "F");
  pdf.setFillColor(212, 175, 55);
  pdf.rect(0, 34, w, 1, "F");

  try {
    const logo = await loadImageAsDataURL(BRAND_LOGO);
    pdf.addImage(logo, "PNG", 8, 6, 18, 18);
  } catch {
    /* logo optional */
  }

  pdf.setTextColor(212, 175, 55);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.text(BRAND_NAME, 30, 13);
  pdf.setTextColor(200, 200, 200);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.5);
  pdf.text(doc.title || "Transaction Receipt", 30, 18);
  pdf.setFontSize(6.5);
  pdf.setTextColor(150, 150, 150);
  pdf.text("RECHARGE. PAY. CONNECT.", 30, 22.5);
  pdf.text(BRAND_SUPPORT, 30, 26.5);

  // ---- Watermark
  pdf.saveGraphicsState();
  // @ts-ignore - GState typing
  pdf.setGState(new pdf.GState({ opacity: 0.06 }));
  pdf.setTextColor(0, 0, 0);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(30);
  pdf.text("HARMIC", w / 2, h / 2, { align: "center", angle: 22 });
  pdf.text("RECHARGE", w / 2, h / 2 + 14, { align: "center", angle: 22 });
  pdf.restoreGraphicsState();

  // ---- Amount block
  let y = 45;
  pdf.setTextColor(120, 120, 120);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);
  pdf.text("AMOUNT", w / 2, y, { align: "center" });
  y += 8;
  pdf.setTextColor(20, 20, 20);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(19);
  pdf.text(`${doc.moneyIn ? "+" : "-"}${money(doc.amount)}`, w / 2, y, { align: "center" });
  y += 6;

  // Status pill
  const [sr, sg, sb] = statusColor(doc.status);
  const statusText = doc.status.charAt(0).toUpperCase() + doc.status.slice(1);
  pdf.setFontSize(7.5);
  const stw = pdf.getTextWidth(statusText) + 10;
  pdf.setFillColor(sr, sg, sb);
  pdf.roundedRect((w - stw) / 2, y, stw, 6.5, 3.2, 3.2, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.text(statusText, w / 2, y + 4.5, { align: "center" });
  y += 13;

  // Divider
  pdf.setDrawColor(210, 210, 210);
  pdf.setLineDashPattern([1, 1], 0);
  pdf.line(8, y, w - 8, y);
  pdf.setLineDashPattern([], 0);
  y += 6;

  // ---- Rows
  const addRow = (label: string, value: string) => {
    pdf.setTextColor(125, 125, 125);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.text(label, 8, y);

    pdf.setTextColor(25, 25, 25);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.5);
    const maxW = w - 16 - pdf.getTextWidth(label) - 4;
    const lines = pdf.splitTextToSize(value, Math.max(maxW, 30)) as string[];
    lines.forEach((line, i) => pdf.text(line, w - 8, y + i * 3.6, { align: "right" }));
    y += Math.max(1, lines.length) * 3.6 + 3;
    pdf.setDrawColor(235, 235, 235);
    pdf.line(8, y - 2.4, w - 8, y - 2.4);
  };

  doc.rows.forEach(([l, v]) => v && addRow(l, v));

  // ---- Pins
  if (doc.pins?.length) {
    y += 3;
    pdf.setTextColor(234, 88, 12);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.text("EXAM PIN(S)", 8, y);
    y += 4;
    doc.pins.forEach((pin) => {
      const lines = pdf.splitTextToSize(pin, w - 20) as string[];
      const boxH = lines.length * 3.8 + 4;
      pdf.setFillColor(252, 245, 235);
      pdf.setDrawColor(240, 200, 150);
      pdf.roundedRect(8, y, w - 16, boxH, 1.5, 1.5, "FD");
      pdf.setTextColor(40, 40, 40);
      pdf.setFont("courier", "bold");
      pdf.setFontSize(7.5);
      lines.forEach((line, i) => pdf.text(line, 11, y + 5 + i * 3.8));
      y += boxH + 2.5;
    });
    pdf.setFont("helvetica", "normal");
  }

  // ---- Footer
  y += 4;
  pdf.setDrawColor(210, 210, 210);
  pdf.setLineDashPattern([1, 1], 0);
  pdf.line(8, y, w - 8, y);
  pdf.setLineDashPattern([], 0);
  y += 5;
  pdf.setTextColor(140, 140, 140);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(6.2);
  pdf.text(`Thank you for using ${BRAND_NAME}!`, w / 2, y, { align: "center" });
  pdf.text(`Generated ${format(new Date(), "PPp")}`, w / 2, y + 3.5, { align: "center" });
  pdf.text("This is a computer generated receipt.", w / 2, y + 7, { align: "center" });

  return pdf;
};

export const downloadReceiptPdf = async (doc: ReceiptDoc) => {
  const pdf = await buildReceiptPdf(doc);
  pdf.save(`harmic-receipt-${doc.transactionId.slice(0, 8)}.pdf`);
};

/** Share the receipt PDF via the native share sheet, falling back to download. */
export const shareReceiptPdf = async (doc: ReceiptDoc, text?: string) => {
  const pdf = await buildReceiptPdf(doc);
  const blob = pdf.output("blob");
  const file = new File([blob], `harmic-receipt-${doc.transactionId.slice(0, 8)}.pdf`, {
    type: "application/pdf",
  });

  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ title: `${BRAND_NAME} Receipt`, text, files: [file] });
    return "shared" as const;
  }
  if (navigator.share && text) {
    await navigator.share({ title: `${BRAND_NAME} Receipt`, text });
    return "shared" as const;
  }
  pdf.save(file.name);
  return "downloaded" as const;
};

/** Pretty plain-text receipt used for clipboard / text share. */
export const buildReceiptText = (doc: ReceiptDoc) => {
  const line = "━".repeat(30);
  const parts = [
    `🦅 ${BRAND_NAME}`,
    doc.title || "Transaction Receipt",
    line,
    `Amount:      ${doc.moneyIn ? "+" : "-"}₦${doc.amount.toLocaleString()}`,
    `Status:      ${doc.status.charAt(0).toUpperCase() + doc.status.slice(1)}`,
    `Date:        ${format(new Date(doc.date), "PPpp")}`,
    line,
    ...doc.rows.filter(([, v]) => v).map(([l, v]) => `${(l + ":").padEnd(13)}${v}`),
  ];
  if (doc.pins?.length) {
    parts.push(line, "EXAM PIN(S)", ...doc.pins.map((p) => `• ${p}`));
  }
  parts.push(line, `Support: ${BRAND_SUPPORT}`, `Thank you for using ${BRAND_NAME}!`);
  return parts.join("\n");
};

/* ---------------- Legacy helpers (transaction dialog) ---------------- */

interface Transaction {
  id: string;
  transaction_type: string;
  amount: number;
  status: string;
  created_at: string;
  phone_number?: string;
  network?: string;
  data_plan?: string;
  description?: string;
  meter_number?: string;
  cable_smartcard?: string;
  cable_provider?: string;
  cable_plan?: string;
  electricity_provider?: string;
  token?: string;
  balance_before?: number | null;
  balance_after?: number | null;
  paystack_reference?: string;
}

const formatType = (type: string) => {
  const map: Record<string, string> = {
    airtime: "Airtime",
    data: "Data Bundle",
    electricity: "Electricity",
    cable_tv: "Cable TV",
    internet: "Internet",
    wallet_topup: "Wallet Top-up",
    exam_pin: "Exam PIN",
    verification: "Verification",
  };
  return map[type] || type;
};

export const transactionToReceiptDoc = (t: Transaction): ReceiptDoc => ({
  title: `${formatType(t.transaction_type)} Receipt`,
  reference: t.id,
  transactionId: t.id,
  amount: t.amount,
  moneyIn: t.transaction_type === "wallet_topup",
  status: t.status,
  date: t.created_at,
  rows: [
    ["Type", formatType(t.transaction_type)],
    ["Date", format(new Date(t.created_at), "PPp")],
    ["Description", t.description || ""],
    ["Phone", t.phone_number || ""],
    ["Network", t.network?.toUpperCase() || ""],
    ["Plan", t.data_plan || ""],
    ["Meter No.", t.meter_number || ""],
    ["Provider", t.electricity_provider?.toUpperCase() || ""],
    ["Smartcard", t.cable_smartcard || ""],
    ["Cable Provider", t.cable_provider?.toUpperCase() || ""],
    ["Cable Plan", t.cable_plan || ""],
    ["Token", t.token || ""],
    ["Bal. Before", t.balance_before != null ? money(t.balance_before) : ""],
    ["Bal. After", t.balance_after != null ? money(t.balance_after) : ""],
    ["Payment Ref", t.paystack_reference || ""],
    ["Reference", t.id],
  ].filter(([, v]) => v) as Array<[string, string]>,
});

export const generateReceiptPDF = async (transaction: Transaction) =>
  downloadReceiptPdf(transactionToReceiptDoc(transaction));

export const captureReceiptAsImage = async (elementId: string): Promise<Blob> => {
  const el = document.getElementById(elementId);
  if (!el) throw new Error("Receipt element not found");
  const canvas = await html2canvas(el, { backgroundColor: "#ffffff", scale: 2, useCORS: true, logging: false });
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Failed to create image"))), "image/png", 1.0);
  });
};

export const shareReceiptAsImage = async (elementId: string, transactionId: string) => {
  const blob = await captureReceiptAsImage(elementId);
  const file = new File([blob], `receipt-${transactionId.slice(0, 8)}.png`, { type: "image/png" });
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ title: `${BRAND_NAME} Receipt`, files: [file] });
  } else {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
};
