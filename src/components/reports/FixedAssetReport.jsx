import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function FixedAssetReport() {
    const { data: fixedAssets = [] } = useQuery({
        queryKey: ['fixedAssets'],
        queryFn: () => base44.entities.FixedAsset.list(),
        initialData: []
    });

    const totalCost = fixedAssets.reduce((sum, a) => sum + (a.acquisition_cost || 0), 0);
    const totalDepreciation = fixedAssets.reduce((sum, a) => sum + (a.accumulated_depreciation || 0), 0);
    const totalNBV = totalCost - totalDepreciation;

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-emerald-600" />
                        Fixed Asset Register & Depreciation Schedule
                    </span>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm">
                            <Download className="w-4 h-4 mr-2" />
                            Export PDF
                        </Button>
                        <Button variant="outline" size="sm">
                            <FileText className="w-4 h-4 mr-2" />
                            Export Excel
                        </Button>
                    </div>
                </CardTitle>
            </CardHeader>
            <CardContent>
                {/* Summary */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                    <Card className="bg-blue-50">
                        <CardContent className="p-4">
                            <p className="text-sm text-gray-600">Total Cost</p>
                            <p className="text-2xl font-bold text-blue-700">
                                SAR {(totalCost / 1000).toFixed(0)}K
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="bg-red-50">
                        <CardContent className="p-4">
                            <p className="text-sm text-gray-600">Accumulated Depreciation</p>
                            <p className="text-2xl font-bold text-red-700">
                                SAR {(totalDepreciation / 1000).toFixed(0)}K
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="bg-emerald-50">
                        <CardContent className="p-4">
                            <p className="text-sm text-gray-600">Net Book Value</p>
                            <p className="text-2xl font-bold text-emerald-700">
                                SAR {(totalNBV / 1000).toFixed(0)}K
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Asset Table */}
                <div className="rounded-lg border overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-gray-50">
                                <TableHead>Asset #</TableHead>
                                <TableHead>Asset Name</TableHead>
                                <TableHead>Class</TableHead>
                                <TableHead>Acquisition Date</TableHead>
                                <TableHead className="text-right">Cost (SAR)</TableHead>
                                <TableHead className="text-right">Depreciation (SAR)</TableHead>
                                <TableHead className="text-right">NBV (SAR)</TableHead>
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {fixedAssets.map((asset, idx) => (
                                <TableRow key={idx}>
                                    <TableCell className="font-medium">{asset.asset_number}</TableCell>
                                    <TableCell>{asset.asset_name}</TableCell>
                                    <TableCell className="capitalize">{asset.asset_class}</TableCell>
                                    <TableCell>{new Date(asset.acquisition_date).toLocaleDateString()}</TableCell>
                                    <TableCell className="text-right font-mono">
                                        {asset.acquisition_cost?.toLocaleString('en-US', {minimumFractionDigits: 2})}
                                    </TableCell>
                                    <TableCell className="text-right font-mono">
                                        {asset.accumulated_depreciation?.toLocaleString('en-US', {minimumFractionDigits: 2})}
                                    </TableCell>
                                    <TableCell className="text-right font-mono font-semibold">
                                        {asset.net_book_value?.toLocaleString('en-US', {minimumFractionDigits: 2})}
                                    </TableCell>
                                    <TableCell className="capitalize">{asset.status}</TableCell>
                                </TableRow>
                            ))}
                            <TableRow className="bg-gray-100 font-bold">
                                <TableCell colSpan={4}>TOTAL</TableCell>
                                <TableCell className="text-right font-mono">
                                    {totalCost.toLocaleString('en-US', {minimumFractionDigits: 2})}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                    {totalDepreciation.toLocaleString('en-US', {minimumFractionDigits: 2})}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                    {totalNBV.toLocaleString('en-US', {minimumFractionDigits: 2})}
                                </TableCell>
                                <TableCell></TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}