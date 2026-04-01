import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { format } from "date-fns";
import eagleLogo from "@/assets/eagle-logo-receipt.png";

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
    verification: "Verification",
  };
  return map[type] || type;
};

const statusColor = (status: string): [number, number, number] => {
  switch (status) {
    case "completed": return [34, 197, 94];
    case "failed": return [239, 68, 68];
    case "pending": return [234, 179, 8];
    case "refunded": return [168, 85, 247];
    default: return [100, 100, 100];
  }
};

export const generateReceiptPDF = async (transaction: Transaction) => {
  const pdf = new jsPDF({ unit: "mm", format: [80, 160] });
  const w = 80;
  let y = 8;

  // Header background
  pdf.setFillColor(30, 30, 30);
  pdf.rect(0, 0, w, 32, "F");

  // Watermark
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(28);
  pdf.setFont("helvetica", "bold");
  pdf.saveGraphicsState();
  // @ts-ignore
  pdf.setGState(new pdf.GState({ opacity: 0.06 }));
  pdf.text("EAGLE", w / 2, 50, { align: "center", angle: -20 });
  pdf.text("RECHARGE", w / 2, 62, { align: "center", angle: -20 });
  pdf.restoreGraphicsState();

  // Logo
  try {
    const logoDataURL = await loadImageAsDataURL(eagleLogo);
    pdf.addImage(logoDataURL, "PNG", (w - 12) / 2, y, 12, 12);
  } catch {
    // fallback: no logo
  }

  // Brand text below logo
  pdf.setTextColor(255, 200, 50);
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "bold");
  pdf.text("Eagle Recharge", w / 2, y + 16, { align: "center" });
  pdf.setFontSize(7);
  pdf.setTextColor(180, 180, 180);
  pdf.text("Transaction Receipt", w / 2, y + 20, { align: "center" });

  // Dashed line
  y = 36;
  pdf.setDrawColor(200, 200, 200);
  pdf.setLineDashPattern([1, 1], 0);
  pdf.line(6, y, w - 6, y);
  y += 4;

  // Amount
  pdf.setTextColor(30, 30, 30);
  pdf.setFontSize(18);
  pdf.setFont("helvetica", "bold");
  pdf.text(`₦${transaction.amount.toLocaleString()}`, w / 2, y + 6, { align: "center" });
  y += 10;

  // Status badge
  const [sr, sg, sb] = statusColor(transaction.status);
  const statusText = transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1);
  const stw = pdf.getTextWidth(statusText) + 6;
  pdf.setFillColor(sr, sg, sb);
  pdf.roundedRect((w - stw) / 2 - 2, y, stw + 4, 6, 2, 2, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(7);
  pdf.setFont("helvetica", "bold");
  pdf.text(statusText, w / 2, y + 4.2, { align: "center" });
  y += 12;

  // Detail rows
  pdf.setLineDashPattern([1, 1], 0);
  const addRow = (label: string, value: string) => {
    if (y > 145) return;
    pdf.setTextColor(120, 120, 120);
    pdf.setFontSize(6.5);
    pdf.setFont("helvetica", "normal");
    pdf.text(label, 6, y);
    pdf.setTextColor(30, 30, 30);
    pdf.setFont("helvetica", "bold");
    const maxW = w - 12 - pdf.getTextWidth(label) - 4;
    const trimmed = value.length > 30 ? value.slice(0, 28) + "..." : value;
    pdf.text(trimmed, w - 6, y, { align: "right" });
    y += 5.5;
    pdf.setDrawColor(230, 230, 230);
    pdf.line(6, y - 2, w - 6, y - 2);
  };

  addRow("Type", formatType(transaction.transaction_type));
  addRow("Date", format(new Date(transaction.created_at), "PPp"));
  if (transaction.description) addRow("Description", transaction.description);
  if (transaction.phone_number) addRow("Phone", transaction.phone_number);
  if (transaction.network) addRow("Network", transaction.network.toUpperCase());
  if (transaction.data_plan) addRow("Plan", transaction.data_plan);
  if (transaction.meter_number) addRow("Meter No.", transaction.meter_number);
  if (transaction.electricity_provider) addRow("Provider", transaction.electricity_provider.toUpperCase());
  if (transaction.cable_smartcard) addRow("Smartcard", transaction.cable_smartcard);
  if (transaction.cable_provider) addRow("Cable Provider", transaction.cable_provider.toUpperCase());
  if (transaction.cable_plan) addRow("Cable Plan", transaction.cable_plan);
  if (transaction.token) addRow("Token", transaction.token);
  if (transaction.balance_before != null) addRow("Bal. Before", `₦${transaction.balance_before.toLocaleString()}`);
  if (transaction.balance_after != null) addRow("Bal. After", `₦${transaction.balance_after.toLocaleString()}`);
  if (transaction.paystack_reference) addRow("Payment Ref", transaction.paystack_reference);
  addRow("Reference", transaction.id.slice(0, 16));

  // Footer
  y += 4;
  pdf.setDrawColor(200, 200, 200);
  pdf.setLineDashPattern([1, 1], 0);
  pdf.line(6, y, w - 6, y);
  y += 5;
  pdf.setTextColor(150, 150, 150);
  pdf.setFontSize(6);
  pdf.setFont("helvetica", "normal");
  pdf.text("Thank you for using Eagle Recharge!", w / 2, y, { align: "center" });

  pdf.save(`receipt-${transaction.id.slice(0, 8)}.pdf`);
};

export const captureReceiptAsImage = async (elementId: string): Promise<Blob> => {
  const el = document.getElementById(elementId);
  if (!el) throw new Error("Receipt element not found");

  const canvas = await html2canvas(el, {
    backgroundColor: "#ffffff",
    scale: 2,
    useCORS: true,
    logging: false,
  });

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Failed to create image"))),
      "image/png",
      1.0
    );
  });
};

export const shareReceiptAsImage = async (elementId: string, transactionId: string) => {
  const blob = await captureReceiptAsImage(elementId);
  const file = new File([blob], `receipt-${transactionId.slice(0, 8)}.png`, { type: "image/png" });

  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({
      title: "Eagle Recharge Receipt",
      files: [file],
    });
  } else {
    // Fallback: download the image
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
