import React, { useState } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";

export default function BulkResourceAllocation({ onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const [allocationType, setAllocationType] = useState("one_project_many_employees");
    const [selectedProject, setSelectedProject] = useState("");
    const [selectedEmployee, setSelectedEmployee] = useState("");
    const [selectedEmployees, setSelectedEmployees] = useState([]);
    const [selectedProjects, setSelectedProjects] = useState([]);
    const [commonData, setCommonData] = useState({
        role: "",
        allocation_percent: 100,
        start_date: "",
        end_date: "",
        billing_rate: 0,
        cost_rate: 0,
        is_billable: true,
        status: "planned"
    });

    const { data: projects = [] } = useQuery({
        queryKey: ['projects'],
        queryFn: () => matrixSales.entities.Project.list(),
        initialData: []
    });

    const { data: employees = [] } = useQuery({
        queryKey: ['employees'],
        queryFn: () => matrixSales.entities.Employee.list(),
        initialData: []
    });

    const saveMutation = useMutation({
        mutationFn: async (allocations) => {
            return await matrixSales.entities.ResourceAllocation.bulkCreate(allocations);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['resourceAllocations'] });
            toast({ title: "Success", description: "Resources allocated successfully" });
            onClose();
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();

        const allocations = [];

        if (allocationType === "one_project_many_employees") {
            if (!selectedProject || selectedEmployees.length === 0) {
                toast({ title: "Error", description: "Please select a project and at least one employee", variant: "destructive" });
                return;
            }

            const project = projects.find(p => p.project_code === selectedProject);

            selectedEmployees.forEach(empNum => {
                const employee = employees.find(e => e.employee_number === empNum);
                allocations.push({
                    allocation_id: `ALLOC-${Date.now()}-${empNum}`,
                    project_code: selectedProject,
                    project_name: project?.project_name || "",
                    employee_number: empNum,
                    employee_name: employee?.employee_name || "",
                    ...commonData
                });
            });
        } else {
            if (!selectedEmployee || selectedProjects.length === 0) {
                toast({ title: "Error", description: "Please select an employee and at least one project", variant: "destructive" });
                return;
            }

            const employee = employees.find(e => e.employee_number === selectedEmployee);

            selectedProjects.forEach(projCode => {
                const project = projects.find(p => p.project_code === projCode);
                allocations.push({
                    allocation_id: `ALLOC-${Date.now()}-${projCode}`,
                    project_code: projCode,
                    project_name: project?.project_name || "",
                    employee_number: selectedEmployee,
                    employee_name: employee?.employee_name || "",
                    ...commonData
                });
            });
        }

        saveMutation.mutate(allocations);
    };

    const handleEmployeeToggle = (empNum) => {
        setSelectedEmployees(prev => 
            prev.includes(empNum) 
                ? prev.filter(e => e !== empNum)
                : [...prev, empNum]
        );
    };

    const handleProjectToggle = (projCode) => {
        setSelectedProjects(prev => 
            prev.includes(projCode) 
                ? prev.filter(p => p !== projCode)
                : [...prev, projCode]
        );
    };

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Bulk Resource Allocation</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <Label>Allocation Type</Label>
                        <Select value={allocationType} onValueChange={setAllocationType}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="one_project_many_employees">
                                    One Project → Multiple Employees
                                </SelectItem>
                                <SelectItem value="one_employee_many_projects">
                                    One Employee → Multiple Projects
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {allocationType === "one_project_many_employees" ? (
                        <>
                            <div className="space-y-2">
                                <Label>Select Project *</Label>
                                <Select value={selectedProject} onValueChange={setSelectedProject}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select project" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {projects.map(p => (
                                            <SelectItem key={p.project_code} value={p.project_code}>
                                                {p.project_name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Select Employees * ({selectedEmployees.length} selected)</Label>
                                <div className="border rounded-lg p-4 max-h-60 overflow-y-auto space-y-2">
                                    {employees.map(emp => (
                                        <div key={emp.employee_number} className="flex items-center gap-2">
                                            <Checkbox
                                                checked={selectedEmployees.includes(emp.employee_number)}
                                                onCheckedChange={() => handleEmployeeToggle(emp.employee_number)}
                                            />
                                            <span className="text-sm">{emp.employee_name} ({emp.employee_number})</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="space-y-2">
                                <Label>Select Employee *</Label>
                                <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select employee" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {employees.map(e => (
                                            <SelectItem key={e.employee_number} value={e.employee_number}>
                                                {e.employee_name} ({e.employee_number})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Select Projects * ({selectedProjects.length} selected)</Label>
                                <div className="border rounded-lg p-4 max-h-60 overflow-y-auto space-y-2">
                                    {projects.map(proj => (
                                        <div key={proj.project_code} className="flex items-center gap-2">
                                            <Checkbox
                                                checked={selectedProjects.includes(proj.project_code)}
                                                onCheckedChange={() => handleProjectToggle(proj.project_code)}
                                            />
                                            <span className="text-sm">{proj.project_name} ({proj.project_code})</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}

                    <div className="border-t pt-4">
                        <h4 className="font-semibold mb-4">Common Allocation Details</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Role *</Label>
                                <Input
                                    value={commonData.role}
                                    onChange={(e) => setCommonData(prev => ({ ...prev, role: e.target.value }))}
                                    placeholder="e.g., Developer, Consultant"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Allocation %</Label>
                                <Input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={commonData.allocation_percent}
                                    onChange={(e) => setCommonData(prev => ({ ...prev, allocation_percent: parseFloat(e.target.value) || 0 }))}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Start Date *</Label>
                                <Input
                                    type="date"
                                    value={commonData.start_date}
                                    onChange={(e) => setCommonData(prev => ({ ...prev, start_date: e.target.value }))}
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>End Date</Label>
                                <Input
                                    type="date"
                                    value={commonData.end_date}
                                    onChange={(e) => setCommonData(prev => ({ ...prev, end_date: e.target.value }))}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Billing Rate (LKR/hour)</Label>
                                <Input
                                    type="number"
                                    value={commonData.billing_rate}
                                    onChange={(e) => setCommonData(prev => ({ ...prev, billing_rate: parseFloat(e.target.value) || 0 }))}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Cost Rate (LKR/hour)</Label>
                                <Input
                                    type="number"
                                    value={commonData.cost_rate}
                                    onChange={(e) => setCommonData(prev => ({ ...prev, cost_rate: parseFloat(e.target.value) || 0 }))}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label className="flex items-center gap-2">
                                    <span>Billable</span>
                                    <Switch
                                        checked={commonData.is_billable}
                                        onCheckedChange={(val) => setCommonData(prev => ({ ...prev, is_billable: val }))}
                                    />
                                </Label>
                            </div>

                            <div className="space-y-2">
                                <Label>Status</Label>
                                <Select value={commonData.status} onValueChange={(val) => setCommonData(prev => ({ ...prev, status: val }))}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="planned">Planned</SelectItem>
                                        <SelectItem value="active">Active</SelectItem>
                                        <SelectItem value="completed">Completed</SelectItem>
                                        <SelectItem value="cancelled">Cancelled</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit" className="bg-emerald-600">
                            Create {allocationType === "one_project_many_employees" ? selectedEmployees.length : selectedProjects.length} Allocations
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}