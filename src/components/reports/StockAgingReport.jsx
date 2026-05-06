import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download } from "lucide-react";

export default function StockAgingReport() {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-emerald-600" />
                        Stock Aging (Dead / Slow-Moving)
                    </span>
                    <Button variant="outline" size="sm">
                        <Download className="w-4 h-4 mr-2" />
                        Export Excel
                    </Button>
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-center py-12 text-gray-500">
                    <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                    <p className="text-lg font-semibold mb-2">Stock Aging Analysis</p>
                    <p className="text-sm">Coming soon - identify dead stock, slow-moving items, and obsolete inventory</p>
                </div>
            </CardContent>
        </Card>
    );
}