import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download } from "lucide-react";

export default function QuotationConversionReport() {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-emerald-600" />
                        Quotation → Order Conversion (Hit Rate)
                    </span>
                    <Button variant="outline" size="sm">
                        <Download className="w-4 h-4 mr-2" />
                        Export PDF
                    </Button>
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-center py-12 text-gray-500">
                    <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                    <p className="text-lg font-semibold mb-2">Quotation Conversion Analysis</p>
                    <p className="text-sm">Coming soon - track quote-to-order conversion rates by salesperson, product, and customer</p>
                </div>
            </CardContent>
        </Card>
    );
}