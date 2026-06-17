import React, { useState, useEffect } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { postJournalEntry } from "../utils/journalService";
import { useOrganization } from "../utils/OrganizationContext";
import { useGLAccounts } from "@/hooks/useGLAccounts";

export default function LoanAdvanceForm({ item, onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { currentOrg } = useOrganization();
    const gl = useGLAccounts();

    const { data: employees = [] } = useQuery({
        queryKey: ['employees'],
        queryFn: () => matrixSales.entities.Employee.list(),
        initialData: []
    });

    const [formData, setFormData] = useState({
        loan_number: '',
        employee_number: '',
        employee_name: '',
        loan_type: 'loan',
        loan_amount: 0,
        number_of_installments: 12,
        installment_amount: 0,
        amount_remaining: 0,
        reason: '',
        status: 'pending'
    });

    useEffect(() => {
        if (item) {
            setFormData(item);
        }
    }, [item]);

    useEffect(() => {
        const installment = formData.number_of_installments > 0 
            ? formData.loan_amount / formData.number_of_installments 
            : 0;
        setFormData(prev => ({
            ...prev,
            installment_amount: installment,
            amount_remaining: prev.loan_amount
        }));
    }, [formData.loan_amount, formData.number_of_installments]);

    const handleEmployeeSelect = (empNumber) => {
        const emp = employees.find(e => e.employee_number === empNumber);
        if (emp) {
            setFormData(prev => ({
                ...prev,
                employee_number: empNumber,
                employee_name: emp.full_name
            }));
        }
    };

    const saveMutation = useMutation({
        mutationFn: async (data) => {
            let loan;
            if (item) {
                loan = await matrixSales.entities.LoanAdvance.update(item.id, data);
            } else {
                loan = await matrixSales.entities.LoanAdvance.create(data);
            }

            // Post GL when loan is approved for disbursement (non-fatal)
            const isApproval = !item && data.status === 'approved'
                || (item?.status !== 'approved' && data.status === 'approved');
            const loanAmount = parseFloat(data.loan_amount) || 0;
            if (isApproval && loanAmount > 0 && !data.gl_posted) {
                try {
                    // Employee Loans Receivable (1150) DR / Cash CR on disbursement
                    await postJournalEntry({
                        description: `Employee loan disbursement — ${data.employee_name} (${data.loan_number || loan.id})`,
                        entryDate:   new Date().toISOString().slice(0, 10),
                        referenceType: 'loan_advance',
                        referenceId:   loan.id,
                        entryType:     'loan',
                        lines: [
                            { accountCode: '1150',          accountName: 'Employee Loans Receivable', debitAmount: loanAmount, creditAmount: 0,           description: data.employee_name },
                            { accountCode: gl.cash_bank,    accountName: 'Cash / Bank',               debitAmount: 0,          creditAmount: loanAmount,   description: data.employee_name },
                        ],
                        orgId: currentOrg?.id,
                    });
                    await matrixSales.entities.LoanAdvance.update(loan.id, { gl_posted: true });
                } catch (_) { /* non-fatal */ }
            }

            return loan;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['loans'] });
            toast({ title: "Success", description: "Loan/advance saved" });
            onClose();
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        saveMutation.mutate(formData);
    };

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{item ? 'Edit' : 'New'} Loan/Advance</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Loan Number</Label>
                            <Input
                                value={formData.loan_number}
                                onChange={(e) => setFormData({...formData, loan_number: e.target.value})}
                                required
                            />
                        </div>
                        <div>
                            <Label>Employee</Label>
                            <Select value={formData.employee_number} onValueChange={handleEmployeeSelect}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select employee" />
                                </SelectTrigger>
                                <SelectContent>
                                    {employees.map(e => (
                                        <SelectItem key={e.id} value={e.employee_number}>
                                            {e.employee_number} - {e.full_name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <Label>Type</Label>
                            <Select value={formData.loan_type} onValueChange={(val) => setFormData({...formData, loan_type: val})}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="loan">Loan</SelectItem>
                                    <SelectItem value="advance">Advance</SelectItem>
                                    <SelectItem value="emergency">Emergency</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Amount (LKR)</Label>
                            <Input
                                type="number"
                                value={formData.loan_amount}
                                onChange={(e) => setFormData({...formData, loan_amount: parseFloat(e.target.value) || 0})}
                                required
                            />
                        </div>
                        <div>
                            <Label>Installments</Label>
                            <Input
                                type="number"
                                value={formData.number_of_installments}
                                onChange={(e) => setFormData({...formData, number_of_installments: parseInt(e.target.value) || 1})}
                                required
                            />
                        </div>
                    </div>

                    <div className="p-4 bg-blue-50 rounded">
                        <div className="flex justify-between">
                            <span>Monthly Installment:</span>
                            <span className="font-bold text-lg">LKR {formData.installment_amount.toFixed(2)}</span>
                        </div>
                    </div>

                    <div>
                        <Label>Reason</Label>
                        <Textarea value={formData.reason} onChange={(e) => setFormData({...formData, reason: e.target.value})} />
                    </div>

                    <div className="flex justify-end gap-3">
                        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                        <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                            {item ? 'Update' : 'Create'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}