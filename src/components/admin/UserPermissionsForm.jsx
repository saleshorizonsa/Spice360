import React, { useState } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, AlertCircle, CheckCircle2, X } from "lucide-react";

export default function UserPermissionsForm({ user, onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const { data: roles = [] } = useQuery({
        queryKey: ['roles'],
        queryFn: () => matrixSales.entities.Role.list(),
        initialData: []
    });

    const [formData, setFormData] = useState({
        department: user?.department || '',
        job_title: user?.job_title || '',
        phone: user?.phone || '',
        status: user?.status || 'active',
        assigned_roles: user?.assigned_roles || [],
        permissions: user?.permissions || {
            production: false,
            inventory: false,
            quality: false,
            sales: false,
            purchasing: false,
            finance: false,
            maintenance: false,
            admin: false
        }
    });

    const saveMutation = useMutation({
        mutationFn: (data) => {
            return matrixSales.auth.updateMe(data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            toast({
                title: "Success",
                description: "User profile updated successfully",
                variant: "default"
            });
            onClose();
        },
        onError: (error) => {
            toast({
                title: "Error",
                description: "Failed to update user profile",
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

    const handleRoleToggle = (roleCode) => {
        setFormData(prev => {
            const currentRoles = prev.assigned_roles || [];
            const isAssigned = currentRoles.includes(roleCode);
            
            return {
                ...prev,
                assigned_roles: isAssigned
                    ? currentRoles.filter(r => r !== roleCode)
                    : [...currentRoles, roleCode]
            };
        });
    };

    const handlePermissionChange = (module, value) => {
        setFormData(prev => ({
            ...prev,
            permissions: {
                ...prev.permissions,
                [module]: value
            }
        }));
    };

    const activeRoles = roles.filter(r => r.status === 'active');
    const assignedRoleDetails = activeRoles.filter(r => formData.assigned_roles?.includes(r.role_code));

    const modules = [
        { key: 'production', label: 'Production Management', icon: '🏭' },
        { key: 'inventory', label: 'Inventory Management', icon: '📦' },
        { key: 'quality', label: 'Quality Control', icon: '✓' },
        { key: 'sales', label: 'Sales & Distribution', icon: '💰' },
        { key: 'purchasing', label: 'Purchasing & Procurement', icon: '🛒' },
        { key: 'finance', label: 'Finance & Accounting', icon: '💵' },
        { key: 'maintenance', label: 'Maintenance Management', icon: '🔧' },
        { key: 'admin', label: 'Admin Center', icon: '⚙️' }
    ];

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Shield className="w-5 h-5" />
                        Edit User Profile & Permissions
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                            <strong>Editing:</strong> {user?.full_name} ({user?.email})
                            <br />
                            <strong>Role:</strong> <Badge className="ml-2">{user?.role}</Badge>
                        </AlertDescription>
                    </Alert>

                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Profile Information</h3>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Full Name (Read-only)</Label>
                                <Input
                                    value={user?.full_name}
                                    disabled
                                    className="bg-gray-100"
                                />
                            </div>

                            <div>
                                <Label>Email (Read-only)</Label>
                                <Input
                                    value={user?.email}
                                    disabled
                                    className="bg-gray-100"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Department</Label>
                                <Select 
                                    value={formData.department} 
                                    onValueChange={(val) => handleChange('department', val)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select department" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="production">Production</SelectItem>
                                        <SelectItem value="sales">Sales</SelectItem>
                                        <SelectItem value="purchasing">Purchasing</SelectItem>
                                        <SelectItem value="quality">Quality Control</SelectItem>
                                        <SelectItem value="finance">Finance</SelectItem>
                                        <SelectItem value="maintenance">Maintenance</SelectItem>
                                        <SelectItem value="admin">Administration</SelectItem>
                                        <SelectItem value="other">Other</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label>Job Title</Label>
                                <Input
                                    value={formData.job_title}
                                    onChange={(e) => handleChange('job_title', e.target.value)}
                                    placeholder="e.g., Production Manager"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Phone</Label>
                                <Input
                                    value={formData.phone}
                                    onChange={(e) => handleChange('phone', e.target.value)}
                                    placeholder="+1 234 567 8900"
                                />
                            </div>

                            <div>
                                <Label>Account Status</Label>
                                <Select 
                                    value={formData.status} 
                                    onValueChange={(val) => handleChange('status', val)}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="active">Active</SelectItem>
                                        <SelectItem value="inactive">Inactive</SelectItem>
                                        <SelectItem value="suspended">Suspended</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between border-b pb-2">
                            <div>
                                <h3 className="font-semibold text-lg flex items-center gap-2">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                                    Assigned Roles
                                </h3>
                                <p className="text-sm text-gray-600 mt-1">
                                    Assign roles to grant granular permissions. Users can have multiple roles.
                                </p>
                            </div>
                            <Badge variant="outline" className="text-lg">
                                {formData.assigned_roles?.length || 0} role(s)
                            </Badge>
                        </div>

                        {activeRoles.length === 0 ? (
                            <Alert>
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>
                                    No roles available. Please create roles in the Roles tab first.
                                </AlertDescription>
                            </Alert>
                        ) : (
                            <>
                                {assignedRoleDetails.length > 0 && (
                                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                                        <p className="text-sm font-medium text-emerald-900 mb-2">Currently Assigned:</p>
                                        <div className="flex flex-wrap gap-2">
                                            {assignedRoleDetails.map(role => (
                                                <Badge key={role.role_code} className="bg-emerald-600 text-white">
                                                    {role.role_name}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRoleToggle(role.role_code)}
                                                        className="ml-2 hover:bg-emerald-700 rounded-full"
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 gap-3">
                                    {activeRoles.map((role) => {
                                        const isAssigned = formData.assigned_roles?.includes(role.role_code);
                                        return (
                                            <div 
                                                key={role.role_code}
                                                className={`flex items-center justify-between p-4 border rounded-lg transition-all ${
                                                    isAssigned 
                                                        ? 'bg-emerald-50 border-emerald-300' 
                                                        : 'bg-white border-gray-200 hover:border-gray-300'
                                                }`}
                                            >
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <Label className="font-semibold text-base cursor-pointer">
                                                            {role.role_name}
                                                        </Label>
                                                        {role.is_system_role && (
                                                            <Badge variant="outline" className="text-xs">System</Badge>
                                                        )}
                                                    </div>
                                                    {role.description && (
                                                        <p className="text-sm text-gray-600 mt-1">{role.description}</p>
                                                    )}
                                                </div>
                                                <Switch
                                                    checked={isAssigned}
                                                    onCheckedChange={() => handleRoleToggle(role.role_code)}
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        )}
                    </div>

                    <div className="space-y-4 pt-4 border-t">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="font-semibold text-lg">Legacy Module Access</h3>
                                <p className="text-sm text-gray-600 mt-1">
                                    <strong>Deprecated:</strong> Use role-based permissions instead. These settings are kept for backward compatibility.
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 opacity-60">
                            {modules.map((module) => (
                                <div 
                                    key={module.key}
                                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="text-2xl">{module.icon}</span>
                                        <div>
                                            <Label className="font-medium">{module.label}</Label>
                                            <p className="text-xs text-gray-500">
                                                {formData.permissions[module.key] ? 'Access granted' : 'Access denied'}
                                            </p>
                                        </div>
                                    </div>
                                    <Switch
                                        checked={formData.permissions[module.key]}
                                        onCheckedChange={(val) => handlePermissionChange(module.key, val)}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                            Update User Profile
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}