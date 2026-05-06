
import React, { useRef } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, BarChart3 } from "lucide-react"; // Added BarChart3 import
import PrintOptions from "./PrintOptions";
import PrintableDocument from "./PrintableDocument";
import { useToast } from "@/components/ui/use-toast";

export default function DocumentPrintPreview({
    document,
    documentType,
    onClose,
    companyInfo,
    language = "en"
}) {
    const printRef = useRef();
    const { toast } = useToast();

    const handlePrintPDF = async () => {
        window.print();
    };

    const handlePrintJPEG = async () => {
        // In a real implementation, you would use html2canvas or similar
        toast({
            title: "Info",
            description: "JPEG export will be implemented with html2canvas library"
        });
    };

    const handleEmail = async (emailData) => {
        try {
            await matrixSales.integrations.Core.SendEmail({
                to: emailData.to,
                subject: emailData.subject || `${documentType} - ${document.number}`,
                body: `${emailData.body}\n\nDocument: ${document.number}\nDate: ${document.date}\n\nThis is an automated email from MatrixERP ERP.` // Rebranded from PVC Pro ERP
            });
        } catch (error) {
            throw new Error("Failed to send email");
        }
    };

    const handleWhatsApp = async (whatsappData) => {
        const message = whatsappData.message ||
            `${documentType} ${document.number}\nDate: ${document.date}\n\nPlease find your document details above.`;
        const phone = whatsappData.phone.replace(/[^0-9]/g, '');
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
    };

    const renderHeader = () => (
        <div className="text-center mb-8 pb-6 border-b-2 border-emerald-600">
            <div className="flex items-center justify-center gap-4 mb-4">
                <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 p-3 rounded-lg">
                    <BarChart3 className="w-10 h-10 text-white" />
                </div>
                <div className="text-left">
                    <h1 className="text-3xl font-bold text-gray-900">MatrixERP</h1>
                    <p className="text-sm text-gray-600">Enterprise Resource Planning</p>
                </div>
            </div>
            <div className="text-sm text-gray-600 space-y-1">
                <p>P.O. Box 12345, Riyadh 11564, Kingdom of Saudi Arabia</p>
                <p>Tel: +966 11 234 5678 | Email: info@matrixerp.com</p>
                <p>VAT: 300000000000003 | CR: 1010123456</p>
            </div>
        </div>
    );

    // Map document data to printable format
    const getPrintableData = () => {
        const items = document.items || (document.product_name ? [{
            name: document.product_name,
            quantity: document.quantity || 1,
            unit_price: document.unit_price || 0
        }] : []);

        const totals = document.total_amount ? {
            subtotal: document.subtotal || document.total_amount,
            discount: document.discount_amount || 0,
            vat_amount: document.vat_amount || 0,
            vat_percent: document.vat_percent || 15,
            total: document.total_amount,
            currency: document.currency || "SAR",
            qr_code: document.zatca_qr_code
        } : null;

        const customerInfo = document.customer_name ? {
            name: document.customer_name,
            vat_number: document.customer_vat_number,
            address: document.customer_address || document.delivery_address
        } : null;

        return {
            title: documentType,
            documentNumber: document.number || document.order_number || document.quotation_number || document.invoice_number,
            documentDate: document.date || document.order_date || document.quotation_date || document.invoice_date,
            customerInfo,
            items,
            totals,
            footer: document.notes || "Thank you for your business!"
        };
    };

    const printableData = getPrintableData();

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <div className="flex items-center justify-between">
                        <DialogTitle>Print Preview - {documentType}</DialogTitle>
                        <div className="flex items-center gap-2">
                            <PrintOptions
                                documentType={documentType}
                                documentData={{ number: printableData.documentNumber }}
                                onPrintPDF={handlePrintPDF}
                                onPrintJPEG={handlePrintJPEG}
                                onEmail={handleEmail}
                                onWhatsApp={handleWhatsApp}
                            />
                            <Button variant="ghost" size="icon" onClick={onClose}>
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                </DialogHeader>

                <div ref={printRef} className="mt-4">
                    <PrintableDocument
                        {...printableData}
                        companyInfo={companyInfo || {
                            name: "MatrixERP", // Rebranded name
                            address: "P.O. Box 12345, Riyadh 11564, Kingdom of Saudi Arabia", // Rebranded address
                            cr_number: "1010123456", // Rebranded CR number
                            vat_number: "300000000000003" // Rebranded VAT number
                        }}
                        renderHeader={renderHeader} // Pass the custom header renderer
                        language={language}
                    />
                </div>
            </DialogContent>
        </Dialog>
    );
}
