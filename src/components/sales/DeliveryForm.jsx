import React, { useState, useEffect } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight, Package, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { useUnsavedChangesWarning } from "@/hooks/useUnsavedChangesWarning";
import { useOrganization } from "../utils/OrganizationContext";
import { processGoodsIssue } from "../utils/inventoryIntegration";
import { getNextDocumentNumber } from "../utils/documentNumberGenerator";
import { createNotification } from "../utils/notificationService";
import { logAuditTrail } from "../utils/auditTrail";
import { postJournalEntry } from "../utils/journalService";
import { useGLAccounts } from "../../hooks/useGLAccounts";

export default function DeliveryForm({ item, onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [isDirty, setIsDirty] = useState(false);
    const { guardedOpenChange, guardedClose } = useUnsavedChangesWarning(isDirty);
    const { currentOrganization: currentOrg } = useOrganization();
    const gl = useGLAccounts();

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

    const { data: salesOrders = [] } = useQuery({
        queryKey: ['sales'],
        queryFn: () => matrixSales.entities.SalesOrder.list('-order_date'),
        initialData: []
    });

    const { data: products = [] } = useQuery({
        queryKey: ['products'],
        queryFn: () => matrixSales.entities.Product.list(),
        initialData: []
    });

    const [formData, setFormData] = useState({
        delivery_number: '',
        sales_order_number: '',
        customer_name: '',
        delivery_date: new Date().toISOString().split('T')[0],
        product_code: '',
        product_name: '',
        quantity_ordered: 0,
        quantity_delivered: 0,
        delivery_address: '',
        receiver_name: '',
        receiver_signature: '',
        vehicle_number: '',
        driver_name: '',
        status: 'pending',
        pgi_done: false,
        pgi_date: '',
        pgi_by: '', // Added for audit trail
        notes: ''
    });

    useEffect(() => {
        if (item) {
            setFormData(item);
        }
    }, [item]);

    const handleSalesOrderSelect = (orderNumber) => {
        const selectedOrder = salesOrders.find(o => o.order_number === orderNumber);
        if (selectedOrder) {
            setFormData(prev => ({
                ...prev,
                sales_order_number: orderNumber,
                customer_name: selectedOrder.customer_name,
                product_code: selectedOrder.product_code,
                product_name: selectedOrder.product_name,
                quantity_ordered: selectedOrder.quantity,
                quantity_delivered: selectedOrder.quantity,
                delivery_address: selectedOrder.delivery_address || '',
                notes: `Delivery for Sales Order: ${orderNumber}`
            }));
        }
    };

    const saveMutation = useMutation({
        mutationFn: async (data) => {
            let delivery;
            const beforeData = item ? { ...item } : null;
            
            if (item) {
                delivery = await matrixSales.entities.Delivery.update(item.id, data);
                
                // Log audit trail
                await logAuditTrail({
                    entityType: 'delivery',
                    entityId: item.id,
                    documentNumber: data.delivery_number,
                    actionType: 'update',
                    beforeData: beforeData,
                    afterData: data,
                    user: currentUser,
                    severity: 'info',
                    organizationId: currentOrg?.id // Pass organization ID if available
                });
            } else {
                delivery = await matrixSales.entities.Delivery.create(data);
                
                // Log audit trail
                await logAuditTrail({
                    entityType: 'delivery',
                    entityId: delivery.id,
                    documentNumber: data.delivery_number,
                    actionType: 'create',
                    afterData: data,
                    user: currentUser,
                    severity: 'info',
                    relatedDocumentType: 'sales_order',
                    relatedDocumentId: data.sales_order_number,
                    organizationId: currentOrg?.id // Pass organization ID if available
                });
            }
            return delivery;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['deliveries'] });
            queryClient.invalidateQueries({ queryKey: ['auditTrails'] });
            toast({
                title: "Success",
                description: item ? "Delivery updated" : "Delivery created",
                variant: "default"
            });
            onClose();
        },
        onError: (error) => {
            toast({
                title: "Error",
                description: `Failed to ${item ? 'update' : 'create'} delivery: ${error.message || 'Unknown error'}`,
                variant: "destructive"
            });
        }
    });

    const pgiMutation = useMutation({
        mutationFn: async (deliveryData) => { // Changed to accept full deliveryData object
            // Process goods issue (updates product stock)
            await processGoodsIssue(deliveryData, currentUser, currentOrg?.id); // Pass organization ID

            // Update delivery record
            const updatedDelivery = await matrixSales.entities.Delivery.update(deliveryData.id, {
                ...deliveryData, // Ensure all fields are passed
                pgi_done: true,
                pgi_date: new Date().toISOString().split('T')[0],
                pgi_by: currentUser?.email,
                status: 'pgi_completed'
            });

            // Find and update sales order quantity delivered and status
            const salesOrdersResult = await matrixSales.entities.SalesOrder.filter({
                order_number: deliveryData.sales_order_number
            });
            
            if (salesOrdersResult && salesOrdersResult.length > 0) {
                const salesOrder = salesOrdersResult[0];
                const newQuantityDelivered = (salesOrder.quantity_delivered || 0) + deliveryData.quantity_delivered;
                let newSalesOrderStatus = salesOrder.status;

                if (newQuantityDelivered >= salesOrder.quantity) {
                    newSalesOrderStatus = 'delivered';
                } else if (newQuantityDelivered > 0 && newQuantityDelivered < salesOrder.quantity) {
                    newSalesOrderStatus = 'partially_delivered';
                }

                await matrixSales.entities.SalesOrder.update(salesOrder.id, {
                    quantity_delivered: newQuantityDelivered,
                    status: newSalesOrderStatus
                });
            }

            // COGS recognition: DR COGS / CR Inventory
            if (currentOrg?.id) {
                const stockLevels = await matrixSales.entities.StockLevel.filter({
                    material_code: deliveryData.product_code
                });
                const unitCost = parseFloat(stockLevels?.[0]?.unit_cost || 0);
                const cogsAmount = unitCost * (deliveryData.quantity_delivered || 0);

                if (cogsAmount > 0) {
                    await postJournalEntry({
                        lines: [
                            {
                                account_code: gl.cogs_general,
                                account_name: "Cost of Goods Sold",
                                debit: cogsAmount, credit: 0,
                                description: `${deliveryData.product_name} × ${deliveryData.quantity_delivered}`
                            },
                            {
                                account_code: gl.inventory,
                                account_name: "Inventory",
                                debit: 0, credit: cogsAmount,
                                description: `Goods issue: ${deliveryData.delivery_number}`
                            }
                        ],
                        referenceType: 'delivery',
                        referenceId: deliveryData.delivery_number,
                        description: `Goods issue: ${deliveryData.delivery_number} – ${deliveryData.customer_name}`,
                        entryDate: deliveryData.delivery_date,
                        entryType: 'goods_issue',
                        createdBy: currentUser?.email || '',
                        orgId: currentOrg.id
                    });
                }
            }

            // Log audit trail
            await logAuditTrail({
                entityType: 'delivery',
                entityId: deliveryData.id,
                documentNumber: deliveryData.delivery_number,
                actionType: 'complete_pgi',
                afterData: { pgi_done: true, status: 'pgi_completed', pgi_by: currentUser?.email },
                user: currentUser,
                severity: 'info',
                organizationId: currentOrg?.id // Pass organization ID if available
            });

            // Auto-create Invoice draft after PGI (non-fatal)
            try {
                const invoiceNumber = await getNextDocumentNumber('invoice');
                const today = new Date().toISOString().slice(0, 10);
                const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
                const linkedSO = salesOrdersResult?.[0];
                const unitPrice = (deliveryData.quantity_delivered || 0) > 0
                    ? (parseFloat(linkedSO?.total_amount) || 0) / deliveryData.quantity_delivered
                    : 0;
                const subtotal = unitPrice * (deliveryData.quantity_delivered || 0);
                await matrixSales.entities.Invoice.create({
                    invoice_number:       invoiceNumber,
                    invoice_date:         today,
                    due_date:             dueDate,
                    sales_order_number:   deliveryData.sales_order_number,
                    delivery_number:      deliveryData.delivery_number,
                    delivery_references:  [{
                        delivery_number:    deliveryData.delivery_number,
                        delivery_date:      deliveryData.delivery_date,
                        delivered_quantity: deliveryData.quantity_delivered,
                        product_code:       deliveryData.product_code,
                    }],
                    customer_name:    deliveryData.customer_name,
                    customer_code:    linkedSO?.customer_code || '',
                    product_code:     deliveryData.product_code,
                    product_name:     deliveryData.product_name,
                    quantity:         deliveryData.quantity_delivered,
                    unit_price:       unitPrice,
                    subtotal:         subtotal,
                    tax_type:         'vat',
                    tax_percent:      0,
                    tax_amount:       0,
                    total_amount:     subtotal,
                    payment_terms:    linkedSO?.payment_terms || 'net_30',
                    payment_status:   'unpaid',
                    status:           'draft',
                    notes:            `Auto-created from Delivery ${deliveryData.delivery_number}`,
                });
                toast({ title: "Invoice Draft Created", description: `${invoiceNumber} created in Sales` });
                if (currentUser?.email) {
                    createNotification({ userEmail: currentUser.email, notificationType: 'invoice_auto_created', priority: 'high', title: 'Invoice Draft Auto-Created', message: `${invoiceNumber} was created from Delivery ${deliveryData.delivery_number}`, relatedEntity: 'Invoice', relatedDocumentNumber: invoiceNumber, actionUrl: '/Sales' }).catch(() => {});
                }
            } catch (_) { /* non-fatal */ }

            return updatedDelivery;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['deliveries'] });
            queryClient.invalidateQueries({ queryKey: ['products'] });
            queryClient.invalidateQueries({ queryKey: ['stockLevels'] });
            queryClient.invalidateQueries({ queryKey: ['movements'] });
            queryClient.invalidateQueries({ queryKey: ['sales'] });
            queryClient.invalidateQueries({ queryKey: ['auditTrails'] });
            queryClient.invalidateQueries({ queryKey: ['journalEntries'] });
            queryClient.invalidateQueries({ queryKey: ['invoices'] });
            toast({
                title: "Success",
                description: "PGI posted successfully. Stock updated.",
                variant: "default"
            });
            onClose();
        },
        onError: (error) => {
            toast({
                title: "Error",
                description: `Failed to complete PGI: ${error.message || 'Unknown error'}. Please try again.`,
                variant: "destructive"
            });
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        saveMutation.mutate(formData);
    };

    const handlePGI = () => {
        if (!item || !item.id) {
            toast({
                title: "Error",
                description: "Please save the delivery first before posting goods issue.",
                variant: "destructive"
            });
            return;
        }

        if (formData.pgi_done) {
            toast({
                title: "Already Posted",
                description: "PGI has already been completed for this delivery.",
                variant: "destructive"
            });
            return;
        }

        if (!formData.product_code || formData.quantity_delivered <= 0) {
            toast({
                title: "Invalid Data",
                description: "Product code and a positive delivered quantity are required to post PGI.",
                variant: "destructive"
            });
            return;
        }

        if (window.confirm(`Are you sure you want to post goods issue for ${formData.quantity_delivered} units of ${formData.product_name}? This will deduct stock from inventory.`)) {
            pgiMutation.mutate(formData); // Pass the entire formData
        }
    };

    const handleChange = (field, value) => {
        if (!isDirty) setIsDirty(true);
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const confirmedOrders = salesOrders.filter(o => 
        o.status === 'confirmed' || o.status === 'in_production' || o.status === 'shipped' || o.status === 'partially_delivered'
    );

    return (
        <Dialog open={true} onOpenChange={guardedOpenChange(onClose)}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {item ? 'Edit Delivery' : 'New Delivery'}
                        {formData.sales_order_number && (
                            <Badge variant="outline" className="ml-2">
                                SO: {formData.sales_order_number}
                            </Badge>
                        )}
                        {formData.pgi_done && (
                            <Badge className="ml-2 bg-green-600">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                PGI Done
                            </Badge>
                        )}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Sales Order Reference Section */}
                    {!item && (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                            <Label className="text-emerald-900 font-semibold mb-2 block">
                                Select Sales Order *
                            </Label>
                            <Select 
                                value={formData.sales_order_number} 
                                onValueChange={handleSalesOrderSelect}
                                required
                            >
                                <SelectTrigger className="bg-white">
                                    <SelectValue placeholder="Select a sales order..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {confirmedOrders.map(o => (
                                        <SelectItem key={o.id} value={o.order_number}>
                                            {o.order_number} - {o.customer_name} - {o.product_name} ({o.quantity} units)
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {formData.sales_order_number && (
                                <p className="text-sm text-emerald-700 mt-2 flex items-center gap-2">
                                    <ArrowRight className="w-4 h-4" />
                                    Data auto-filled from sales order
                                </p>
                            )}
                        </div>
                    )}

                    {/* Delivery Information */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Delivery Information</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Delivery Number *</Label>
                                <Input
                                    value={formData.delivery_number}
                                    onChange={(e) => handleChange('delivery_number', e.target.value)}
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

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Customer Name *</Label>
                                <Input
                                    value={formData.customer_name}
                                    onChange={(e) => handleChange('customer_name', e.target.value)}
                                    required
                                    disabled={!!formData.sales_order_number}
                                />
                            </div>
                            <div>
                                <Label>Status</Label>
                                <Select 
                                    value={formData.status} 
                                    onValueChange={(val) => handleChange('status', val)}
                                    disabled={formData.pgi_done} // Disable status change if PGI is done
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="pending">Pending</SelectItem>
                                        <SelectItem value="in_transit">In Transit</SelectItem>
                                        <SelectItem value="delivered">Delivered</SelectItem>
                                        <SelectItem value="partially_delivered">Partially Delivered</SelectItem>
                                        <SelectItem value="cancelled">Cancelled</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    {/* Product & Quantity */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Product & Quantity</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Product Code *</Label>
                                <Input
                                    value={formData.product_code}
                                    onChange={(e) => handleChange('product_code', e.target.value)}
                                    required
                                    disabled={!!formData.sales_order_number || formData.pgi_done}
                                />
                            </div>
                            <div>
                                <Label>Product Name *</Label>
                                <Input
                                    value={formData.product_name}
                                    onChange={(e) => handleChange('product_name', e.target.value)}
                                    required
                                    disabled={!!formData.sales_order_number || formData.pgi_done}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Quantity Ordered</Label>
                                <Input
                                    type="number"
                                    value={formData.quantity_ordered}
                                    onChange={(e) => handleChange('quantity_ordered', parseFloat(e.target.value))}
                                    disabled={!!formData.sales_order_number || formData.pgi_done}
                                />
                            </div>
                            <div>
                                <Label>Quantity Delivered *</Label>
                                <Input
                                    type="number"
                                    value={formData.quantity_delivered}
                                    onChange={(e) => handleChange('quantity_delivered', parseFloat(e.target.value))}
                                    required
                                    disabled={formData.pgi_done} // Disable if PGI is done
                                />
                            </div>
                        </div>

                        {formData.pgi_done && (
                            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                                <p className="text-sm text-green-800 font-semibold flex items-center gap-2">
                                    <CheckCircle className="w-4 h-4" />
                                    PGI Posted on {formData.pgi_date} by {formData.pgi_by || 'Unknown'} - Stock deducted from inventory
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Delivery Details */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Delivery Details</h3>
                        <div>
                            <Label>Delivery Address</Label>
                            <Textarea
                                value={formData.delivery_address}
                                onChange={(e) => handleChange('delivery_address', e.target.value)}
                                rows={2}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Receiver Name</Label>
                                <Input
                                    value={formData.receiver_name}
                                    onChange={(e) => handleChange('receiver_name', e.target.value)}
                                />
                            </div>
                            <div>
                                <Label>Receiver Signature</Label>
                                <Input
                                    value={formData.receiver_signature}
                                    onChange={(e) => handleChange('receiver_signature', e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Vehicle Number</Label>
                                <Input
                                    value={formData.vehicle_number}
                                    onChange={(e) => handleChange('vehicle_number', e.target.value)}
                                />
                            </div>
                            <div>
                                <Label>Driver Name</Label>
                                <Input
                                    value={formData.driver_name}
                                    onChange={(e) => handleChange('driver_name', e.target.value)}
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
                    </div>

                    <div className="flex justify-between items-center pt-4 border-t">
                        <div>
                            {item && !formData.pgi_done && (
                                <Button 
                                    type="button" 
                                    onClick={handlePGI}
                                    className="bg-blue-600 hover:bg-blue-700"
                                    disabled={pgiMutation.isPending || saveMutation.isPending} // Disable if saving or PGI is pending
                                >
                                    <Package className="w-4 h-4 mr-2" />
                                    {pgiMutation.isPending ? 'Processing...' : 'Post Goods Issue (PGI)'}
                                </Button>
                            )}
                        </div>
                        <div className="flex gap-3">
                            <Button type="button" variant="outline" onClick={guardedClose(onClose)} disabled={saveMutation.isPending || pgiMutation.isPending}>
                                Cancel
                            </Button>
                            <Button 
                                type="submit" 
                                className="bg-emerald-600 hover:bg-emerald-700"
                                disabled={saveMutation.isPending || pgiMutation.isPending || formData.pgi_done} // Disable save if PGI is done or mutations pending
                            >
                                {saveMutation.isPending ? 'Saving...' : (item ? 'Update' : 'Create') + ' Delivery'}
                            </Button>
                        </div>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}