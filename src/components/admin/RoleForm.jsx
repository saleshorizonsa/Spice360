import React, { useState, useEffect } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, Save, X, ChevronDown, ChevronRight } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function RoleForm({ item, onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const [formData, setFormData] = useState({
        role_code: '',
        role_name: '',
        description: '',
        status: 'active',
        is_system_role: false,
        permissions: getDefaultPermissions()
    });

    const [expandedModules, setExpandedModules] = useState({});
    const [activeTab, setActiveTab] = useState('basic');

    useEffect(() => {
        if (item) {
            setFormData({
                role_code: item.role_code || '',
                role_name: item.role_name || '',
                description: item.description || '',
                status: item.status || 'active',
                is_system_role: item.is_system_role || false,
                permissions: item.permissions || getDefaultPermissions()
            });
        }
    }, [item]);

    const createMutation = useMutation({
        mutationFn: (data) => matrixSales.entities.Role.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['roles'] });
            toast({ title: "Success", description: "Role created successfully" });
            onClose();
        }
    });

    const updateMutation = useMutation({
        mutationFn: (data) => matrixSales.entities.Role.update(item.id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['roles'] });
            toast({ title: "Success", description: "Role updated successfully" });
            onClose();
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (item) {
            updateMutation.mutate(formData);
        } else {
            createMutation.mutate(formData);
        }
    };

    const toggleModule = (moduleName) => {
        setExpandedModules(prev => ({
            ...prev,
            [moduleName]: !prev[moduleName]
        }));
    };

    const toggleAllInModule = (moduleName, subModuleName, value) => {
        setFormData(prev => {
            const newPermissions = { ...prev.permissions };
            const module = newPermissions[moduleName];
            const subModule = module[subModuleName];
            
            Object.keys(subModule).forEach(action => {
                subModule[action] = value;
            });
            
            return { ...prev, permissions: newPermissions };
        });
    };

    const togglePermission = (moduleName, subModuleName, action) => {
        setFormData(prev => {
            const newPermissions = { ...prev.permissions };
            const currentValue = newPermissions[moduleName][subModuleName][action];
            newPermissions[moduleName][subModuleName][action] = !currentValue;
            return { ...prev, permissions: newPermissions };
        });
    };

    const permissionModules = getPermissionModules();

    return (
        <Dialog open onOpenChange={onClose}>
            <DialogContent className="max-w-6xl max-h-[90vh]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Shield className="w-5 h-5 text-emerald-600" />
                        {item ? 'Edit Role' : 'Create New Role'}
                    </DialogTitle>
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList>
                        <TabsTrigger value="basic">Basic Info</TabsTrigger>
                        <TabsTrigger value="permissions">Permissions</TabsTrigger>
                    </TabsList>

                    <TabsContent value="basic" className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Role Code *</Label>
                                <Input
                                    value={formData.role_code}
                                    onChange={(e) => setFormData({ ...formData, role_code: e.target.value })}
                                    placeholder="e.g., FIN_MGR"
                                    disabled={item?.is_system_role}
                                />
                            </div>
                            <div>
                                <Label>Status</Label>
                                <Select 
                                    value={formData.status} 
                                    onValueChange={(value) => setFormData({ ...formData, status: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="active">Active</SelectItem>
                                        <SelectItem value="inactive">Inactive</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div>
                            <Label>Role Name *</Label>
                            <Input
                                value={formData.role_name}
                                onChange={(e) => setFormData({ ...formData, role_name: e.target.value })}
                                placeholder="e.g., Finance Manager"
                            />
                        </div>


                        <div>
                            <Label>Description</Label>
                            <Textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Describe the role and its responsibilities..."
                                rows={4}
                            />
                        </div>
                    </TabsContent>

                    <TabsContent value="permissions">
                        <ScrollArea className="h-[500px] pr-4">
                            <div className="space-y-4">
                                {permissionModules.map(({ name, label, items }) => (
                                    <Card key={name}>
                                        <CardHeader 
                                            className="cursor-pointer hover:bg-gray-50"
                                            onClick={() => toggleModule(name)}
                                        >
                                            <CardTitle className="text-base flex items-center gap-2">
                                                {expandedModules[name] ? (
                                                    <ChevronDown className="w-4 h-4" />
                                                ) : (
                                                    <ChevronRight className="w-4 h-4" />
                                                )}
                                                {label}
                                            </CardTitle>
                                        </CardHeader>
                                        {expandedModules[name] && (
                                            <CardContent className="space-y-3">
                                                {items.map(({ key, label: itemLabel }) => {
                                                    const permissions = formData.permissions[name]?.[key] || {};
                                                    const allChecked = Object.values(permissions).every(v => v === true);
                                                    
                                                    return (
                                                        <div key={key} className="border rounded-lg p-3">
                                                            <div className="flex items-center justify-between mb-2">
                                                                <span className="font-medium text-sm">{itemLabel}</span>
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => toggleAllInModule(name, key, !allChecked)}
                                                                >
                                                                    {allChecked ? 'Deselect All' : 'Select All'}
                                                                </Button>
                                                            </div>
                                                            <div className="flex flex-wrap gap-4">
                                                                {Object.keys(permissions).map(action => (
                                                                    <label key={action} className="flex items-center gap-2 cursor-pointer">
                                                                        <Checkbox
                                                                            checked={permissions[action]}
                                                                            onCheckedChange={() => togglePermission(name, key, action)}
                                                                        />
                                                                        <span className="text-sm capitalize">
                                                                            {action.replace('_', ' ')}
                                                                        </span>
                                                                    </label>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </CardContent>
                                        )}
                                    </Card>
                                ))}
                            </div>
                        </ScrollArea>
                    </TabsContent>
                </Tabs>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        <X className="w-4 h-4 mr-2" />
                        Cancel
                    </Button>
                    <Button 
                        onClick={handleSubmit} 
                        className="bg-emerald-600 hover:bg-emerald-700"
                        disabled={createMutation.isPending || updateMutation.isPending}
                    >
                        <Save className="w-4 h-4 mr-2" />
                        {createMutation.isPending || updateMutation.isPending ? 'Saving...' : 'Save Role'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function getDefaultPermissions() {
    return {
        sales: {
            quotation: { view: false, create: false, edit: false, delete: false, approve: false },
            sales_order: { view: false, create: false, edit: false, delete: false, approve: false },
            delivery: { view: false, create: false, edit: false, delete: false },
            invoice: { view: false, create: false, edit: false, delete: false },
            sales_return: { view: false, create: false, edit: false, delete: false },
            price_list: { view: false, create: false, edit: false, delete: false }
        },
        purchasing: {
            purchase_requisition: { view: false, create: false, edit: false, delete: false, approve: false },
            rfq: { view: false, create: false, edit: false, delete: false },
            purchase_order: { view: false, create: false, edit: false, delete: false, approve: false },
            grn: { view: false, create: false, edit: false, delete: false },
            vendor_invoice: { view: false, create: false, edit: false, delete: false, approve: false }
        },
        inventory: {
            stock_movement: { view: false, create: false, edit: false, delete: false },
            stock_transfer: { view: false, create: false, edit: false, delete: false, approve: false },
            cycle_count: { view: false, create: false, edit: false, delete: false, post_adjustment: false },
            stock_level: { view: false },
            batch: { view: false, create: false, edit: false }
        },
        production: {
            production_order: { view: false, create: false, edit: false, delete: false, release: false },
            bom: { view: false, create: false, edit: false, delete: false },
            routing: { view: false, create: false, edit: false, delete: false },
            work_center: { view: false, create: false, edit: false, delete: false },
            material_issue: { view: false, create: false },
            production_confirmation: { view: false, create: false }
        },
        quality: {
            qc_plan: { view: false, create: false, edit: false, delete: false },
            inspection_lot: { view: false, create: false, edit: false, complete: false },
            non_conformance: { view: false, create: false, edit: false, close: false },
            capa: { view: false, create: false, edit: false, approve: false },
            coa: { view: false, create: false, approve: false }
        },
        finance: {
            journal_entry: { view: false, create: false, edit: false, post: false, reverse: false },
            accounts_receivable: { view: false, create: false, edit: false },
            accounts_payable: { view: false, create: false, edit: false, approve: false },
            payment: { view: false, create: false, approve: false },
            fixed_asset: { view: false, create: false, edit: false, dispose: false },
            bank_reconciliation: { view: false, perform: false },
            financial_statements: { view: false, export: false, drill_down: false },
            chart_of_accounts: { view: false, create: false, edit: false, manage: false },
            manual_journal: { view: false, create: false, post: false }
        },
        maintenance: {
            work_order: { view: false, create: false, edit: false, complete: false },
            pm_plan: { view: false, create: false, edit: false, delete: false },
            equipment: { view: false, create: false, edit: false, delete: false },
            spare_part: { view: false, create: false, edit: false }
        },
        hr: {
            employee: { view: false, create: false, edit: false, delete: false },
            leave_request: { view: false, create: false, approve: false },
            payroll: { view: false, process: false, approve: false },
            loan_advance: { view: false, create: false, approve: false },
            eos_settlement: { view: false, calculate: false, approve: false }
        },
        projects: {
            project: { view: false, create: false, edit: false, close: false },
            timesheet: { view: false, create: false, approve: false },
            expense: { view: false, create: false, approve: false },
            milestone: { view: false, create: false, complete: false }
        },
        costing: {
            product_cost: { view: false, create: false, edit: false, approve: false },
            cost_pool: { view: false, create: false, edit: false },
            cost_variance: { view: false, analyze: false }
        },
        master_data: {
            material: { view: false, create: false, edit: false, delete: false },
            customer: { view: false, create: false, edit: false, delete: false },
            vendor: { view: false, create: false, edit: false, delete: false },
            chart_of_accounts: { view: false, create: false, edit: false }
        },
        admin: {
            organization: { view: false, create: false, edit: false },
            user_management: { view: false, edit: false },
            role_management: { view: false, create: false, edit: false, delete: false },
            approval_matrix: { view: false, create: false, edit: false },
            document_series: { view: false, create: false, edit: false }
        },
        reports: {
            financial_reports: false,
            sales_reports: false,
            inventory_reports: false,
            manufacturing_reports: false,
            hr_reports: false,
            compliance_reports: false
        }
    };
}

function getPermissionModules() {
    return [
        {
            name: 'sales',
            label: 'Sales & Distribution',
            items: [
                { key: 'quotation', label: 'Quotations' },
                { key: 'sales_order', label: 'Sales Orders' },
                { key: 'delivery', label: 'Deliveries' },
                { key: 'invoice', label: 'Invoices' },
                { key: 'sales_return', label: 'Sales Returns' },
                { key: 'price_list', label: 'Price Lists' }
            ]
        },
        {
            name: 'purchasing',
            label: 'Procurement',
            items: [
                { key: 'purchase_requisition', label: 'Purchase Requisitions' },
                { key: 'rfq', label: 'RFQs' },
                { key: 'purchase_order', label: 'Purchase Orders' },
                { key: 'grn', label: 'Goods Receipt Notes' },
                { key: 'vendor_invoice', label: 'Vendor Invoices' }
            ]
        },
        {
            name: 'inventory',
            label: 'Inventory Management',
            items: [
                { key: 'stock_movement', label: 'Stock Movements' },
                { key: 'stock_transfer', label: 'Stock Transfers' },
                { key: 'cycle_count', label: 'Cycle Counts' },
                { key: 'stock_level', label: 'Stock Levels' },
                { key: 'batch', label: 'Batch Management' }
            ]
        },
        {
            name: 'production',
            label: 'Manufacturing',
            items: [
                { key: 'production_order', label: 'Production Orders' },
                { key: 'bom', label: 'Bill of Materials' },
                { key: 'routing', label: 'Routings' },
                { key: 'work_center', label: 'Work Centers' },
                { key: 'material_issue', label: 'Material Issue' },
                { key: 'production_confirmation', label: 'Production Confirmation' }
            ]
        },
        {
            name: 'quality',
            label: 'Quality Management',
            items: [
                { key: 'qc_plan', label: 'QC Plans' },
                { key: 'inspection_lot', label: 'Inspection Lots' },
                { key: 'non_conformance', label: 'Non-Conformances' },
                { key: 'capa', label: 'CAPA' },
                { key: 'coa', label: 'Certificate of Analysis' }
            ]
        },
        {
            name: 'finance',
            label: 'Finance & Accounting',
            items: [
                { key: 'journal_entry', label: 'Journal Entries' },
                { key: 'accounts_receivable', label: 'Accounts Receivable' },
                { key: 'accounts_payable', label: 'Accounts Payable' },
                { key: 'payment', label: 'Payments' },
                { key: 'fixed_asset', label: 'Fixed Assets' },
                { key: 'bank_reconciliation', label: 'Bank Reconciliation' },
                { key: 'financial_statements', label: 'Financial Statements' },
                { key: 'chart_of_accounts', label: 'Chart of Accounts' },
                { key: 'manual_journal', label: 'Manual Journals' }
            ]
        },
        {
            name: 'maintenance',
            label: 'Maintenance',
            items: [
                { key: 'work_order', label: 'Work Orders' },
                { key: 'pm_plan', label: 'PM Plans' },
                { key: 'equipment', label: 'Equipment' },
                { key: 'spare_part', label: 'Spare Parts' }
            ]
        },
        {
            name: 'hr',
            label: 'HR & Payroll',
            items: [
                { key: 'employee', label: 'Employees' },
                { key: 'leave_request', label: 'Leave Requests' },
                { key: 'payroll', label: 'Payroll' },
                { key: 'loan_advance', label: 'Loans & Advances' },
                { key: 'eos_settlement', label: 'End of Service' }
            ]
        },
        {
            name: 'projects',
            label: 'Projects',
            items: [
                { key: 'project', label: 'Projects' },
                { key: 'timesheet', label: 'Timesheets' },
                { key: 'expense', label: 'Expenses' },
                { key: 'milestone', label: 'Milestones' }
            ]
        },
        {
            name: 'costing',
            label: 'Costing',
            items: [
                { key: 'product_cost', label: 'Product Costs' },
                { key: 'cost_pool', label: 'Cost Pools' },
                { key: 'cost_variance', label: 'Cost Variances' }
            ]
        },
        {
            name: 'master_data',
            label: 'Master Data',
            items: [
                { key: 'material', label: 'Materials' },
                { key: 'customer', label: 'Customers' },
                { key: 'vendor', label: 'Vendors' },
                { key: 'chart_of_accounts', label: 'Chart of Accounts' }
            ]
        },
        {
            name: 'admin',
            label: 'Administration',
            items: [
                { key: 'organization', label: 'Organization Setup' },
                { key: 'user_management', label: 'User Management' },
                { key: 'role_management', label: 'Role Management' },
                { key: 'approval_matrix', label: 'Approval Matrix' },
                { key: 'document_series', label: 'Document Series' }
            ]
        }
    ];
}
