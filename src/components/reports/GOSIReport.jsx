import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download } from "lucide-react";

export default function GOSIReport() {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-emerald-600" />
                        GOSI Contribution Report
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
                    <p className="text-lg font-semibold mb-2">GOSI Contribution Report</p>
                    <p className="text-sm">Coming soon - monthly GOSI contributions for Saudi and expat employees</p>
                </div>
            </CardContent>
        </Card>
    );
}