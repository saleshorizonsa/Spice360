import React, { useState, useEffect } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { Paperclip } from "lucide-react";
import DocumentList from "../shared/DocumentList";

export default function JournalEntryForm({ item, onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [activeTab, setActiveTab] = useState("details");

    const { data: accounts = [] } = useQuery({
        queryKey: ['chartOfAccounts'],
        queryFn: () => matrixSales.entities.ChartOfAccounts.filter({ status: 'active' }),
        initialData: []
    });

    const [formData, setFormData] = useState({
        je_number: '',
        je_date: new Date().toISOString().split('T')[0],
        je_type: 'general',
        description: '',
        debit_account_code: '',
        debit_account_name: '',
        credit_account_code: '',
        credit_account_name: '',
        amount: 0,
        reference: '',
        cost_center: '',
        project_code: '',
        status: 'draft',
        notes: ''
    });

    useEffect(() => {
        if (item) {
            setFormData(item);
        }
    }, [item]);

    const handleAccountSelect = (field, accountCode) => {
        const account = accounts.find(a => a.account_code === accountCode);
        if (account) {
            if (field === 'debit') {
                setFormData(prev => ({
                    ...prev,
                    debit_account_code: accountCode,
                    debit_account_name: account.account_name
                }));
            } else {
                setFormData(prev => ({
                    ...prev,
                    credit_account_code: accountCode,
                    credit_account_name: account.account_name
                }));
            }
        }
    };

    const saveMutation = useMutation({
        mutationFn: (data) => {
            if (item) {
                return matrixSales.entities.JournalEntry.update(item.id, data);
            }
            return matrixSales.entities.JournalEntry.create(data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['journalEntries'] });
            toast({
                title: "Success",
                description: `Journal entry ${item ? 'updated' : 'created'} successfully`,
            });
            onClose();
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        saveMutation.mutate(formData);
    };

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {item ? 'Edit Journal Entry' : 'New Journal Entry'}
                    </DialogTitle>
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="grid grid-cols-2 w-96">
                        <TabsTrigger value="details">Entry Details</TabsTrigger>
                        <TabsTrigger value="documents">
                            <Paperclip className="w-4 h-4 mr-2" />
                            Documents
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="details">
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <Label>JE Number *</Label>
                                    <Input
                                        value={formData.je_number}
                                        onChange={(e) => handleChange('je_number', e.target.value)}
                                        required
                                    />
                                </div>
                                <div>
                                    <Label>Date *</Label>
                                    <Input
                                        type="date"
                                        value={formData.je_date}
                                        onChange={(e) => handleChange('je_date', e.target.value)}
                                        required
                                    />
                                </div>
                                <div>
                                    <Label>Type</Label>
                                    <Select value={formData.je_type} onValueChange={(val) => handleChange('je_type', val)}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="general">General</SelectItem>
                                            <SelectItem value="adjustment">Adjustment</SelectItem>
                                            <SelectItem value="accrual">Accrual</SelectItem>
                                            <SelectItem value="reversal">Reversal</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div>
                                <Label>Description *</Label>
                                <Textarea
                                    value={formData.description}
                                    onChange={(e) => handleChange('description', e.target.value)}
                                    required
                                    rows={2}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Debit Account *</Label>
                                    <Select 
                                        value={formData.debit_account_code} 
                                        onValueChange={(val) => handleAccountSelect('debit', val)}
                                        required
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select debit account" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {accounts.map(acc => (
                                                <SelectItem key={acc.id} value={acc.account_code}>
                                                    {acc.account_code} - {acc.account_name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label>Credit Account *</Label>
                                    <Select 
                                        value={formData.credit_account_code} 
                                        onValueChange={(val) => handleAccountSelect('credit', val)}
                                        required
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select credit account" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {accounts.map(acc => (
                                                <SelectItem key={acc.id} value={acc.account_code}>
                                                    {acc.account_code} - {acc.account_name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div>
                                <Label>Amount (SAR) *</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={formData.amount}
                                    onChange={(e) => handleChange('amount', parseFloat(e.target.value) || 0)}
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Reference</Label>
                                    <Input
                                        value={formData.reference}
                                        onChange={(e) => handleChange('reference', e.target.value)}
                                        placeholder="Document reference"
                                    />
                                </div>
                                <div>
                                    <Label>Cost Center</Label>
                                    <Input
                                        value={formData.cost_center}
                                        onChange={(e) => handleChange('cost_center', e.target.value)}
                                    />
                                </div>
                            </div>

                            <div>
                                <Label>Notes</Label>
                                <Textarea
                                    value={formData.notes}
                                    onChange={(e) => handleChange('notes', e.target.value)}
                                    rows={3}
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t">
                                <Button type="button" variant="outline" onClick={onClose}>
                                    Cancel
                                </Button>
                                <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                                    {item ? 'Update' : 'Create'} Journal Entry
                                </Button>
                            </div>
                        </form>
                    </TabsContent>

                    <TabsContent value="documents">
                        {item ? (
                            <DocumentList
                                relatedEntity="journal_entry"
                                relatedEntityId={item.id}
                                relatedDocumentNumber={item.je_number}
                            />
                        ) : (
                            <div className="text-center py-8 text-gray-500">
                                <Paperclip className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                                <p>Save the journal entry first to upload documents</p>
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}