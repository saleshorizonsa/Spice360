import React, { useState, useEffect } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RefreshCw } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { getNextDocumentNumber } from "../utils/documentNumberGenerator";
import { createNotification } from "../utils/notificationService";
import SearchableSelect from "../shared/SearchableSelect";
import LineItemsTable from "../shared/LineItemsTable";
import { useOrganization } from "../utils/OrganizationContext";
import { useTaxConfig } from "@/hooks/useTaxConfig";

export default function QuotationForm({ item, onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { currentOrg } = useOrganization();
    const taxConfig = useTaxConfig();
    const [isGeneratingNumber, setIsGeneratingNumber] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    useEffect(() => {
        matrixSales.auth.me().then(u => setCurrentUser(u)).catch(() => {});
    }, []);

    const { data: materials = [] } = useQuery({
        queryKey: ['materials', currentOrg?.id],
        queryFn: () => matrixSales.entities.Material.list(),
        initialData: []
    });

    const { data: customers = [] } = useQuery({
        queryKey: ['customers', currentOrg?.id],
        queryFn: () => matrixSales.entities.Customer.list(),
        initialData: []
    });

    const [formData, setFormData] = useState({
        quotation_number: '',
        organization_id: currentOrg?.id || '',
        customer_code: '',
        customer_name: '',
        customer_contact: '',
        customer_email: '',
        customer_phone: '',
        quotation_date: new Date().toISOString().split('T')[0],
        valid_until: '',
        payment_terms: 'net_30',
        delivery_terms: '',
        status: 'draft',
        notes: ''
    });

    const [lineItems, setLineItems] = useState([]);

    const generateQuotationNumber = async () => {
        setIsGeneratingNumber(true);
        try {
            const number = await getNextDocumentNumber('quotation');
            setFormData(prev => ({ ...prev, quotation_number: number }));
        } catch (error) {
            console.error("Error generating quotation number:", error);
            toast({
                title: "Warning",
                description: "Could not auto-generate quotation number. Please enter manually.",
                variant: "destructive"
            });
        } finally {
            setIsGeneratingNumber(false);
        }
    };

    useEffect(() => {
        if (item) {
            setFormData({
                ...item,
                organization_id: item.organization_id || currentOrg?.id
            });
            // Load existing line items
            const loadLineItems = async () => {
                const lines = await matrixSales.entities.QuotationLine.filter({ quotation_number: item.quotation_number });
                setLineItems(lines);
            };
            loadLineItems();
        } else {
            setFormData(prev => ({ ...prev, organization_id: currentOrg?.id }));
            generateQuotationNumber();
        }
    }, [item, currentOrg]);

    const handleCustomerSelect = (customerCode) => {
        const customer = customers.find(c => c.customer_code === customerCode);
        if (customer) {
            setFormData(prev => ({
                ...prev,
                customer_code: customerCode,
                customer_name: customer.customer_name,
                customer_contact: customer.contact_person,
                customer_email: customer.email,
                customer_phone: customer.phone,
                payment_terms: customer.payment_terms || 'net_30'
            }));
        }
    };

    const saveMutation = useMutation({
        mutationFn: async (data) => {
            const prevStatus = item?.status;
            let quotation;
            if (item) {
                quotation = await matrixSales.entities.Quotation.update(item.id, data);
            } else {
                quotation = await matrixSales.entities.Quotation.create(data);
            }

            // Delete existing line items if editing
            if (item) {
                const existingLines = await matrixSales.entities.QuotationLine.filter({ quotation_number: item.quotation_number });
                await Promise.all(existingLines.map(line => matrixSales.entities.QuotationLine.delete(line.id)));
            }

            // Create new line items
            const linesWithOrgId = lineItems.map(line => ({
                ...line,
                organization_id: currentOrg?.id,
                quotation_number: data.quotation_number
            }));
            await matrixSales.entities.QuotationLine.bulkCreate(linesWithOrgId);

            // Auto-create Sales Order when quotation is accepted (non-fatal)
            const isAccepted = prevStatus !== 'accepted' && data.status === 'accepted';
            if (isAccepted && lineItems.length > 0) {
                try {
                    const soNumber = await getNextDocumentNumber('sales_order');
                    const so = await matrixSales.entities.SalesOrder.create({
                        order_number:        soNumber,
                        organization_id:     data.organization_id,
                        quotation_reference: data.quotation_number,
                        customer_code:       data.customer_code || '',
                        customer_name:       data.customer_name,
                        customer_contact:    data.customer_contact || '',
                        customer_email:      data.customer_email || '',
                        customer_phone:      data.customer_phone || '',
                        order_date:          new Date().toISOString().slice(0, 10),
                        delivery_date:       data.valid_until || '',
                        payment_terms:       data.payment_terms || 'net_30',
                        total_amount:        data.total_amount || 0,
                        status:              'pending',
                        notes:               `Auto-created from Quotation ${data.quotation_number}`,
                    });
                    const soLines = lineItems.map(line => ({
                        ...line,
                        organization_id: currentOrg?.id,
                        order_number:    soNumber,
                        sales_order_id:  so.id,
                    }));
                    await matrixSales.entities.SalesOrderLine.bulkCreate(soLines);
                    toast({ title: "Sales Order Created", description: `${soNumber} created as draft in Sales` });
                    if (currentUser?.email) {
                        createNotification({ userEmail: currentUser.email, notificationType: 'sales_order_auto_created', priority: 'high', title: 'Sales Order Auto-Created', message: `${soNumber} was created from accepted Quotation ${data.quotation_number}`, relatedEntity: 'SalesOrder', relatedDocumentNumber: soNumber, actionUrl: '/Sales' }).catch(() => {});
                    }
                } catch (_) { /* non-fatal */ }
            }

            return quotation;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['quotations'] });
            queryClient.invalidateQueries({ queryKey: ['salesOrders'] });
            toast({
                title: "Success",
                description: `Quotation ${item ? 'updated' : 'created'} successfully`,
                variant: "default"
            });
            onClose();
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        
        if (lineItems.length === 0) {
            toast({
                title: "Error",
                description: "Please add at least one line item",
                variant: "destructive"
            });
            return;
        }

        // Calculate totals from line items
        const subtotal = lineItems.reduce((sum, line) => sum + (line.line_total || 0), 0);
        const vatAmount = subtotal * (taxConfig.vat_standard_rate / 100);
        const totalAmount = subtotal + vatAmount;

        saveMutation.mutate({
            ...formData,
            subtotal,
            vat_amount: vatAmount,
            total_amount: totalAmount
        });
    };

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const customerOptions = customers.map(c => ({
        value: c.customer_code,
        label: `${c.customer_code} - ${c.customer_name}`
    }));

    // Calculate totals
    const subtotal = lineItems.reduce((sum, line) => sum + (line.line_total || 0), 0);
    const vatAmount = subtotal * (taxConfig.vat_standard_rate / 100);
    const totalAmount = subtotal + vatAmount;

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {item ? 'Edit Quotation' : 'New Quotation'}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Header Information */}
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <Label>Quotation Number *</Label>
                            <div className="flex gap-2">
                                <Input
                                    value={formData.quotation_number}
                                    onChange={(e) => handleChange('quotation_number', e.target.value)}
                                    required
                                    disabled={isGeneratingNumber}
                                    placeholder="QT-2025-0001"
                                />
                                {!item && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        onClick={generateQuotationNumber}
                                        disabled={isGeneratingNumber}
                                    >
                                        <RefreshCw className={`w-4 h-4 ${isGeneratingNumber ? 'animate-spin' : ''}`} />
                                    </Button>
                                )}
                            </div>
                        </div>
                        <div>
                            <Label>Quotation Date *</Label>
                            <Input
                                type="date"
                                value={formData.quotation_date}
                                onChange={(e) => handleChange('quotation_date', e.target.value)}
                                required
                            />
                        </div>
                        <div>
                            <Label>Valid Until *</Label>
                            <Input
                                type="date"
                                value={formData.valid_until}
                                onChange={(e) => handleChange('valid_until', e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    {/* Customer Information */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Customer Information</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <SearchableSelect
                                    label="Customer *"
                                    value={formData.customer_code}
                                    onValueChange={handleCustomerSelect}
                                    options={customerOptions}
                                    placeholder="Select customer..."
                                    searchPlaceholder="Search customers..."
                                />
                            </div>
                            <div>
                                <Label>Contact Person</Label>
                                <Input
                                    value={formData.customer_contact}
                                    onChange={(e) => handleChange('customer_contact', e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Email</Label>
                                <Input
                                    type="email"
                                    value={formData.customer_email}
                                    onChange={(e) => handleChange('customer_email', e.target.value)}
                                />
                            </div>
                            <div>
                                <Label>Phone</Label>
                                <Input
                                    value={formData.customer_phone}
                                    onChange={(e) => handleChange('customer_phone', e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Line Items */}
                    <LineItemsTable
                        lineItems={lineItems}
                        onLineItemsChange={setLineItems}
                        availableItems={materials}
                        itemType="sales_item"
                    />

                    {/* Totals */}
                    <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                        <div className="flex justify-between">
                            <span>Subtotal:</span>
                            <span className="font-semibold">LKR {subtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>VAT (15%):</span>
                            <span className="font-semibold">LKR {vatAmount.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-lg font-bold border-t pt-2">
                            <span>Total Amount:</span>
                            <span className="text-emerald-600">LKR {totalAmount.toFixed(2)}</span>
                        </div>
                    </div>

                    {/* Terms */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Payment Terms</Label>
                            <Select value={formData.payment_terms} onValueChange={(val) => handleChange('payment_terms', val)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="net_30">Net 30</SelectItem>
                                    <SelectItem value="net_45">Net 45</SelectItem>
                                    <SelectItem value="net_60">Net 60</SelectItem>
                                    <SelectItem value="cod">COD</SelectItem>
                                    <SelectItem value="advance">Advance</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Status</Label>
                            <Select value={formData.status} onValueChange={(val) => handleChange('status', val)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="draft">Draft</SelectItem>
                                    <SelectItem value="sent">Sent</SelectItem>
                                    <SelectItem value="accepted">Accepted</SelectItem>
                                    <SelectItem value="rejected">Rejected</SelectItem>
                                    <SelectItem value="expired">Expired</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div>
                        <Label>Delivery Terms</Label>
                        <Textarea
                            value={formData.delivery_terms}
                            onChange={(e) => handleChange('delivery_terms', e.target.value)}
                            rows={2}
                        />
                    </div>

                    <div>
                        <Label>Notes</Label>
                        <Textarea
                            value={formData.notes}
                            onChange={(e) => handleChange('notes', e.target.value)}
                            rows={3}
                        />
                    </div>

                    <div className="flex justify-end gap-3">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                            {item ? 'Update' : 'Create'} Quotation
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
