import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Printer, Download, QrCode } from "lucide-react";
import { generateAssetTagLabel } from "../utils/assetTagGenerator";

export default function AssetTagPrint({ assets, onClose }) {
    const [printOptions, setPrintOptions] = useState({
        includeQR: true,
        labelSize: '4x2',
        copies: 1
    });

    const assetsArray = Array.isArray(assets) ? assets : [assets];

    const handlePrint = () => {
        const printWindow = window.open('', '_blank');
        
        const labels = assetsArray.map(asset => 
            generateAssetTagLabel(asset, printOptions.includeQR)
        ).join('\n');

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Asset Tags - Print</title>
                <style>
                    @page {
                        size: ${printOptions.labelSize === '4x2' ? '4in 2in' : '3in 2in'};
                        margin: 0;
                    }
                    body {
                        margin: 0;
                        padding: 0;
                    }
                    @media print {
                        body {
                            -webkit-print-color-adjust: exact;
                            print-color-adjust: exact;
                        }
                    }
                </style>
            </head>
            <body>
                ${Array(printOptions.copies).fill(labels).join('\n')}
            </body>
            </html>
        `;

        printWindow.document.write(html);
        printWindow.document.close();
        
        // Auto-print after a short delay
        setTimeout(() => {
            printWindow.print();
        }, 500);
    };

    const handleDownloadPDF = () => {
        // Generate labels HTML
        const labels = assetsArray.map(asset => 
            generateAssetTagLabel(asset, printOptions.includeQR)
        ).join('\n');

        // Create a blob and download
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Asset Tags</title>
                <style>
                    body { margin: 20px; }
                </style>
            </head>
            <body>
                ${labels}
            </body>
            </html>
        `;

        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `asset-tags-${Date.now()}.html`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Printer className="w-5 h-5 text-emerald-600" />
                        Print Asset Tags
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Preview */}
                    <div className="border rounded-lg p-4 bg-gray-50">
                        <h3 className="text-sm font-semibold mb-2">Preview</h3>
                        <div className="bg-white border-2 border-dashed border-gray-300 p-4 rounded">
                            {assetsArray.length === 1 ? (
                                <div 
                                    dangerouslySetInnerHTML={{ 
                                        __html: generateAssetTagLabel(assetsArray[0], printOptions.includeQR) 
                                    }}
                                />
                            ) : (
                                <div className="text-center text-gray-600">
                                    {assetsArray.length} asset tags will be printed
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Print Options */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold">Print Options</h3>
                        
                        <div className="flex items-center justify-between">
                            <Label htmlFor="qr-code">Include QR Code</Label>
                            <Switch
                                id="qr-code"
                                checked={printOptions.includeQR}
                                onCheckedChange={(checked) => 
                                    setPrintOptions(prev => ({ ...prev, includeQR: checked }))
                                }
                            />
                        </div>

                        <div>
                            <Label>Label Size</Label>
                            <Select 
                                value={printOptions.labelSize}
                                onValueChange={(value) => 
                                    setPrintOptions(prev => ({ ...prev, labelSize: value }))
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="4x2">4" x 2" (Standard)</SelectItem>
                                    <SelectItem value="3x2">3" x 2" (Compact)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label>Number of Copies</Label>
                            <Select 
                                value={String(printOptions.copies)}
                                onValueChange={(value) => 
                                    setPrintOptions(prev => ({ ...prev, copies: parseInt(value) }))
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {[1, 2, 3, 4, 5].map(num => (
                                        <SelectItem key={num} value={String(num)}>
                                            {num} {num === 1 ? 'copy' : 'copies'}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Asset List */}
                    {assetsArray.length > 1 && (
                        <div>
                            <h3 className="text-sm font-semibold mb-2">Assets to Print ({assetsArray.length})</h3>
                            <div className="max-h-40 overflow-y-auto border rounded p-2 bg-gray-50">
                                {assetsArray.map((asset, idx) => (
                                    <div key={idx} className="text-sm py-1 flex items-center gap-2">
                                        <QrCode className="w-4 h-4 text-gray-400" />
                                        <span className="font-mono text-xs">{asset.asset_tag}</span>
                                        <span className="text-gray-600">- {asset.asset_name}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <Button variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button 
                            variant="outline"
                            onClick={handleDownloadPDF}
                            className="gap-2"
                        >
                            <Download className="w-4 h-4" />
                            Download HTML
                        </Button>
                        <Button 
                            onClick={handlePrint}
                            className="bg-emerald-600 hover:bg-emerald-700 gap-2"
                        >
                            <Printer className="w-4 h-4" />
                            Print Tags
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}