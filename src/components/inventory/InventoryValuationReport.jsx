import React, { useState } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calculator, Download } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function InventoryValuationReport() {
    const [valuationMethod, setValuationMethod] = useState('weighted_average');

    const { data: stockLevels = [] } = useQuery({
        queryKey: ['stockLevels'],
        queryFn: () => matrixSales.entities.StockLevel.list(),
        initialData: []
    });

    const { data: movements = [] } = useQuery({
        queryKey: ['movements'],
        queryFn: () => matrixSales.entities.StockMovement.filter({ 
            movement_type: 'goods_receipt',
            status: 'posted'
        }),
        initialData: []
    });

    // Calculate valuation based on method
    const calculateValuation = (material_code) => {
        const receipts = movements
            .filter(m => m.material_code === material_code)
            .sort((a, b) => new Date(a.movement_date) - new Date(b.movement_date));
        
        const currentStock = stockLevels.find(s => s.material_code === material_code);
        const quantity = currentStock?.quantity || 0;
        
        if (quantity === 0 || receipts.length === 0) {
            return { unit_cost: 0, total_value: 0 };
        }

        let unit_cost = 0;
        
        switch (valuationMethod) {
            case 'fifo':
                // FIFO - First In First Out
                let remainingQty = quantity;
                let totalCost = 0;
                
                for (const receipt of receipts) {
                    if (remainingQty <= 0) break;
                    const receiptQty = receipt.quantity || 0;
                    const receiptCost = receipt.cost_per_unit || 0;
                    const qtyToTake = Math.min(remainingQty, receiptQty);
                    totalCost += qtyToTake * receiptCost;
                    remainingQty -= qtyToTake;
                }
                
                unit_cost = quantity > 0 ? totalCost / quantity : 0;
                break;
                
            case 'lifo':
                // LIFO - Last In First Out
                let remainingQtyLIFO = quantity;
                let totalCostLIFO = 0;
                const reversedReceipts = [...receipts].reverse();
                
                for (const receipt of reversedReceipts) {
                    if (remainingQtyLIFO <= 0) break;
                    const receiptQty = receipt.quantity || 0;
                    const receiptCost = receipt.cost_per_unit || 0;
                    const qtyToTake = Math.min(remainingQtyLIFO, receiptQty);
                    totalCostLIFO += qtyToTake * receiptCost;
                    remainingQtyLIFO -= qtyToTake;
                }
                
                unit_cost = quantity > 0 ? totalCostLIFO / quantity : 0;
                break;
                
            case 'weighted_average':
            default:
                // Weighted Average
                const totalReceiptQty = receipts.reduce((sum, r) => sum + (r.quantity || 0), 0);
                const totalReceiptValue = receipts.reduce((sum, r) => sum + ((r.quantity || 0) * (r.cost_per_unit || 0)), 0);
                unit_cost = totalReceiptQty > 0 ? totalReceiptValue / totalReceiptQty : 0;
                break;
        }
        
        return {
            unit_cost,
            total_value: unit_cost * quantity
        };
    };

    // Group by material and calculate valuations
    const valuationData = Array.from(new Set(stockLevels.map(s => s.material_code))).map(code => {
        const stock = stockLevels.find(s => s.material_code === code);
        const valuation = calculateValuation(code);
        
        return {
            material_code: code,
            material_name: stock.material_name,
            total_quantity: stockLevels
                .filter(s => s.material_code === code)
                .reduce((sum, s) => sum + (s.quantity || 0), 0),
            unit_cost: valuation.unit_cost,
            total_value: valuation.total_value,
            unit_of_measure: stock.unit_of_measure
        };
    });

    const totalInventoryValue = valuationData.reduce((sum, v) => sum + v.total_value, 0);

    const handleExport = () => {
        const csv = [
            ['Material Code', 'Material Name', 'Quantity', 'UOM', 'Unit Cost', 'Total Value', 'Method'],
            ...valuationData.map(v => [
                v.material_code,
                v.material_name,
                v.total_quantity,
                v.unit_of_measure,
                v.unit_cost.toFixed(2),
                v.total_value.toFixed(2),
                valuationMethod.toUpperCase()
            ])
        ].map(row => row.join(',')).join('\n');
        
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `inventory_valuation_${valuationMethod}_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle className="flex items-center gap-2">
                        <Calculator className="w-5 h-5 text-indigo-600" />
                        Inventory Valuation Report
                    </CardTitle>
                    <div className="flex gap-2">
                        <Select value={valuationMethod} onValueChange={setValuationMethod}>
                            <SelectTrigger className="w-48">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="weighted_average">Weighted Average</SelectItem>
                                <SelectItem value="fifo">FIFO (First In First Out)</SelectItem>
                                <SelectItem value="lifo">LIFO (Last In First Out)</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button variant="outline" size="sm" onClick={handleExport}>
                            <Download className="w-4 h-4 mr-2" />
                            Export
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-4 rounded-lg border">
                    <div className="flex justify-between items-center">
                        <div>
                            <div className="text-sm text-gray-600">Total Inventory Value</div>
                            <div className="text-3xl font-bold text-indigo-700">
                                LKR {totalInventoryValue.toLocaleString()}
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-sm text-gray-600">Method</div>
                            <div className="text-lg font-semibold text-indigo-600">
                                {valuationMethod.toUpperCase().replace('_', ' ')}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="border rounded-lg overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-gray-50">
                                <TableHead>Material Code</TableHead>
                                <TableHead>Material Name</TableHead>
                                <TableHead className="text-right">Quantity</TableHead>
                                <TableHead>UOM</TableHead>
                                <TableHead className="text-right">Unit Cost</TableHead>
                                <TableHead className="text-right">Total Value</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {valuationData.map((item, idx) => (
                                <TableRow key={idx}>
                                    <TableCell className="font-mono text-sm">{item.material_code}</TableCell>
                                    <TableCell>{item.material_name}</TableCell>
                                    <TableCell className="text-right">{item.total_quantity.toLocaleString()}</TableCell>
                                    <TableCell>{item.unit_of_measure}</TableCell>
                                    <TableCell className="text-right">
                                        {item.unit_cost.toFixed(2)}
                                    </TableCell>
                                    <TableCell className="text-right font-semibold">
                                        {item.total_value.toLocaleString()}
                                    </TableCell>
                                </TableRow>
                            ))}
                            <TableRow className="bg-gray-100 font-bold">
                                <TableCell colSpan={5}>TOTAL</TableCell>
                                <TableCell className="text-right">
                                    LKR {totalInventoryValue.toLocaleString()}
                                </TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <h4 className="font-semibold mb-2">Valuation Method Explanation</h4>
                    <p className="text-sm text-gray-700">
                        {valuationMethod === 'fifo' && 
                            "FIFO assumes that the oldest inventory items are sold first. The cost of goods sold reflects the cost of the oldest purchases."}
                        {valuationMethod === 'lifo' && 
                            "LIFO assumes that the newest inventory items are sold first. The cost of goods sold reflects the cost of the most recent purchases."}
                        {valuationMethod === 'weighted_average' && 
                            "Weighted Average calculates a single average cost per unit based on all purchase costs and quantities, providing a balanced valuation."}
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}