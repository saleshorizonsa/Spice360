import React, { useState } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileText, Package } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function StockOnHandReport() {
    const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);
    const [warehouseFilter, setWarehouseFilter] = useState("ALL");
    const [groupBy, setGroupBy] = useState("warehouse");

    const { data: stockLevels = [] } = useQuery({
        queryKey: ['stockLevels'],
        queryFn: () => matrixSales.entities.StockLevel.list(),
        initialData: []
    });

    const filteredStock = stockLevels.filter(s => {
        const warehouseMatch = warehouseFilter === 'ALL' || s.warehouse_code === warehouseFilter;
        return warehouseMatch && s.quantity > 0;
    });

    const totalQty = filteredStock.reduce((sum, s) => sum + (s.quantity || 0), 0);
    const totalValue = filteredStock.reduce((sum, s) => sum + ((s.quantity || 0) * (s.unit_cost || 0)), 0);

    const handleExportPDF = () => {
        const printWindow = window.open('', '_blank');
        const content = `
            <html>
                <head>
                    <title>Stock on Hand Report - ${asOfDate}</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 40px; font-size: 11px; }
                        h1 { color: #059669; text-align: center; }
                        .header { text-align: center; margin-bottom: 20px; }
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                        th { background-color: #f3f4f6; font-weight: bold; }
                        .number { text-align: right; font-family: monospace; }
                        .total-row { font-weight: bold; background-color: #e5e7eb; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>MatrixERP - Stock on Hand Report</h1>
                        <p><strong>As of Date:</strong> ${new Date(asOfDate).toLocaleDateString()}</p>
                        <p><strong>Warehouse:</strong> ${warehouseFilter === 'ALL' ? 'All Warehouses' : warehouseFilter}</p>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th>Material Code</th>
                                <th>Material Name</th>
                                <th>Warehouse</th>
                                <th>Bin</th>
                                <th>Batch</th>
                                <th class="number">Quantity</th>
                                <th>UOM</th>
                                <th class="number">Unit Cost</th>
                                <th class="number">Total Value</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filteredStock.map(stock => `
                                <tr>
                                    <td>${stock.material_code}</td>
                                    <td>${stock.material_name}</td>
                                    <td>${stock.warehouse_code}</td>
                                    <td>${stock.bin_code || '-'}</td>
                                    <td>${stock.batch_number || '-'}</td>
                                    <td class="number">${(stock.quantity || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                                    <td>${stock.unit_of_measure}</td>
                                    <td class="number">${(stock.unit_cost || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                                    <td class="number">${((stock.quantity || 0) * (stock.unit_cost || 0)).toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                                    <td>${stock.status}</td>
                                </tr>
                            `).join('')}
                            <tr class="total-row">
                                <td colspan="5">TOTAL</td>
                                <td class="number">${totalQty.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                                <td colspan="2"></td>
                                <td class="number">${totalValue.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                                <td></td>
                            </tr>
                        </tbody>
                    </table>
                    <p style="margin-top: 20px; font-size: 10px; color: #6b7280;">
                        Generated on: ${new Date().toLocaleString()} | MatrixERP Inventory Management System
                    </p>
                </body>
            </html>
        `;
        printWindow.document.write(content);
        printWindow.document.close();
        printWindow.print();
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                        <Package className="w-5 h-5 text-emerald-600" />
                        Stock on Hand Report
                    </span>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={handleExportPDF}>
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
                {/* Filters */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
                    <div>
                        <Label>As of Date</Label>
                        <Input
                            type="date"
                            value={asOfDate}
                            onChange={(e) => setAsOfDate(e.target.value)}
                        />
                    </div>
                    <div>
                        <Label>Warehouse</Label>
                        <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">All Warehouses</SelectItem>
                                <SelectItem value="WH01">Main Warehouse</SelectItem>
                                <SelectItem value="WH02">Raw Materials WH</SelectItem>
                                <SelectItem value="WH03">Finished Goods WH</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label>Group By</Label>
                        <Select value={groupBy} onValueChange={setGroupBy}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="warehouse">Warehouse</SelectItem>
                                <SelectItem value="material">Material</SelectItem>
                                <SelectItem value="batch">Batch</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex items-end">
                        <Button className="w-full bg-emerald-600 hover:bg-emerald-700">
                            Generate Report
                        </Button>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                    <Card className="bg-blue-50">
                        <CardContent className="p-4">
                            <p className="text-sm text-gray-600">Total SKUs</p>
                            <p className="text-2xl font-bold text-blue-700">{filteredStock.length}</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-emerald-50">
                        <CardContent className="p-4">
                            <p className="text-sm text-gray-600">Total Quantity</p>
                            <p className="text-2xl font-bold text-emerald-700">
                                {totalQty.toLocaleString()}
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="bg-indigo-50">
                        <CardContent className="p-4">
                            <p className="text-sm text-gray-600">Total Value</p>
                            <p className="text-2xl font-bold text-indigo-700">
                                LKR {(totalValue / 1000).toFixed(0)}K
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Stock Table */}
                <div className="rounded-lg border overflow-hidden max-h-[600px] overflow-y-auto">
                    <Table>
                        <TableHeader className="sticky top-0 bg-gray-50 z-10">
                            <TableRow>
                                <TableHead>Material Code</TableHead>
                                <TableHead>Material Name</TableHead>
                                <TableHead>Warehouse</TableHead>
                                <TableHead>Bin</TableHead>
                                <TableHead>Batch</TableHead>
                                <TableHead className="text-right">Quantity</TableHead>
                                <TableHead>UOM</TableHead>
                                <TableHead className="text-right">Unit Cost</TableHead>
                                <TableHead className="text-right">Total Value</TableHead>
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredStock.map((stock, idx) => (
                                <TableRow key={idx}>
                                    <TableCell className="font-medium">{stock.material_code}</TableCell>
                                    <TableCell>{stock.material_name}</TableCell>
                                    <TableCell>{stock.warehouse_code}</TableCell>
                                    <TableCell>{stock.bin_code || '-'}</TableCell>
                                    <TableCell>{stock.batch_number || '-'}</TableCell>
                                    <TableCell className="text-right font-mono">
                                        {(stock.quantity || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}
                                    </TableCell>
                                    <TableCell>{stock.unit_of_measure}</TableCell>
                                    <TableCell className="text-right font-mono">
                                        {(stock.unit_cost || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}
                                    </TableCell>
                                    <TableCell className="text-right font-mono font-bold">
                                        {((stock.quantity || 0) * (stock.unit_cost || 0)).toLocaleString('en-US', {minimumFractionDigits: 2})}
                                    </TableCell>
                                    <TableCell className="capitalize">{stock.status}</TableCell>
                                </TableRow>
                            ))}
                            <TableRow className="bg-gray-100 font-bold">
                                <TableCell colSpan={5}>TOTAL</TableCell>
                                <TableCell className="text-right font-mono">
                                    {totalQty.toLocaleString('en-US', {minimumFractionDigits: 2})}
                                </TableCell>
                                <TableCell colSpan={2}></TableCell>
                                <TableCell className="text-right font-mono">
                                    {totalValue.toLocaleString('en-US', {minimumFractionDigits: 2})}
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