
import React, { useState, useEffect } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight, RefreshCw, Tag, CheckCircle2 } from "lucide-react";
import { getNextDocumentNumber } from "../utils/documentNumberGenerator";
import { useToast } from "@/components/ui/use-toast";
import { useOrganization } from "../utils/OrganizationContext";
import LineItemsTable from "../shared/LineItemsTable";
import SearchableSelect from "../shared/SearchableSelect";
import { createApprovalRequest, needsApproval } from "../utils/approvalWorkflow";
import { logAuditTrail } from "../utils/auditTrail";
import { useUnsavedChangesWarning } from "@/hooks/useUnsavedChangesWarning";

export default function SalesOrderForm({ order, onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { currentOrg } = useOrganization();
    const [isDirty, setIsDirty] = useState(false);
    const guardedOpenChange = useUnsavedChangesWarning(isDirty);
    const [isGeneratingNumber, setIsGeneratingNumber] = useState(false);

    // Get current user
    const [currentUser, setCurrentUser] = useState(null);
    
    useEffect(() => {
        const fetchUser = async () => {
            try {
                const user = await matrixSales.auth.me();
                setCurrentUser(user);
            } catch (error) {
                console.error('Error fetching user:', error);
            }
        };
        fetchUser();
    }, []);

    const { data: quotations = [] } = useQuery({
        queryKey: ['quotations', currentOrg?.id],
        queryFn: () => matrixSales.entities.Quotation.list('-quotation_date'),
        initialData: []
    });

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

    const { data: allContractPrices = [] } = useQuery({
        queryKey: ['contractPrices'],
        queryFn: () => matrixSales.entities.ContractPrice.list(),
        initialData: []
    });

    const [lineItems, setLineItems] = useState([]);

    const [formData, setFormData] = useState({
        order_number: '',
        organization_id: currentOrg?.id || '',
        quotation_reference: '',
        customer_code: '',
        customer_name: '',
        customer_contact: '',
        customer_email: '',
        customer_phone: '',
        order_date: new Date().toISOString().split('T')[0],
        delivery_date: '',
        status: 'pending',
        total_amount: 0,
        payment_terms: 'net_30',
        delivery_address: '',
        notes: ''
    });

    useEffect(() => {
        const newTotal = lineItems.reduce((sum, lineItem) => sum + (lineItem.line_total || 0), 0);
        setFormData(prev => ({ ...prev, total_amount: newTotal }));
    }, [lineItems]);

    useEffect(() => {
        if (order) {
            setFormData({
                ...order,
                organization_id: order.organization_id || currentOrg?.id
            });
            const loadLineItems = async () => {
                const lines = await matrixSales.entities.SalesOrderLine.filter({ order_number: order.order_number });
                setLineItems(lines);
            };
            loadLineItems();
        } else {
            setFormData(prev => ({ ...prev, organization_id: currentOrg?.id }));
            generateOrderNumber();
        }
    }, [order, currentOrg]);

    const generateOrderNumber = async () => {
        setIsGeneratingNumber(true);
        try {
            const number = await getNextDocumentNumber('sales_order');
            setFormData(prev => ({ ...prev, order_number: number }));
        } catch (error) {
            console.error("Error generating order number:", error);
            toast({
                title: "Warning",
                description: "Could not auto-generate order number. Please enter manually.",
                variant: "destructive"
            });
        } finally {
            setIsGeneratingNumber(false);
        }
    };

    const handleQuotationSelect = (quotationNumber) => {
        const selectedQuotation = quotations.find(q => q.quotation_number === quotationNumber);
        if (selectedQuotation) {
            setFormData(prev => ({
                ...prev,
                quotation_reference: quotationNumber,
                customer_code: selectedQuotation.customer_code || '',
                customer_name: selectedQuotation.customer_name,
                customer_contact: selectedQuotation.contact_person || '',
                customer_email: selectedQuotation.customer_email || '',
                customer_phone: selectedQuotation.customer_phone || '',
                payment_terms: selectedQuotation.payment_terms || 'net_30',
                notes: `Created from Quotation: ${quotationNumber}`
            }));
            
            // Load quotation line items
            const loadQuotationLines = async () => {
                const quotLines = await matrixSales.entities.QuotationLine.filter({ quotation_number: quotationNumber });
                const mappedLines = quotLines.map((line, index) => ({
                    line_number: index + 1,
                    product_code: line.product_code,
                    product_name: line.product_name,
                    description: line.description || '',
                    quantity: line.quantity,
                    unit_of_measure: line.unit_of_measure,
                    unit_price: line.unit_price,
                    discount_percent: line.discount_percent || 0,
                    discount_amount: line.discount_amount || 0,
                    line_total: line.line_total
                }));
                setLineItems(mappedLines);
            };
            loadQuotationLines();
        }
    };

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
                delivery_address: customer.address || '',
                payment_terms: customer.payment_terms || 'net_30'
            }));
        }
    };

    const activeContractPrices = (() => {
        if (!formData.customer_code) return [];
        const today = new Date().toISOString().split('T')[0];
        return allContractPrices.filter(cp =>
            cp.customer_code === formData.customer_code &&
            cp.status === 'active' &&
            cp.valid_from <= today &&
            (!cp.valid_to || cp.valid_to >= today)
        );
    })();

    const applyContractPrices = () => {
        if (!activeContractPrices.length) return;
        const priceMap = {};
        activeContractPrices.forEach(cp => { priceMap[cp.material_code] = cp; });

        const updated = lineItems.map(line => {
            const cp = priceMap[line.product_code];
            if (!cp) return line;
            const qty = parseFloat(line.quantity) || 0;
            const price = parseFloat(cp.price_per_unit) || 0;
            const discountPct = parseFloat(line.discount_percent) || 0;
            const subtotal = qty * price;
            const discountAmt = subtotal * (discountPct / 100);
            return {
                ...line,
                unit_price: price,
                discount_amount: discountAmt,
                line_total: subtotal - discountAmt,
                _contract_price: true
            };
        });

        setLineItems(updated);
        if (!isDirty) setIsDirty(true);
        toast({ title: "Contract Prices Applied", description: `${activeContractPrices.length} price(s) applied to matching lines.` });
    };

    const saveMutation = useMutation({
        mutationFn: async (data) => {
            let salesOrder;
            const beforeData = order ? { ...order } : null;
            
            if (order) {
                salesOrder = await matrixSales.entities.SalesOrder.update(order.id, data);
                
                // Log audit trail for update
                await logAuditTrail({
                    entityType: 'sales_order',
                    entityId: order.id,
                    documentNumber: data.order_number,
                    actionType: 'update',
                    beforeData: beforeData,
                    afterData: data,
                    user: currentUser,
                    severity: data.total_amount > 100000 ? 'warning' : 'info'
                });
            } else {
                salesOrder = await matrixSales.entities.SalesOrder.create(data);
                
                // Log audit trail for creation
                await logAuditTrail({
                    entityType: 'sales_order',
                    entityId: salesOrder.id,
                    documentNumber: data.order_number,
                    actionType: 'create',
                    afterData: data,
                    user: currentUser,
                    severity: data.total_amount > 100000 ? 'warning' : 'info'
                });
                
                // Check if approval is needed
                const requiresApproval = await needsApproval(
                    'sales_order',
                    data.total_amount,
                    currentOrg?.organization_code,
                    currentUser?.department
                );

                if (requiresApproval) {
                    const firstLineProduct = lineItems.length > 0 ? lineItems[0].product_name : 'various items';
                    const firstLineQuantity = lineItems.length > 0 ? lineItems[0].quantity : '';

                    // Create approval request
                    const approvalRequest = await createApprovalRequest({
                        documentType: 'sales_order',
                        documentNumber: data.order_number,
                        documentId: salesOrder.id,
                        amount: data.total_amount,
                        requestedBy: currentUser?.email,
                        requestedByName: currentUser?.full_name,
                        requestedByRole: currentUser?.approval_role || 'none',
                        branch: currentOrg?.organization_code,
                        department: currentUser?.department,
                        summary: `Sales Order for ${data.customer_name} - ${firstLineProduct} (${firstLineQuantity} units)`
                    });

                    // Update order status to pending_approval
                    salesOrder = await matrixSales.entities.SalesOrder.update(salesOrder.id, {
                        status: 'pending_approval'
                    });
                    
                    // Log approval submission
                    await logAuditTrail({
                        entityType: 'sales_order',
                        entityId: salesOrder.id,
                        documentNumber: data.order_number,
                        actionType: 'submit',
                        afterData: { status: 'pending_approval' },
                        user: currentUser,
                        severity: 'info',
                        relatedDocumentType: 'approval_request',
                        relatedDocumentId: approvalRequest?.id
                    });
                }
            }

            // Delete existing line items if editing
            if (order) {
                const existingLines = await matrixSales.entities.SalesOrderLine.filter({ order_number: order.order_number });
                await Promise.all(existingLines.map(line => matrixSales.entities.SalesOrderLine.delete(line.id)));
            }

            // Create new line items
            const linesWithOrgId = lineItems.map(line => ({
                ...line,
                organization_id: currentOrg?.id,
                order_number: data.order_number,
                sales_order_id: salesOrder.id
            }));
            await matrixSales.entities.SalesOrderLine.bulkCreate(linesWithOrgId);

            return salesOrder;
        },
        onSuccess: (savedOrder) => {
            queryClient.invalidateQueries({ queryKey: ['salesOrders'] });
            queryClient.invalidateQueries({ queryKey: ['sales'] }); // Added as per outline instruction
            queryClient.invalidateQueries({ queryKey: ['sales-order-lines'] });
            queryClient.invalidateQueries({ queryKey: ['approvalRequests'] });
            queryClient.invalidateQueries({ queryKey: ['auditTrails'] });
            
            let descriptionMessage = order ? "Sales order updated successfully" : "Sales order created successfully";
            if (!order && savedOrder.status === 'pending_approval') {
                descriptionMessage = "Sales order created and submitted for approval.";
            }

            toast({
                title: "Success",
                description: descriptionMessage,
                variant: "default"
            });
            onClose();
        },
        onError: (error) => {
            console.error("Sales Order save error:", error);
            toast({
                title: "Error",
                description: error.message || "Failed to save sales order. Please try again.",
                variant: "destructive"
            });
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

        saveMutation.mutate(formData);
    };

    const handleChange = (field, value) => {
        if (!isDirty) setIsDirty(true);
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const acceptedQuotations = quotations.filter(q => q.status === 'accepted' || q.status === 'sent');
    
    const customerOptions = customers.map(c => ({
        value: c.customer_code,
        label: `${c.customer_code} - ${c.customer_name}`
    }));

    const quotationOptions = acceptedQuotations.map(q => ({
        value: q.quotation_number,
        label: `${q.quotation_number} - ${q.customer_name} - LKR ${q.total_amount?.toLocaleString() || '0'}`
    }));

    return (
        <Dialog open={true} onOpenChange={guardedOpenChange(onClose)}>
            <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {order ? 'Edit Sales Order' : 'New Sales Order'}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Document Reference Section */}
                    {!order && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <SearchableSelect
                                label="Create from Quotation (Optional)"
                                value={formData.quotation_reference}
                                onValueChange={handleQuotationSelect}
                                options={quotationOptions}
                                placeholder="Select a quotation to auto-fill data..."
                                searchPlaceholder="Search quotations..."
                            />
                            {formData.quotation_reference && (
                                <p className="text-sm text-blue-700 mt-2 flex items-center gap-2">
                                    <ArrowRight className="w-4 h-4" />
                                    Customer & Product data pre-filled from quotation
                                </p>
                            )}
                        </div>
                    )}

                    {/* Order Information */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Order Information</h3>
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <Label>Order Number *</Label>
                                <div className="flex gap-2">
                                    <Input
                                        value={formData.order_number}
                                        onChange={(e) => handleChange('order_number', e.target.value)}
                                        required
                                        disabled={isGeneratingNumber}
                                        placeholder="SO-2025-0001"
                                        className={!order ? "bg-gray-50" : ""}
                                    />
                                    {!order && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            onClick={generateOrderNumber}
                                            disabled={isGeneratingNumber}
                                        >
                                            <RefreshCw className={`w-4 h-4 ${isGeneratingNumber ? 'animate-spin' : ''}`} />
                                        </Button>
                                    )}
                                </div>
                            </div>
                            <div>
                                <Label>Status</Label>
                                <Select 
                                    value={formData.status} 
                                    onValueChange={(val) => handleChange('status', val)}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="pending">Pending</SelectItem>
                                        <SelectItem value="pending_approval">Pending Approval</SelectItem>
                                        <SelectItem value="confirmed">Confirmed</SelectItem>
                                        <SelectItem value="in_production">In Production</SelectItem>
                                        <SelectItem value="shipped">Shipped</SelectItem>
                                        <SelectItem value="delivered">Delivered</SelectItem>
                                        <SelectItem value="cancelled">Cancelled</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div></div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Order Date *</Label>
                                <Input
                                    type="date"
                                    value={formData.order_date}
                                    onChange={(e) => handleChange('order_date', e.target.value)}
                                    required
                                />
                            </div>
                            <div>
                                <Label>Delivery Date *</Label>
                                <Input
                                    type="date"
                                    value={formData.delivery_date}
                                    onChange={(e) => handleChange('delivery_date', e.target.value)}
                                    required
                                />
                            </div>
                        </div>
                    </div>

                    {/* Customer Information */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Customer Information</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <SearchableSelect
                                label="Customer *"
                                value={formData.customer_code}
                                onValueChange={handleCustomerSelect}
                                options={customerOptions}
                                placeholder="Select customer..."
                                searchPlaceholder="Search customers..."
                            />
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

                    {/* Contract Price Banner */}
                    {formData.customer_code && activeContractPrices.length > 0 && (
                        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 flex items-center justify-between">
                            <div className="flex items-center gap-2 text-indigo-800 text-sm">
                                <Tag className="w-4 h-4" />
                                <strong>{activeContractPrices.length} contract price{activeContractPrices.length !== 1 ? 's' : ''}</strong> active for this customer
                                <span className="text-indigo-600 text-xs">
                                    ({activeContractPrices.map(cp => cp.material_name || cp.material_code).join(', ')})
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={applyContractPrices}
                                className="flex items-center gap-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-md transition-colors"
                            >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Apply Contract Prices
                            </button>
                        </div>
                    )}

                    {/* Line Items */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Line Items</h3>
                        <LineItemsTable
                            lineItems={lineItems}
                            onLineItemsChange={setLineItems}
                            availableItems={materials}
                            itemType="sales_item"
                        />
                        <div className="bg-gray-50 p-4 rounded-lg flex justify-between items-center">
                            <Label className="text-lg">Total Amount</Label>
                            <div className="text-3xl font-bold text-emerald-600">
                                LKR {formData.total_amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                        </div>
                    </div>

                    {/* Terms & Additional Info */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Terms & Delivery</h3>
                        <div>
                            <Label>Payment Terms</Label>
                            <Select 
                                value={formData.payment_terms} 
                                onValueChange={(val) => handleChange('payment_terms', val)}
                            >
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
                            <Label>Delivery Address *</Label>
                            <Textarea
                                value={formData.delivery_address}
                                onChange={(e) => handleChange('delivery_address', e.target.value)}
                                required
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
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" disabled={saveMutation.isPending}>
                            {saveMutation.isPending ? 'Saving...' : (order ? 'Update' : 'Create')} Sales Order
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
