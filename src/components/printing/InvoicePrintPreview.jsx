import React, { useRef } from "react";
import { Download, Mail, MessageCircle, Printer, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import ZatcaInvoiceTemplate from "./ZatcaInvoiceTemplate";
import {
  buildBilingualEmailMessage,
  mergePrintingPreferences,
  validateZatcaPrintPreferences
} from "./invoicePrintUtils";
import {
  createWhatsAppShare,
  downloadInvoicePdf,
  logInvoiceEmailShare
} from "./invoicePrintService";

export default function InvoicePrintPreview({
  invoice,
  organization,
  preferences,
  logoAsset,
  onClose
}) {
  const printRef = useRef(null);
  const { toast } = useToast();
  const mergedPreferences = mergePrintingPreferences(preferences);
  const validation = validateZatcaPrintPreferences(mergedPreferences, invoice);

  const handlePrint = () => window.print();

  const handleDownload = async () => {
    try {
      await downloadInvoicePdf(printRef.current, invoice, mergedPreferences);
      toast({ title: "PDF downloaded", description: "Invoice PDF generated from the preview." });
    } catch (error) {
      toast({ title: "PDF failed", description: error.message, variant: "destructive" });
    }
  };

  const handleEmail = async () => {
    const to = window.prompt("Recipient email", invoice.customer_email || "");
    if (!to) return;
    const subject = window.prompt("Email subject", `Invoice ${invoice.invoice_number}`) || `Invoice ${invoice.invoice_number}`;
    const body = window.prompt("Message", buildBilingualEmailMessage(invoice)) || buildBilingualEmailMessage(invoice);
    await logInvoiceEmailShare(invoice, { to, subject, body });
    window.location.href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const handleWhatsApp = async () => {
    const phone = window.prompt("WhatsApp number with country code", "");
    if (!phone) return;
    const message = buildBilingualEmailMessage(invoice);
    const shareLink = await createWhatsAppShare(invoice, message);
    const text = `${message}\n\nSecure invoice reference: ${shareLink.token}\nExpires: ${shareLink.expires_at}`;
    window.open(`https://wa.me/${phone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <DialogTitle>Invoice Print Preview</DialogTitle>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={handlePrint}><Printer className="mr-2 h-4 w-4" />Print</Button>
              <Button variant="outline" onClick={handleDownload}><Download className="mr-2 h-4 w-4" />Download PDF</Button>
              <Button variant="outline" onClick={handleEmail}><Mail className="mr-2 h-4 w-4" />Share by Email</Button>
              <Button variant="outline" onClick={handleWhatsApp}><MessageCircle className="mr-2 h-4 w-4" />Share by WhatsApp</Button>
              <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
            </div>
          </div>
        </DialogHeader>

        {!validation.valid && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Required ZATCA fields are hidden in preferences. They will need to be re-enabled before legal issuance.
          </div>
        )}

        <div ref={printRef} className="bg-slate-100 p-4">
          <ZatcaInvoiceTemplate
            invoice={invoice}
            organization={organization}
            preferences={mergedPreferences}
            logoAsset={logoAsset}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

