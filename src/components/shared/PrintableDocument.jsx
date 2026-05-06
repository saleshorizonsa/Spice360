import React from "react";
import { BarChart3 } from "lucide-react";

export default function PrintableDocument({
    title,
    documentNumber,
    documentDate,
    companyInfo, // This prop will no longer be used in the header directly but is kept for compatibility.
    customerInfo,
    items = [],
    totals,
    footer,
    children,
    language = "en"
}) {
    const isRTL = language === "ar";

    const renderHeader = () => (
        <div className="text-center mb-6 pb-4 border-b-2 border-emerald-600">
            <div className="flex items-center justify-center gap-3 mb-3">
                <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 p-2 rounded-lg">
                    <BarChart3 className="w-8 h-8 text-white" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">MatrixERP</h1>
                    <p className="text-xs text-gray-600">Enterprise Resource Planning</p>
                </div>
            </div>
            <div className="text-xs text-gray-600 space-y-1">
                <p>P.O. Box 12345, Riyadh 11564, Kingdom of Saudi Arabia</p>
                <p>Tel: +966 11 234 5678 | Email: info@matrixerp.com</p>
                <p>VAT: 300000000000003 | CR: 1010123456</p>
            </div>
        </div>
    );

    return (
        <div className={`print-document bg-white p-8 ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? "rtl" : "ltr"}>
            <style>{`
                @media print {
                    .print-document {
                        margin: 0;
                        padding: 20mm;
                    }
                    @page {
                        size: A4;
                        margin: 10mm;
                    }
                }
            `}</style>

            {/* Header */}
            {renderHeader()}

            <div className="border-b-2 border-gray-300 pb-4 mb-6">
                <div className="flex justify-between items-start">
                    {/* The companyInfo section is replaced by renderHeader() content */}
                    {/* This div is now left empty to move the title and date to the right */}
                    <div>
                        {/* Keeping this empty div to maintain flex layout for the right side */}
                    </div>
                    <div className="text-right">
                        <h2 className="text-2xl font-semibold text-emerald-600">
                            {title}
                        </h2>
                        <p className="text-lg font-medium text-gray-700 mt-2">
                            {documentNumber}
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                            {isRTL ? 'التاريخ' : 'Date'}: {documentDate}
                        </p>
                    </div>
                </div>
            </div>

            {/* Customer Info */}
            {customerInfo && (
                <div className="mb-6 bg-gray-50 p-4 rounded-lg">
                    <h3 className="font-semibold text-gray-900 mb-2">
                        {isRTL ? 'بيانات العميل' : 'Customer Information'}
                    </h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <p className="text-gray-600">{isRTL ? 'الاسم' : 'Name'}:</p>
                            <p className="font-medium">{customerInfo.name}</p>
                        </div>
                        {customerInfo.vat_number && (
                            <div>
                                <p className="text-gray-600">{isRTL ? 'الرقم الضريبي' : 'VAT Number'}:</p>
                                <p className="font-medium">{customerInfo.vat_number}</p>
                            </div>
                        )}
                        {customerInfo.address && (
                            <div className="col-span-2">
                                <p className="text-gray-600">{isRTL ? 'العنوان' : 'Address'}:</p>
                                <p className="font-medium">{customerInfo.address}</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Items Table */}
            {items.length > 0 && (
                <div className="mb-6">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-gray-100 border-b-2 border-gray-300">
                                <th className="p-3 text-left text-sm font-semibold">#</th>
                                <th className="p-3 text-left text-sm font-semibold">
                                    {isRTL ? 'الصنف' : 'Item'}
                                </th>
                                <th className="p-3 text-right text-sm font-semibold">
                                    {isRTL ? 'الكمية' : 'Qty'}
                                </th>
                                <th className="p-3 text-right text-sm font-semibold">
                                    {isRTL ? 'السعر' : 'Unit Price'}
                                </th>
                                <th className="p-3 text-right text-sm font-semibold">
                                    {isRTL ? 'المجموع' : 'Total'}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item, idx) => (
                                <tr key={idx} className="border-b border-gray-200">
                                    <td className="p-3 text-sm">{idx + 1}</td>
                                    <td className="p-3 text-sm">{item.name}</td>
                                    <td className="p-3 text-sm text-right">{item.quantity}</td>
                                    <td className="p-3 text-sm text-right">
                                        {item.unit_price?.toLocaleString()}
                                    </td>
                                    <td className="p-3 text-sm text-right font-medium">
                                        {(item.quantity * item.unit_price)?.toLocaleString()}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Custom Content */}
            {children}

            {/* Totals */}
            {totals && (
                <div className="mt-6 flex justify-end">
                    <div className="w-64 space-y-2">
                        {totals.subtotal && (
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-600">
                                    {isRTL ? 'المجموع الفرعي' : 'Subtotal'}:
                                </span>
                                <span className="font-medium">
                                    {totals.currency} {totals.subtotal.toLocaleString()}
                                </span>
                            </div>
                        )}
                        {totals.discount > 0 && (
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-600">
                                    {isRTL ? 'الخصم' : 'Discount'}:
                                </span>
                                <span className="text-red-600">
                                    - {totals.currency} {totals.discount.toLocaleString()}
                                </span>
                            </div>
                        )}
                        {totals.vat_amount && (
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-600">
                                    {isRTL ? 'ضريبة القيمة المضافة' : 'VAT'} ({totals.vat_percent}%):
                                </span>
                                <span className="font-medium">
                                    {totals.currency} {totals.vat_amount.toLocaleString()}
                                </span>
                            </div>
                        )}
                        <div className="flex justify-between text-lg font-bold border-t-2 border-gray-300 pt-2">
                            <span>{isRTL ? 'الإجمالي' : 'Total'}:</span>
                            <span className="text-emerald-600">
                                {totals.currency} {totals.total.toLocaleString()}
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* Footer */}
            {footer && (
                <div className="mt-8 pt-6 border-t border-gray-300 text-sm text-gray-600">
                    {footer}
                </div>
            )}

            {/* Signature Section */}
            <div className="mt-12 grid grid-cols-2 gap-8">
                <div>
                    <div className="border-t border-gray-400 pt-2 text-center">
                        <p className="text-sm text-gray-600">
                            {isRTL ? 'توقيع المصدر' : 'Authorized Signature'}
                        </p>
                    </div>
                </div>
                <div>
                    <div className="border-t border-gray-400 pt-2 text-center">
                        <p className="text-sm text-gray-600">
                            {isRTL ? 'توقيع المستلم' : 'Received By'}
                        </p>
                    </div>
                </div>
            </div>

            {/* QR Code Placeholder (for ZATCA invoices) */}
            {totals?.qr_code && (
                <div className="mt-6 flex justify-center">
                    <div className="border-2 border-gray-300 p-4 text-center">
                        <p className="text-xs text-gray-600 mb-2">ZATCA QR Code</p>
                        <div className="w-32 h-32 bg-gray-100 flex items-center justify-center">
                            {/* QR code would be rendered here */}
                            <p className="text-xs text-gray-400">QR Code</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}