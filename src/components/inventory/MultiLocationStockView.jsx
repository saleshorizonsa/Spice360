import React, { useState } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MapPin, Search, Package } from "lucide-react";

export default function MultiLocationStockView() {
    const [searchTerm, setSearchTerm] = useState('');

    const { data: stockLevels = [] } = useQuery({
        queryKey: ['stockLevels'],
        queryFn: () => matrixSales.entities.StockLevel.list(),
        initialData: []
    });

    const { data: locations = [] } = useQuery({
        queryKey: ['locations'],
        queryFn: () => matrixSales.entities.Location.list(),
        initialData: []
    });

    // Group stock by material across locations
    const materialStockSummary = stockLevels.reduce((acc, stock) => {
        if (!acc[stock.material_code]) {
            acc[stock.material_code] = {
                material_code: stock.material_code,
                material_name: stock.material_name,
                unit_of_measure: stock.unit_of_measure,
                locations: {},
                total_quantity: 0,
                total_available: 0,
                total_reserved: 0,
                total_value: 0
            };
        }
        
        acc[stock.material_code].locations[stock.warehouse_code] = {
            warehouse_name: stock.warehouse_name,
            bin_code: stock.bin_code,
            quantity: stock.quantity || 0,
            available: stock.available_quantity || 0,
            reserved: stock.reserved_quantity || 0,
            value: stock.total_value || 0
        };
        
        acc[stock.material_code].total_quantity += stock.quantity || 0;
        acc[stock.material_code].total_available += stock.available_quantity || 0;
        acc[stock.material_code].total_reserved += stock.reserved_quantity || 0;
        acc[stock.material_code].total_value += stock.total_value || 0;
        
        return acc;
    }, {});

    const materialArray = Object.values(materialStockSummary).filter(mat => 
        !searchTerm || 
        mat.material_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        mat.material_name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle className="flex items-center gap-2">
                        <MapPin className="w-5 h-5 text-blue-600" />
                        Multi-Location Stock Tracker
                    </CardTitle>
                    <div className="flex gap-2 items-center">
                        <Search className="w-4 h-4 text-gray-400" />
                        <Input
                            placeholder="Search material..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-64"
                        />
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {materialArray.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                        <Package className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                        <p>No materials found</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {materialArray.map(material => (
                            <div key={material.material_code} className="border rounded-lg overflow-hidden">
                                <div className="bg-gray-50 p-4 border-b">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h4 className="font-semibold text-lg">{material.material_name}</h4>
                                            <p className="text-sm text-gray-600">{material.material_code}</p>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-2xl font-bold text-emerald-700">
                                                {material.total_quantity.toLocaleString()} {material.unit_of_measure}
                                            </div>
                                            <div className="text-sm text-gray-600">
                                                Available: {material.total_available} | Reserved: {material.total_reserved}
                                            </div>
                                            <div className="text-sm font-semibold text-gray-700">
                                                Value: LKR {material.total_value.toLocaleString()}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Location</TableHead>
                                            <TableHead>Bin</TableHead>
                                            <TableHead className="text-right">Quantity</TableHead>
                                            <TableHead className="text-right">Available</TableHead>
                                            <TableHead className="text-right">Reserved</TableHead>
                                            <TableHead className="text-right">Value (LKR)</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {Object.entries(material.locations).map(([code, loc]) => (
                                            <TableRow key={code}>
                                                <TableCell className="font-medium">{loc.warehouse_name}</TableCell>
                                                <TableCell className="text-sm text-gray-600">{loc.bin_code || '-'}</TableCell>
                                                <TableCell className="text-right">{loc.quantity}</TableCell>
                                                <TableCell className="text-right">{loc.available}</TableCell>
                                                <TableCell className="text-right">{loc.reserved}</TableCell>
                                                <TableCell className="text-right">{loc.value.toLocaleString()}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}