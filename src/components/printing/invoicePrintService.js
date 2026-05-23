import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { matrixSales } from "@/api/matrixSalesClient";
import {
  buildBilingualEmailMessage,
  createSecureShareToken,
  mergePrintingPreferences
} from "./invoicePrintUtils";

export async function getTenantPrintingPreferences() {
  const rows = await matrixSales.entities.TenantPrintingPreferences.list("-created_at", 1);
  return rows[0] || null;
}

export async function saveTenantPrintingPreferences(existing, preferences) {
  const payload = mergePrintingPreferences(preferences);
  if (existing?.id) return matrixSales.entities.TenantPrintingPreferences.update(existing.id, payload);
  return matrixSales.entities.TenantPrintingPreferences.create(payload);
}

export async function getTenantLogoAsset() {
  const rows = await matrixSales.entities.TenantLogoAssets.list("-created_at", 1);
  return rows[0] || null;
}

export async function saveTenantLogoAsset(file) {
  if (!file) throw new Error("Logo file is required.");
  if (!["image/png", "image/jpeg", "image/webp", "image/svg+xml"].includes(file.type)) {
    throw new Error("Logo must be PNG, JPEG, WEBP, or SVG.");
  }
  if (file.size > 1024 * 1024) {
    throw new Error("Logo must be 1 MB or smaller.");
  }
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  return matrixSales.entities.TenantLogoAssets.create({
    file_name: file.name,
    content_type: file.type,
    size_bytes: file.size,
    data_url: dataUrl
  });
}

export async function generateInvoicePdfFromElement(element, invoice, preferences = {}) {
  if (!element) throw new Error("Print preview is not ready.");
  const canvas = await html2canvas(element, {
    scale: 2,
    backgroundColor: "#ffffff",
    useCORS: true
  });
  const isLandscape = preferences.orientation === "landscape";
  const pdf = new jsPDF({
    orientation: isLandscape ? "landscape" : "portrait",
    unit: "mm",
    format: preferences.paper_size === "thermal" ? [80, 220] : "a4"
  });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = preferences.paper_size === "thermal" ? 2 : 8;
  const imageWidth = pageWidth - margin * 2;
  const imageHeight = (canvas.height * imageWidth) / canvas.width;
  let remainingHeight = imageHeight;
  let y = margin;
  const image = canvas.toDataURL("image/png");

  pdf.addImage(image, "PNG", margin, y, imageWidth, imageHeight);
  remainingHeight -= pageHeight - margin * 2;
  while (remainingHeight > 0) {
    pdf.addPage();
    y = remainingHeight - imageHeight + margin;
    pdf.addImage(image, "PNG", margin, y, imageWidth, imageHeight);
    remainingHeight -= pageHeight - margin * 2;
  }

  const fileName = `invoice-${invoice.invoice_number || invoice.id || "draft"}.pdf`;
  const blob = pdf.output("blob");
  return { pdf, blob, fileName };
}

export async function downloadInvoicePdf(element, invoice, preferences) {
  const { pdf, fileName } = await generateInvoicePdfFromElement(element, invoice, preferences);
  pdf.save(fileName);
  await matrixSales.entities.GeneratedInvoicePdfs.create({
    invoice_id: invoice.id || null,
    invoice_number: invoice.invoice_number || null,
    file_name: fileName,
    generated_at: new Date().toISOString(),
    storage_status: "downloaded_locally"
  });
  return fileName;
}

export async function logInvoiceEmailShare(invoice, emailData = {}) {
  return matrixSales.entities.InvoiceShareLogs.create({
    invoice_id: invoice.id || null,
    invoice_number: invoice.invoice_number || null,
    channel: "email",
    recipient: emailData.to,
    subject: emailData.subject || `Invoice ${invoice.invoice_number}`,
    message: emailData.body || buildBilingualEmailMessage(invoice),
    shared_at: new Date().toISOString()
  });
}

export async function createWhatsAppShare(invoice, message = "") {
  const token = createSecureShareToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  return matrixSales.entities.InvoiceShareLinks.create({
    invoice_id: invoice.id || null,
    invoice_number: invoice.invoice_number || null,
    channel: "whatsapp",
    token,
    expires_at: expiresAt,
    message,
    access: "tokenized",
    created_at: new Date().toISOString()
  });
}
