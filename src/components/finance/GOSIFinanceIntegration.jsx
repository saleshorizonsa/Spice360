import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Shield, DollarSign, CheckCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function GOSIFinanceIntegration() {
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7));
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const { data: gosiContributions = [] } = useQuery({
        queryKey: ['gosiContributions', selectedMonth],
        queryFn: () => base44.entities.GOSIContribution.filter({
            month: selectedMonth,
            status: { $in: ['calculated', 'submitted', 'paid'] }
        }),
        initialData: []
    });

    const totalEmployeeContribution = gosiContributions.reduce((sum, g) => sum + (g.employee_contribution || 0), 0);
    const totalEmployerContribution = gosiContributions.reduce((sum, g) => sum + (g.employer_contribution || 0), 0);
    const totalOccupationalHazards = gosiContributions.reduce((sum, g) => sum + (g.occupational_hazards || 0), 0);
    const totalSanid = gosiContributions.reduce((sum, g) => sum + (g.sanid_scheme || 0), 0);
    const totalGOSI = totalEmployeeContribution + totalEmployerContribution + totalOccupationalHazards + totalSanid;

    const postGOSIToGL = useMutation({
        mutationFn: async () => {
            // Create journal entries for GOSI contributions
            const journalEntries = [
                // Employee GOSI Deduction (Payable)
                {
                    journal_number: `JE-GOSI-EMP-${selectedMonth}`,
                    posting_date: new Date().toISOString().split('T')[0],
                    account_code: '2110',
                    account_name: 'GOSI Payable - Employee',
                    debit_amount: 0,
                    credit_amount: totalEmployeeContribution,
                    description: `GOSI Employee Contribution for ${selectedMonth}`,
                    reference: `GOSI-${selectedMonth}`,
                    status: 'posted'
                },
                // Employer GOSI Expense
                {
                    journal_number: `JE-GOSI-EMPR-${selectedMonth}`,
                    posting_date: new Date().toISOString().split('T')[0],
                    account_code: '5120',
                    account_name: 'GOSI Expense - Employer',
                    debit_amount: totalEmployerContribution,
                    credit_amount: 0,
                    description: `GOSI Employer Contribution for ${selectedMonth}`,
                    reference: `GOSI-${selectedMonth}`,
                    status: 'posted'
                },
                // GOSI Payable - Employer
                {
                    journal_number: `JE-GOSI-PAY-${selectedMonth}`,
                    posting_date: new Date().toISOString().split('T')[0],
                    account_code: '2111',
                    account_name: 'GOSI Payable - Employer',
                    debit_amount: 0,
                    credit_amount: totalEmployerContribution,
                    description: `GOSI Employer Payable for ${selectedMonth}`,
                    reference: `GOSI-${selectedMonth}`,
                    status: 'posted'
                },
                // Occupational Hazards Expense
                {
                    journal_number: `JE-GOSI-OH-${selectedMonth}`,
                    posting_date: new Date().toISOString().split('T')[0],
                    account_code: '5121',
                    account_name: 'Occupational Hazards Insurance',
                    debit_amount: totalOccupationalHazards,
                    credit_amount: 0,
                    description: `GOSI Occupational Hazards for ${selectedMonth}`,
                    reference: `GOSI-${selectedMonth}`,
                    status: 'posted'
                },
                // Occupational Hazards Payable
                {
                    journal_number: `JE-GOSI-OHP-${selectedMonth}`,
                    posting_date: new Date().toISOString().split('T')[0],
                    account_code: '2112',
                    account_name: 'Occupational Hazards Payable',
                    debit_amount: 0,
                    credit_amount: totalOccupationalHazards,
                    description: `GOSI OH Payable for ${selectedMonth}`,
                    reference: `GOSI-${selectedMonth}`,
                    status: 'posted'
                },
                // SANID Expense
                {
                    journal_number: `JE-GOSI-SANID-${selectedMonth}`,
                    posting_date: new Date().toISOString().split('T')[0],
                    account_code: '5122',
                    account_name: 'SANID Unemployment Insurance',
                    debit_amount: totalSanid,
                    credit_amount: 0,
                    description: `GOSI SANID for ${selectedMonth}`,
                    reference: `GOSI-${selectedMonth}`,
                    status: 'posted'
                },
                // SANID Payable
                {
                    journal_number: `JE-GOSI-SANIDP-${selectedMonth}`,
                    posting_date: new Date().toISOString().split('T')[0],
                    account_code: '2113',
                    account_name: 'SANID Payable',
                    debit_amount: 0,
                    credit_amount: totalSanid,
                    description: `GOSI SANID Payable for ${selectedMonth}`,
                    reference: `GOSI-${selectedMonth}`,
                    status: 'posted'
                }
            ];

            // Post all journal entries
            for (const entry of journalEntries) {
                await base44.entities.JournalEntry.create(entry);
            }

            // Update GOSI contributions status
            for (const gosi of gosiContributions) {
                await base44.entities.GOSIContribution.update(gosi.id, {
                    ...gosi,
                    status: 'submitted'
                });
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries();
            toast({
                title: "Success",
                description: "GOSI contributions posted to General Ledger"
            });
        },
        onError: () => {
            toast({
                title: "Error",
                description: "Failed to post GOSI to GL",
                variant: "destructive"
            });
        }
    });

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle className="flex items-center gap-2">
                        <Shield className="w-5 h-5 text-emerald-600" />
                        GOSI Finance Integration
                    </CardTitle>
                    <Button
                        onClick={() => postGOSIToGL.mutate()}
                        disabled={gosiContributions.length === 0 || postGOSIToGL.isPending}
                        className="bg-emerald-600 hover:bg-emerald-700"
                    >
                        <DollarSign className="w-4 h-4 mr-2" />
                        Post to GL
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                <div>
                    <label className="text-sm font-medium">Month</label>
                    <input
                        type="month"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="w-full border rounded px-3 py-2 mt-1"
                    />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                        <div className="text-sm text-gray-600">Employee GOSI</div>
                        <div className="text-2xl font-bold text-blue-700">
                            SAR {totalEmployeeContribution.toLocaleString()}
                        </div>
                    </div>
                    <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                        <div className="text-sm text-gray-600">Employer GOSI</div>
                        <div className="text-2xl font-bold text-purple-700">
                            SAR {totalEmployerContribution.toLocaleString()}
                        </div>
                    </div>
                    <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                        <div className="text-sm text-gray-600">Occupational Hazards</div>
                        <div className="text-2xl font-bold text-orange-700">
                            SAR {totalOccupationalHazards.toLocaleString()}
                        </div>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                        <div className="text-sm text-gray-600">SANID</div>
                        <div className="text-2xl font-bold text-green-700">
                            SAR {totalSanid.toLocaleString()}
                        </div>
                    </div>
                </div>

                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 p-4 rounded-lg border">
                    <div className="flex justify-between items-center">
                        <span className="text-lg font-semibold">Total GOSI Contribution</span>
                        <span className="text-3xl font-bold text-emerald-700">
                            SAR {totalGOSI.toLocaleString()}
                        </span>
                    </div>
                </div>

                <div className="border rounded-lg overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-gray-50">
                                <TableHead>Employee</TableHead>
                                <TableHead>Nationality</TableHead>
                                <TableHead className="text-right">GOSI Wage</TableHead>
                                <TableHead className="text-right">Employee</TableHead>
                                <TableHead className="text-right">Employer</TableHead>
                                <TableHead className="text-right">Total</TableHead>
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {gosiContributions.map((gosi, idx) => (
                                <TableRow key={idx}>
                                    <TableCell>
                                        <div className="font-medium">{gosi.employee_name}</div>
                                        <div className="text-xs text-gray-500">{gosi.employee_id}</div>
                                    </TableCell>
                                    <TableCell>
                                        {gosi.is_saudi ? (
                                            <span className="text-green-700">🇸🇦 Saudi</span>
                                        ) : (
                                            <span className="text-blue-700">Non-Saudi</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {gosi.gosi_wage?.toLocaleString()}
                                    </TableCell>
                                    <TableCell className="text-right text-blue-700">
                                        {gosi.employee_contribution?.toFixed(2)}
                                    </TableCell>
                                    <TableCell className="text-right text-purple-700">
                                        {gosi.employer_contribution?.toFixed(2)}
                                    </TableCell>
                                    <TableCell className="text-right font-semibold">
                                        {gosi.total_contribution?.toFixed(2)}
                                    </TableCell>
                                    <TableCell>
                                        {gosi.status === 'submitted' ? (
                                            <span className="flex items-center gap-1 text-green-600">
                                                <CheckCircle className="w-4 h-4" />
                                                Posted
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1 text-amber-600">
                                                <AlertCircle className="w-4 h-4" />
                                                Pending
                                            </span>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>

                {gosiContributions.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                        No GOSI contributions found for {selectedMonth}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}