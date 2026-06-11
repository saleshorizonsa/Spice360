
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getNextDocumentNumber } from "../utils/documentNumberGenerator"; // Assuming utils is a sibling directory

export default function ProjectForm({ item, onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const { data: customers = [] } = useQuery({
        queryKey: ['customers'],
        queryFn: () => matrixSales.entities.Customer.list(),
        initialData: []
    });

    const [formData, setFormData] = useState({
        project_code: '',
        project_name: '',
        project_type: 'time_and_material',
        customer_code: '',
        start_date: new Date().toISOString().split('T')[0],
        end_date: '',
        project_manager: '',
        billing_method: 'hourly',
        hourly_rate: 0,
        retention_percent: 0,
        budget_hours: 0,
        budget_cost: 0,
        status: 'planning',
        priority: 'medium',
        risk_level: 'low'
    });

    const [isGeneratingNumber, setIsGeneratingNumber] = useState(false);

    const generateProjectNumber = async () => {
        setIsGeneratingNumber(true);
        try {
            const number = await getNextDocumentNumber('project');
            setFormData(prev => ({ ...prev, project_code: number }));
        } catch (error) {
            console.error("Error generating project number:", error);
            toast({
                title: "Error",
                description: "Failed to generate project code. Please enter manually.",
                variant: "destructive"
            });
        } finally {
            setIsGeneratingNumber(false);
        }
    };

    useEffect(() => {
        if (item) {
            setFormData(item);
        } else {
            generateProjectNumber();
        }
    }, [item]);

    const saveMutation = useMutation({
        mutationFn: (data) => {
            if (item) {
                return matrixSales.entities.Project.update(item.id, data);
            }
            return matrixSales.entities.Project.create(data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['projects'] });
            toast({
                title: "Success",
                description: `Project ${item ? 'updated' : 'created'} successfully`
            });
            onClose();
        },
        onError: (error) => {
            console.error("Error saving project:", error);
            toast({
                title: "Error",
                description: `Failed to ${item ? 'update' : 'create'} project. ${error.message || ''}`,
                variant: "destructive"
            });
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
                    <DialogTitle>{item ? 'Edit' : 'New'} Project</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <Tabs defaultValue="basic" className="w-full">
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="basic">Basic Info</TabsTrigger>
                            <TabsTrigger value="billing">Billing</TabsTrigger>
                            <TabsTrigger value="budget">Budget</TabsTrigger>
                        </TabsList>

                        <TabsContent value="basic" className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Project Code *</Label>
                                    <Input
                                        value={formData.project_code}
                                        onChange={(e) => handleChange('project_code', e.target.value)}
                                        required
                                        disabled={isGeneratingNumber || !!item} // Disable if generating or editing existing item
                                    />
                                </div>
                                <div>
                                    <Label>Project Name *</Label>
                                    <Input
                                        value={formData.project_name}
                                        onChange={(e) => handleChange('project_name', e.target.value)}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Customer *</Label>
                                    <Select 
                                        value={formData.customer_code} 
                                        onValueChange={(val) => {
                                            const customer = customers.find(c => c.customer_code === val);
                                            handleChange('customer_code', val);
                                            if (customer) {
                                                handleChange('customer_name', customer.customer_name);
                                            }
                                        }}
                                        required
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select customer" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {customers.map(c => (
                                                <SelectItem key={c.id} value={c.customer_code}>
                                                    {c.customer_code} - {c.customer_name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label>Project Type *</Label>
                                    <Select 
                                        value={formData.project_type} 
                                        onValueChange={(val) => handleChange('project_type', val)}
                                        required
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="time_and_material">Time & Material</SelectItem>
                                            <SelectItem value="fixed_price">Fixed Price</SelectItem>
                                            <SelectItem value="milestone_based">Milestone Based</SelectItem>
                                            <SelectItem value="retainer">Retainer</SelectItem>
                                            <SelectItem value="internal">Internal</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Start Date *</Label>
                                    <Input
                                        type="date"
                                        value={formData.start_date}
                                        onChange={(e) => handleChange('start_date', e.target.value)}
                                        required
                                    />
                                </div>
                                <div>
                                    <Label>End Date *</Label>
                                    <Input
                                        type="date"
                                        value={formData.end_date}
                                        onChange={(e) => handleChange('end_date', e.target.value)}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Project Manager *</Label>
                                    <Input
                                        value={formData.project_manager}
                                        onChange={(e) => handleChange('project_manager', e.target.value)}
                                        required
                                    />
                                </div>
                                <div>
                                    <Label>Department</Label>
                                    <Input
                                        value={formData.department}
                                        onChange={(e) => handleChange('department', e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <Label>Priority</Label>
                                    <Select 
                                        value={formData.priority} 
                                        onValueChange={(val) => handleChange('priority', val)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="low">Low</SelectItem>
                                            <SelectItem value="medium">Medium</SelectItem>
                                            <SelectItem value="high">High</SelectItem>
                                            <SelectItem value="critical">Critical</SelectItem>
                                        </SelectContent>
                                    </Select>
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
                                            <SelectItem value="planning">Planning</SelectItem>
                                            <SelectItem value="active">Active</SelectItem>
                                            <SelectItem value="on_hold">On Hold</SelectItem>
                                            <SelectItem value="completed">Completed</SelectItem>
                                            <SelectItem value="cancelled">Cancelled</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label>Risk Level</Label>
                                    <Select 
                                        value={formData.risk_level} 
                                        onValueChange={(val) => handleChange('risk_level', val)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="low">Low</SelectItem>
                                            <SelectItem value="medium">Medium</SelectItem>
                                            <SelectItem value="high">High</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div>
                                <Label>Description</Label>
                                <Textarea
                                    value={formData.description}
                                    onChange={(e) => handleChange('description', e.target.value)}
                                    rows={3}
                                />
                            </div>
                        </TabsContent>

                        <TabsContent value="billing" className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Billing Method</Label>
                                    <Select 
                                        value={formData.billing_method} 
                                        onValueChange={(val) => handleChange('billing_method', val)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="hourly">Hourly</SelectItem>
                                            <SelectItem value="daily">Daily</SelectItem>
                                            <SelectItem value="milestone">Milestone</SelectItem>
                                            <SelectItem value="fixed_price">Fixed Price</SelectItem>
                                            <SelectItem value="percentage_completion">% Completion</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label>Contract Value (LKR)</Label>
                                    <Input
                                        type="number"
                                        value={formData.contract_value}
                                        onChange={(e) => handleChange('contract_value', parseFloat(e.target.value) || 0)}
                                        min="0"
                                        step="0.01"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Hourly Rate (LKR)</Label>
                                    <Input
                                        type="number"
                                        value={formData.hourly_rate}
                                        onChange={(e) => handleChange('hourly_rate', parseFloat(e.target.value) || 0)}
                                        min="0"
                                        step="0.01"
                                    />
                                </div>
                                <div>
                                    <Label>Daily Rate (LKR)</Label>
                                    <Input
                                        type="number"
                                        value={formData.daily_rate}
                                        onChange={(e) => handleChange('daily_rate', parseFloat(e.target.value) || 0)}
                                        min="0"
                                        step="0.01"
                                    />
                                </div>
                            </div>

                            <div>
                                <Label>Retention Percentage (%)</Label>
                                <Input
                                    type="number"
                                    value={formData.retention_percent}
                                    onChange={(e) => handleChange('retention_percent', parseFloat(e.target.value) || 0)}
                                    min="0"
                                    max="100"
                                    step="0.1"
                                />
                            </div>

                            <div>
                                <Label>Contract Number</Label>
                                <Input
                                    value={formData.contract_number}
                                    onChange={(e) => handleChange('contract_number', e.target.value)}
                                />
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <Label>SLA Response Time (Hours)</Label>
                                    <Input
                                        type="number"
                                        value={formData.sla_response_time_hours}
                                        onChange={(e) => handleChange('sla_response_time_hours', parseFloat(e.target.value) || 0)}
                                    />
                                </div>
                                <div>
                                    <Label>SLA Resolution Time (Hours)</Label>
                                    <Input
                                        type="number"
                                        value={formData.sla_resolution_time_hours}
                                        onChange={(e) => handleChange('sla_resolution_time_hours', parseFloat(e.target.value) || 0)}
                                    />
                                </div>
                                <div>
                                    <Label>SLA Uptime (%)</Label>
                                    <Input
                                        type="number"
                                        value={formData.sla_uptime_percent}
                                        onChange={(e) => handleChange('sla_uptime_percent', parseFloat(e.target.value) || 0)}
                                        max="100"
                                    />
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="budget" className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Budget Hours</Label>
                                    <Input
                                        type="number"
                                        value={formData.budget_hours}
                                        onChange={(e) => handleChange('budget_hours', parseFloat(e.target.value) || 0)}
                                        min="0"
                                    />
                                </div>
                                <div>
                                    <Label>Budget Cost (LKR)</Label>
                                    <Input
                                        type="number"
                                        value={formData.budget_cost}
                                        onChange={(e) => handleChange('budget_cost', parseFloat(e.target.value) || 0)}
                                        min="0"
                                        step="0.01"
                                    />
                                </div>
                            </div>

                            <div>
                                <Label>Cost Center</Label>
                                <Input
                                    value={formData.cost_center}
                                    onChange={(e) => handleChange('cost_center', e.target.value)}
                                />
                            </div>

                            <div>
                                <Label>Revenue Recognition Method</Label>
                                <Select 
                                    value={formData.revenue_recognition_method} 
                                    onValueChange={(val) => handleChange('revenue_recognition_method', val)}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="milestone">Milestone</SelectItem>
                                        <SelectItem value="percentage_completion">Percentage Completion</SelectItem>
                                        <SelectItem value="completed_contract">Completed Contract</SelectItem>
                                        <SelectItem value="time_and_material">Time & Material</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </TabsContent>
                    </Tabs>

                    <div className="flex justify-end gap-3 border-t pt-4">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" disabled={saveMutation.isLoading}>
                            {saveMutation.isLoading ? 'Saving...' : (item ? 'Update' : 'Create') + ' Project'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
