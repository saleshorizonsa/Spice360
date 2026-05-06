import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
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
import { createApprovalRequest } from "../utils/approvalWorkflow";

export default function LeaveRequestForm({ item, onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [currentUser, setCurrentUser] = useState(null);
    const [activeTab, setActiveTab] = useState("details");

    useEffect(() => {
        const fetchUser = async () => {
            const user = await base44.auth.me();
            setCurrentUser(user);
        };
        fetchUser();
    }, []);

    const { data: employees = [] } = useQuery({
        queryKey: ['employees'],
        queryFn: () => base44.entities.Employee.list(),
        initialData: []
    });

    const [formData, setFormData] = useState({
        leave_request_number: '',
        employee_number: '',
        employee_name: '',
        leave_type: 'annual',
        start_date: '',
        end_date: '',
        total_days: 0,
        reason: '',
        status: 'pending',
        notes: ''
    });

    useEffect(() => {
        if (item) {
            setFormData(item);
        } else if (!item && currentUser) {
            const employee = employees.find(e => e.email === currentUser.email);
            if (employee) {
                setFormData(prev => ({
                    ...prev,
                    employee_number: employee.employee_number,
                    employee_name: employee.employee_name
                }));
            }
        }
    }, [item, currentUser, employees]);

    useEffect(() => {
        if (formData.start_date && formData.end_date) {
            const start = new Date(formData.start_date);
            const end = new Date(formData.end_date);
            const diffTime = Math.abs(end - start);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
            setFormData(prev => ({ ...prev, total_days: diffDays }));
        }
    }, [formData.start_date, formData.end_date]);

    const saveMutation = useMutation({
        mutationFn: async (data) => {
            let leaveRequest;
            if (item) {
                leaveRequest = await base44.entities.LeaveRequest.update(item.id, data);
            } else {
                leaveRequest = await base44.entities.LeaveRequest.create(data);
                
                const approvalRequest = await createApprovalRequest({
                    documentType: 'leave_request',
                    documentNumber: leaveRequest.leave_request_number,
                    documentId: leaveRequest.id,
                    amount: 0,
                    requestedBy: currentUser?.email,
                    requestedByName: currentUser?.full_name,
                    requestedByRole: currentUser?.approval_role || 'employee',
                    branch: currentUser?.branch_code,
                    department: currentUser?.department || 'HR',
                    summary: `Leave Request: ${leaveRequest.leave_type} - ${leaveRequest.total_days} days`,
                    summaryAr: `طلب إجازة: ${leaveRequest.leave_type} - ${leaveRequest.total_days} أيام`
                });

                if (approvalRequest) {
                    await base44.entities.LeaveRequest.update(leaveRequest.id, {
                        status: 'pending_approval'
                    });
                }
            }
            return leaveRequest;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['leaveRequests'] });
            queryClient.invalidateQueries({ queryKey: ['approvalRequests'] });
            toast({
                title: "Success",
                description: `Leave request ${item ? 'updated' : 'submitted'} successfully`,
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
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {item ? 'Edit Leave Request' : 'New Leave Request'}
                    </DialogTitle>
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="grid grid-cols-2 w-96">
                        <TabsTrigger value="details">Leave Details</TabsTrigger>
                        <TabsTrigger value="documents">
                            <Paperclip className="w-4 h-4 mr-2" />
                            Documents
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="details">
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Request Number *</Label>
                                    <Input
                                        value={formData.leave_request_number}
                                        onChange={(e) => handleChange('leave_request_number', e.target.value)}
                                        required
                                    />
                                </div>
                                <div>
                                    <Label>Leave Type *</Label>
                                    <Select value={formData.leave_type} onValueChange={(val) => handleChange('leave_type', val)} required>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="annual">Annual Leave</SelectItem>
                                            <SelectItem value="sick">Sick Leave</SelectItem>
                                            <SelectItem value="emergency">Emergency Leave</SelectItem>
                                            <SelectItem value="unpaid">Unpaid Leave</SelectItem>
                                            <SelectItem value="hajj">Hajj Leave</SelectItem>
                                            <SelectItem value="maternity">Maternity Leave</SelectItem>
                                            <SelectItem value="paternity">Paternity Leave</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Employee Name</Label>
                                    <Input
                                        value={formData.employee_name}
                                        disabled
                                    />
                                </div>
                                <div>
                                    <Label>Employee Number</Label>
                                    <Input
                                        value={formData.employee_number}
                                        disabled
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
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
                                <div>
                                    <Label>Total Days</Label>
                                    <Input
                                        type="number"
                                        value={formData.total_days}
                                        disabled
                                    />
                                </div>
                            </div>

                            <div>
                                <Label>Reason *</Label>
                                <Textarea
                                    value={formData.reason}
                                    onChange={(e) => handleChange('reason', e.target.value)}
                                    required
                                    rows={3}
                                    placeholder="Explain the reason for your leave request..."
                                />
                            </div>

                            <div>
                                <Label>Additional Notes</Label>
                                <Textarea
                                    value={formData.notes}
                                    onChange={(e) => handleChange('notes', e.target.value)}
                                    rows={2}
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t">
                                <Button type="button" variant="outline" onClick={onClose}>
                                    Cancel
                                </Button>
                                <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                                    {item ? 'Update' : 'Submit'} Leave Request
                                </Button>
                            </div>
                        </form>
                    </TabsContent>

                    <TabsContent value="documents">
                        {item ? (
                            <DocumentList
                                relatedEntity="leave_request"
                                relatedEntityId={item.id}
                                relatedDocumentNumber={item.leave_request_number}
                            />
                        ) : (
                            <div className="text-center py-8 text-gray-500">
                                <Paperclip className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                                <p>Submit the leave request first to upload supporting documents</p>
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}