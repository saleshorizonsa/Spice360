import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Upload, X, CheckCircle2, AlertTriangle, FileSpreadsheet, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function ExcelUploadForm({ entityType, onClose }) {
    const [file, setFile] = useState(null);
    const [previewData, setPreviewData] = useState([]);
    const [validationErrors, setValidationErrors] = useState([]);
    const [step, setStep] = useState(1); // 1: upload, 2: preview, 3: importing
    const [importResults, setImportResults] = useState(null);
    
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            if (selectedFile.type === 'text/csv' || selectedFile.name.endsWith('.csv')) {
                setFile(selectedFile);
                parseCSV(selectedFile);
            } else {
                toast({
                    title: "Invalid File",
                    description: "Please upload a CSV file",
                    variant: "destructive",
                });
            }
        }
    };

    const parseCSV = (file) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target.result;
            const lines = text.split('\n').filter(line => line.trim());
            
            if (lines.length < 2) {
                toast({
                    title: "Empty File",
                    description: "The CSV file is empty or has no data rows",
                    variant: "destructive",
                });
                return;
            }

            const headers = lines[0].split(',').map(h => h.trim());
            const data = [];
            const errors = [];

            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(',').map(v => v.trim());
                const row = {};
                
                headers.forEach((header, index) => {
                    row[header] = values[index] || '';
                });

                // Basic validation
                const rowErrors = validateRow(row, entityType, i + 1);
                if (rowErrors.length > 0) {
                    errors.push(...rowErrors);
                }

                data.push(row);
            }

            setPreviewData(data);
            setValidationErrors(errors);
            setStep(2);
        };
        reader.readAsText(file);
    };

    const validateRow = (row, entityType, rowNumber) => {
        const errors = [];

        if (entityType === 'Material') {
            if (!row.material_code) errors.push({ row: rowNumber, field: 'material_code', message: 'Material code is required' });
            if (!row.material_name) errors.push({ row: rowNumber, field: 'material_name', message: 'Material name is required' });
            if (!row.material_type) errors.push({ row: rowNumber, field: 'material_type', message: 'Material type is required' });
            if (!row.unit_of_measure) errors.push({ row: rowNumber, field: 'unit_of_measure', message: 'Unit of measure is required' });
        } else if (entityType === 'Customer') {
            if (!row.customer_code) errors.push({ row: rowNumber, field: 'customer_code', message: 'Customer code is required' });
            if (!row.customer_name) errors.push({ row: rowNumber, field: 'customer_name', message: 'Customer name is required' });
            if (!row.contact_person) errors.push({ row: rowNumber, field: 'contact_person', message: 'Contact person is required' });
            if (!row.phone) errors.push({ row: rowNumber, field: 'phone', message: 'Phone is required' });
        } else if (entityType === 'Vendor') {
            if (!row.vendor_code) errors.push({ row: rowNumber, field: 'vendor_code', message: 'Vendor code is required' });
            if (!row.vendor_name) errors.push({ row: rowNumber, field: 'vendor_name', message: 'Vendor name is required' });
            if (!row.contact_person) errors.push({ row: rowNumber, field: 'contact_person', message: 'Contact person is required' });
            if (!row.phone) errors.push({ row: rowNumber, field: 'phone', message: 'Phone is required' });
        }

        return errors;
    };

    const bulkImportMutation = useMutation({
        mutationFn: async (data) => {
            const results = { success: 0, failed: 0, errors: [] };
            
            for (let i = 0; i < data.length; i++) {
                try {
                    const record = transformData(data[i], entityType);
                    await base44.entities[entityType].create(record);
                    results.success++;
                } catch (error) {
                    results.failed++;
                    results.errors.push({
                        row: i + 2, // +2 because row 1 is header, and we start from index 0
                        data: data[i],
                        error: error.message || 'Unknown error'
                    });
                }
            }
            
            return results;
        },
        onSuccess: (results) => {
            setImportResults(results);
            queryClient.invalidateQueries({ queryKey: [entityType.toLowerCase() + 's'] });
            queryClient.invalidateQueries({ queryKey: ['materials'] });
            queryClient.invalidateQueries({ queryKey: ['customers'] });
            queryClient.invalidateQueries({ queryKey: ['vendors'] });
            
            toast({
                title: "Import Completed",
                description: `Successfully imported ${results.success} records. ${results.failed} failed.`,
            });
        },
        onError: (error) => {
            toast({
                title: "Import Failed",
                description: error.message || "An error occurred during import",
                variant: "destructive",
            });
        }
    });

    const transformData = (row, entityType) => {
        if (entityType === 'Material') {
            return {
                material_code: row.material_code,
                material_name: row.material_name,
                material_type: row.material_type,
                unit_of_measure: row.unit_of_measure,
                unit_price: parseFloat(row.unit_price) || 0,
                unit_cost: parseFloat(row.unit_cost) || 0,
                group_code: row.group_code || '',
                subgroup_code: row.subgroup_code || '',
                current_stock: parseFloat(row.current_stock) || 0,
                reorder_point: parseFloat(row.reorder_point) || 0,
                max_stock_level: parseFloat(row.max_stock_level) || 0,
                location_code: row.location_code || '',
                supplier_code: row.supplier_code || '',
                supplier_name: row.supplier_name || '',
                lead_time_days: parseInt(row.lead_time_days) || 0,
                specifications: row.specifications || '',
                status: row.status || 'active',
            };
        } else if (entityType === 'Customer') {
            return {
                customer_code: row.customer_code,
                customer_name: row.customer_name,
                customer_type: row.customer_type || 'corporate',
                contact_person: row.contact_person,
                email: row.email || '',
                phone: row.phone,
                mobile: row.mobile || '',
                address: row.address || '',
                city: row.city || '',
                state: row.state || '',
                postal_code: row.postal_code || '',
                country: row.country || 'Saudi Arabia',
                tax_id: row.tax_id || '',
                credit_limit: parseFloat(row.credit_limit) || 0,
                payment_terms: row.payment_terms || 'net_30',
                outstanding_balance: 0,
                status: row.status || 'active',
            };
        } else if (entityType === 'Vendor') {
            return {
                vendor_code: row.vendor_code,
                vendor_name: row.vendor_name,
                vendor_type: row.vendor_type || 'manufacturer',
                contact_person: row.contact_person,
                email: row.email || '',
                phone: row.phone,
                mobile: row.mobile || '',
                address: row.address || '',
                city: row.city || '',
                state: row.state || '',
                postal_code: row.postal_code || '',
                country: row.country || 'Saudi Arabia',
                tax_id: row.tax_id || '',
                payment_terms: row.payment_terms || 'net_30',
                currency: row.currency || 'SAR',
                rating: parseInt(row.rating) || 3,
                status: row.status || 'active',
            };
        }
    };

    const handleImport = () => {
        if (validationErrors.length > 0) {
            toast({
                title: "Validation Errors",
                description: `Cannot import. Please fix ${validationErrors.length} validation errors.`,
                variant: "destructive",
            });
            return;
        }

        setStep(3);
        bulkImportMutation.mutate(previewData);
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle className="flex items-center gap-2">
                        <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                        Upload {entityType} Data from Excel
                    </CardTitle>
                    <Button variant="ghost" size="icon" onClick={onClose}>
                        <X className="w-4 h-4" />
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Step Indicator */}
                <div className="flex items-center justify-center gap-4">
                    <div className={`flex items-center gap-2 ${step >= 1 ? 'text-emerald-600' : 'text-gray-400'}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 1 ? 'bg-emerald-600 text-white' : 'bg-gray-200'}`}>
                            {step > 1 ? <CheckCircle2 className="w-5 h-5" /> : '1'}
                        </div>
                        <span className="text-sm font-medium">Upload</span>
                    </div>
                    <div className="w-12 h-0.5 bg-gray-300" />
                    <div className={`flex items-center gap-2 ${step >= 2 ? 'text-emerald-600' : 'text-gray-400'}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 2 ? 'bg-emerald-600 text-white' : 'bg-gray-200'}`}>
                            {step > 2 ? <CheckCircle2 className="w-5 h-5" /> : '2'}
                        </div>
                        <span className="text-sm font-medium">Preview</span>
                    </div>
                    <div className="w-12 h-0.5 bg-gray-300" />
                    <div className={`flex items-center gap-2 ${step >= 3 ? 'text-emerald-600' : 'text-gray-400'}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 3 ? 'bg-emerald-600 text-white' : 'bg-gray-200'}`}>
                            {importResults ? <CheckCircle2 className="w-5 h-5" /> : '3'}
                        </div>
                        <span className="text-sm font-medium">Import</span>
                    </div>
                </div>

                {/* Step 1: File Upload */}
                {step === 1 && (
                    <div className="space-y-4">
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                            <Label htmlFor="file-upload" className="cursor-pointer">
                                <span className="text-blue-600 hover:text-blue-700 font-medium">
                                    Click to upload
                                </span>
                                <span className="text-gray-600"> or drag and drop</span>
                            </Label>
                            <Input
                                id="file-upload"
                                type="file"
                                accept=".csv"
                                onChange={handleFileChange}
                                className="hidden"
                            />
                            <p className="text-sm text-gray-500 mt-2">CSV file only (max 10MB)</p>
                        </div>

                        {file && (
                            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <FileSpreadsheet className="w-8 h-8 text-blue-600" />
                                    <div>
                                        <p className="font-medium text-gray-900">{file.name}</p>
                                        <p className="text-sm text-gray-600">
                                            {(file.size / 1024).toFixed(2)} KB
                                        </p>
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        setFile(null);
                                        setPreviewData([]);
                                        setValidationErrors([]);
                                    }}
                                >
                                    <X className="w-4 h-4" />
                                </Button>
                            </div>
                        )}

                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                            <div className="flex items-start gap-3">
                                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                                <div className="text-sm text-amber-800">
                                    <p className="font-medium mb-1">Important Notes:</p>
                                    <ul className="list-disc list-inside space-y-1">
                                        <li>Download the template first and fill it with your data</li>
                                        <li>Do not modify column headers in the template</li>
                                        <li>Ensure all required fields are filled</li>
                                        <li>Data will be validated before import</li>
                                        <li>Once imported, data will be available across ALL modules instantly</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Step 2: Preview & Validation */}
                {step === 2 && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-lg font-semibold text-gray-900">
                                    Preview: {previewData.length} records found
                                </p>
                                {validationErrors.length > 0 && (
                                    <p className="text-sm text-red-600">
                                        {validationErrors.length} validation errors found
                                    </p>
                                )}
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    setStep(1);
                                    setFile(null);
                                    setPreviewData([]);
                                    setValidationErrors([]);
                                }}
                            >
                                Choose Different File
                            </Button>
                        </div>

                        {/* Validation Errors */}
                        {validationErrors.length > 0 && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-h-40 overflow-y-auto">
                                <p className="font-medium text-red-800 mb-2">Validation Errors:</p>
                                <ul className="space-y-1">
                                    {validationErrors.slice(0, 10).map((error, idx) => (
                                        <li key={idx} className="text-sm text-red-700">
                                            Row {error.row}: {error.field} - {error.message}
                                        </li>
                                    ))}
                                    {validationErrors.length > 10 && (
                                        <li className="text-sm text-red-700 font-medium">
                                            ... and {validationErrors.length - 10} more errors
                                        </li>
                                    )}
                                </ul>
                            </div>
                        )}

                        {/* Preview Table */}
                        <div className="border rounded-lg max-h-96 overflow-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="sticky top-0 bg-gray-50">#</TableHead>
                                        {previewData.length > 0 && Object.keys(previewData[0]).map(header => (
                                            <TableHead key={header} className="sticky top-0 bg-gray-50">
                                                {header}
                                            </TableHead>
                                        ))}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {previewData.slice(0, 10).map((row, idx) => (
                                        <TableRow key={idx}>
                                            <TableCell className="font-medium">{idx + 1}</TableCell>
                                            {Object.values(row).map((value, cellIdx) => (
                                                <TableCell key={cellIdx}>{value || '-'}</TableCell>
                                            ))}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>

                        {previewData.length > 10 && (
                            <p className="text-sm text-gray-600 text-center">
                                Showing first 10 of {previewData.length} records
                            </p>
                        )}

                        <div className="flex justify-end gap-3">
                            <Button variant="outline" onClick={() => setStep(1)}>
                                Back
                            </Button>
                            <Button
                                onClick={handleImport}
                                disabled={validationErrors.length > 0}
                                className="bg-emerald-600 hover:bg-emerald-700"
                            >
                                Import {previewData.length} Records
                            </Button>
                        </div>
                    </div>
                )}

                {/* Step 3: Importing */}
                {step === 3 && !importResults && (
                    <div className="py-12 text-center">
                        <Loader2 className="w-12 h-12 text-emerald-600 animate-spin mx-auto mb-4" />
                        <p className="text-lg font-semibold text-gray-900">Importing data...</p>
                        <p className="text-sm text-gray-600 mt-1">Please wait while we process your records</p>
                    </div>
                )}

                {/* Step 3: Results */}
                {step === 3 && importResults && (
                    <div className="space-y-4">
                        <div className="text-center py-6">
                            <CheckCircle2 className="w-16 h-16 text-green-600 mx-auto mb-4" />
                            <h3 className="text-2xl font-bold text-gray-900 mb-2">Import Complete!</h3>
                            <p className="text-gray-600">
                                Your data has been imported and is now available across all modules
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <Card className="bg-green-50 border-green-200">
                                <CardContent className="p-4 text-center">
                                    <p className="text-3xl font-bold text-green-700">{importResults.success}</p>
                                    <p className="text-sm text-green-600">Successfully Imported</p>
                                </CardContent>
                            </Card>
                            <Card className="bg-red-50 border-red-200">
                                <CardContent className="p-4 text-center">
                                    <p className="text-3xl font-bold text-red-700">{importResults.failed}</p>
                                    <p className="text-sm text-red-600">Failed</p>
                                </CardContent>
                            </Card>
                        </div>

                        {importResults.errors.length > 0 && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-h-60 overflow-y-auto">
                                <p className="font-medium text-red-800 mb-2">Failed Records:</p>
                                <ul className="space-y-2">
                                    {importResults.errors.map((error, idx) => (
                                        <li key={idx} className="text-sm text-red-700">
                                            <span className="font-medium">Row {error.row}:</span> {error.error}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <div className="flex justify-center gap-3">
                            <Button onClick={onClose} className="bg-emerald-600 hover:bg-emerald-700">
                                Done
                            </Button>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}