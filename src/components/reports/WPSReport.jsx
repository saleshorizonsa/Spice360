import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download } from "lucide-react";

export default function WPSReport() {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-emerald-600" />
                        WPS Payroll Bank File
                    </span>
                    <Button variant="outline" size="sm">
                        <Download className="w-4 h-4 mr-2" />
                        Generate WPS File
                    </Button>
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-center py-12 text-gray-500">
                    <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                    <p className="text-lg font-semibold mb-2">WPS Payroll Bank File</p>
                    <p className="text-sm">Coming soon - generate WPS files for salary transfer with bank acknowledgments</p>
                </div>
            </CardContent>
        </Card>
    );
}