import React, { useState, useEffect } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserCog, Search, Shield, Save, Users as UsersIcon, UserPlus, Mail, Copy, ToggleLeft, ToggleRight, Trash2, RefreshCw } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { logAuditTrail } from "../utils/auditTrail";

export default function UserRoleAssignment() {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedUser, setSelectedUser] = useState(null);
    const [selectedRoles, setSelectedRoles] = useState([]);
    const [currentUser, setCurrentUser] = useState(null);
    const [inviteData, setInviteData] = useState({
        full_name: '',
        email: '',
        department: '',
        job_title: '',
        assigned_roles: []
    });
    const [lastInvite, setLastInvite] = useState(null);
    const queryClient = useQueryClient();
    const { toast } = useToast();

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

    const { data: users = [] } = useQuery({
        queryKey: ['users'],
        queryFn: () => matrixSales.entities.User.list(),
        initialData: []
    });

    const { data: roles = [] } = useQuery({
        queryKey: ['roles'],
        queryFn: () => matrixSales.entities.Role.filter({ status: 'active' }),
        initialData: []
    });

    const updateUserRolesMutation = useMutation({
        mutationFn: async ({ userId, roleCodes }) => {
            const beforeData = selectedUser;
            
            const updated = await matrixSales.entities.User.update(userId, {
                assigned_roles: roleCodes
            });

            await logAuditTrail({
                entityType: 'user',
                entityId: userId,
                documentNumber: selectedUser.email,
                actionType: 'update',
                beforeData: { assigned_roles: beforeData.assigned_roles },
                afterData: { assigned_roles: roleCodes },
                user: currentUser,
                severity: 'warning',
                changeSummary: `Roles updated for ${selectedUser.full_name}`
            });

            return updated;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            queryClient.invalidateQueries({ queryKey: ['auditTrails'] });
            toast({
                title: "Success",
                description: "User roles updated successfully",
            });
            setSelectedUser(null);
            setSelectedRoles([]);
        }
    });

    const inviteUserMutation = useMutation({
        mutationFn: async (data) => {
            const normalizedEmail = data.email.trim().toLowerCase();
            const existingUser = users.find(u => u.email?.toLowerCase() === normalizedEmail);

            if (existingUser) {
                throw new Error('A user with this email already exists.');
            }

            const inviteLink = `${window.location.origin}/?invite_email=${encodeURIComponent(normalizedEmail)}`;
            const userPayload = {
                full_name: data.full_name.trim(),
                email: normalizedEmail,
                department: data.department,
                job_title: data.job_title.trim(),
                assigned_roles: data.assigned_roles,
                role: 'user',
                status: 'invited',
                is_active: false,
                invited_by: currentUser?.email,
                invited_at: new Date().toISOString(),
                invite_link: inviteLink
            };

            const invitedUser = await matrixSales.entities.User.create(userPayload);

            await logAuditTrail({
                entityType: 'user',
                entityId: invitedUser.id,
                documentNumber: normalizedEmail,
                actionType: 'create',
                afterData: userPayload,
                user: currentUser,
                severity: 'info',
                changeSummary: `User invited: ${userPayload.full_name}`
            });

            return { ...invitedUser, invite_link: inviteLink };
        },
        onSuccess: (invitedUser) => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            queryClient.invalidateQueries({ queryKey: ['auditTrails'] });
            setLastInvite(invitedUser);
            setInviteData({
                full_name: '',
                email: '',
                department: '',
                job_title: '',
                assigned_roles: []
            });
            toast({
                title: "Invitation created",
                description: "The pending user record is ready and the invite link can be sent.",
            });
        },
        onError: (error) => {
            toast({
                title: "Invite failed",
                description: error.message || "Failed to create invitation",
                variant: "destructive"
            });
        }
    });

    const filteredUsers = users.filter(u => 
        u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.employee_number?.includes(searchTerm)
    );

    const getUserCountByRole = (roleCode) => {
        return users.filter(u => 
            u.assigned_roles && u.assigned_roles.includes(roleCode)
        ).length;
    };

    const handleSelectUser = (user) => {
        setSelectedUser(user);
        setSelectedRoles(user.assigned_roles || []);
    };

    const handleToggleRole = (roleCode) => {
        setSelectedRoles(prev => 
            prev.includes(roleCode)
                ? prev.filter(r => r !== roleCode)
                : [...prev, roleCode]
        );
    };

    const handleSave = () => {
        if (!selectedUser) return;
        
        updateUserRolesMutation.mutate({
            userId: selectedUser.id,
            roleCodes: selectedRoles
        });
    };

    const handleInviteRoleToggle = (roleCode) => {
        setInviteData(prev => {
            const roles = prev.assigned_roles || [];
            return {
                ...prev,
                assigned_roles: roles.includes(roleCode)
                    ? roles.filter(r => r !== roleCode)
                    : [...roles, roleCode]
            };
        });
    };

    const handleInviteSubmit = (event) => {
        event.preventDefault();

        if (!inviteData.full_name.trim() || !inviteData.email.trim()) {
            toast({
                title: "Missing details",
                description: "Full name and email are required.",
                variant: "destructive"
            });
            return;
        }

        inviteUserMutation.mutate(inviteData);
    };

    const [sendingInvite, setSendingInvite] = useState(false);

    const copyInviteLink = async () => {
        if (!lastInvite?.invite_link) return;
        await navigator.clipboard.writeText(lastInvite.invite_link);
        toast({ title: "Copied", description: "Invite link copied to clipboard." });
    };

    const sendInviteEmail = async () => {
        if (!lastInvite) return;
        setSendingInvite(true);
        try {
            await matrixSales.auth.sendInvite({
                email: lastInvite.email,
                full_name: lastInvite.full_name,
                invite_link: lastInvite.invite_link,
            });
            toast({ title: "Email sent", description: `Invitation sent to ${lastInvite.email}.` });
        } catch (err) {
            toast({ title: "Email failed", description: err.message || "Could not send invite email.", variant: "destructive" });
        } finally {
            setSendingInvite(false);
        }
    };

    const toggleUserStatusMutation = useMutation({
        mutationFn: ({ userId, newStatus }) =>
            matrixSales.entities.User.update(userId, {
                status: newStatus,
                is_active: newStatus === 'active',
            }),
        onSuccess: (_, vars) => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            toast({ title: "Updated", description: `User ${vars.newStatus === 'active' ? 'activated' : 'deactivated'}.` });
        },
    });

    const deleteUserMutation = useMutation({
        mutationFn: (userId) => matrixSales.entities.User.delete(userId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            toast({ title: "Removed", description: "User removed from the system." });
        },
    });

    const handleToggleStatus = (user) => {
        const newStatus = user.status === 'active' ? 'inactive' : 'active';
        toggleUserStatusMutation.mutate({ userId: user.id, newStatus });
    };

    const handleDeleteUser = (user) => {
        if (!confirm(`Remove ${user.full_name || user.email} permanently?`)) return;
        deleteUserMutation.mutate(user.id);
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <UserPlus className="w-5 h-5 text-emerald-600" />
                        Invite User
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleInviteSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="invite-name">Full Name</Label>
                                <Input
                                    id="invite-name"
                                    value={inviteData.full_name}
                                    onChange={(event) => setInviteData(prev => ({ ...prev, full_name: event.target.value }))}
                                    placeholder="Enter full name"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="invite-email">Email</Label>
                                <Input
                                    id="invite-email"
                                    type="email"
                                    value={inviteData.email}
                                    onChange={(event) => setInviteData(prev => ({ ...prev, email: event.target.value }))}
                                    placeholder="name@company.com"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Department</Label>
                                <Select
                                    value={inviteData.department}
                                    onValueChange={(value) => setInviteData(prev => ({ ...prev, department: value }))}
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
                            <div className="space-y-2">
                                <Label htmlFor="invite-job-title">Job Title</Label>
                                <Input
                                    id="invite-job-title"
                                    value={inviteData.job_title}
                                    onChange={(event) => setInviteData(prev => ({ ...prev, job_title: event.target.value }))}
                                    placeholder="e.g., Sales Manager"
                                />
                            </div>
                        </div>

                        {roles.length > 0 && (
                            <div className="space-y-2">
                                <Label>Initial Roles</Label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {roles.map(role => {
                                        const isChecked = inviteData.assigned_roles.includes(role.role_code);
                                        return (
                                            <button
                                                key={role.id}
                                                type="button"
                                                onClick={() => handleInviteRoleToggle(role.role_code)}
                                                className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                                                    isChecked ? 'border-emerald-300 bg-emerald-50' : 'border-gray-200 hover:bg-gray-50'
                                                }`}
                                            >
                                                <Checkbox checked={isChecked} />
                                                <span>
                                                    <span className="block font-medium">{role.role_name}</span>
                                                    <span className="block text-xs text-gray-500">{role.role_code}</span>
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        <div className="flex flex-col gap-3 border-t pt-4 md:flex-row md:items-center md:justify-between">
                            <div className="text-sm text-gray-600">
                                Creates a pending user record and generates an invite link for email delivery.
                            </div>
                            <Button
                                type="submit"
                                className="bg-emerald-600 hover:bg-emerald-700"
                                disabled={inviteUserMutation.isPending}
                            >
                                <UserPlus className="w-4 h-4 mr-2" />
                                {inviteUserMutation.isPending ? 'Creating...' : 'Create Invite'}
                            </Button>
                        </div>
                    </form>

                    {lastInvite && (
                        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                <div>
                                    <p className="font-semibold text-emerald-950">Invite ready for {lastInvite.email}</p>
                                    <p className="break-all text-sm text-emerald-800">{lastInvite.invite_link}</p>
                                </div>
                                <div className="flex gap-2">
                                    <Button type="button" variant="outline" size="sm" onClick={copyInviteLink}>
                                        <Copy className="w-4 h-4 mr-2" />
                                        Copy
                                    </Button>
                                    <Button type="button" size="sm" className="bg-emerald-600 hover:bg-emerald-700"
                                        onClick={sendInviteEmail} disabled={sendingInvite}>
                                        <Mail className="w-4 h-4 mr-2" />
                                        {sendingInvite ? 'Sending…' : 'Send Email'}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* User List */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <UserCog className="w-5 h-5 text-emerald-600" />
                        Select User
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                        <Input
                            placeholder="Search by name, email, or employee number..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10"
                        />
                    </div>

                    <div className="space-y-2 max-h-96 overflow-y-auto">
                        {filteredUsers.length === 0 && (
                            <p className="text-center text-gray-500 py-8 text-sm">No users found.</p>
                        )}
                        {filteredUsers.map(user => {
                            const isSelected = selectedUser?.id === user.id;
                            const roleCount = user.assigned_roles?.length || 0;
                            const statusColor = {
                                active:    'bg-green-100 text-green-700',
                                invited:   'bg-amber-100 text-amber-700',
                                inactive:  'bg-gray-100 text-gray-600',
                                suspended: 'bg-red-100 text-red-700',
                            }[user.status] || 'bg-gray-100 text-gray-600';

                            return (
                                <div
                                    key={user.id}
                                    className={`border rounded-lg transition-colors ${
                                        isSelected ? 'bg-emerald-50 border-emerald-300' : 'hover:bg-gray-50'
                                    }`}
                                >
                                    <div
                                        className="flex items-center justify-between p-3 cursor-pointer"
                                        onClick={() => handleSelectUser(user)}
                                    >
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold truncate">{user.full_name}</p>
                                            <p className="text-sm text-gray-600 truncate">{user.email}</p>
                                            {user.job_title && (
                                                <p className="text-xs text-gray-400">{user.job_title}</p>
                                            )}
                                        </div>
                                        <div className="flex flex-col items-end gap-1 ml-2 flex-shrink-0">
                                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColor}`}>
                                                {user.status || 'active'}
                                            </span>
                                            <Badge variant="outline" className="text-xs">
                                                {roleCount} role{roleCount !== 1 ? 's' : ''}
                                            </Badge>
                                        </div>
                                    </div>
                                    <div className="flex gap-1 px-3 pb-2 border-t border-gray-100 pt-1.5">
                                        <button
                                            type="button"
                                            onClick={() => handleToggleStatus(user)}
                                            className="flex items-center gap-1 text-xs px-2 py-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700"
                                        >
                                            {user.status === 'active'
                                                ? <ToggleRight className="w-3.5 h-3.5 text-emerald-600" />
                                                : <ToggleLeft className="w-3.5 h-3.5 text-gray-400" />}
                                            {user.status === 'active' ? 'Deactivate' : 'Activate'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteUser(user)}
                                            className="flex items-center gap-1 text-xs px-2 py-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-600 ml-auto"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                            Remove
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>

            {/* Role Assignment */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Shield className="w-5 h-5 text-emerald-600" />
                        Assign Roles
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {selectedUser ? (
                        <div className="space-y-4">
                            <div className="bg-gray-50 p-4 rounded-lg">
                                <p className="text-sm text-gray-600">Selected User</p>
                                <p className="font-bold text-lg">{selectedUser.full_name}</p>
                                <p className="text-sm text-gray-600">{selectedUser.email}</p>
                                {selectedUser.role === 'admin' && (
                                    <Badge className="bg-purple-600 mt-2">
                                        System Administrator - Full Access
                                    </Badge>
                                )}
                            </div>

                            {selectedUser.role !== 'admin' && (
                                <>
                                    <div className="space-y-3">
                                        <Label>Select Roles to Assign</Label>
                                        {roles.map(role => {
                                            const isChecked = selectedRoles.includes(role.role_code);
                                            
                                            return (
                                                <div
                                                    key={role.id}
                                                    className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                                                        isChecked ? 'bg-emerald-50 border-emerald-300' : 'hover:bg-gray-50'
                                                    }`}
                                                    onClick={() => handleToggleRole(role.role_code)}
                                                >
                                                    <Checkbox
                                                        checked={isChecked}
                                                        onCheckedChange={() => handleToggleRole(role.role_code)}
                                                    />
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <p className="font-semibold">{role.role_name}</p>
                                                            <Badge variant="outline" className="text-xs">
                                                                {role.role_code}
                                                            </Badge>
                                                        </div>
                                                        {role.description && (
                                                            <p className="text-sm text-gray-600 mt-1">
                                                                {role.description}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <div className="flex gap-3 pt-4 border-t">
                                        <Button
                                            variant="outline"
                                            onClick={() => {
                                                setSelectedUser(null);
                                                setSelectedRoles([]);
                                            }}
                                            className="flex-1"
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            onClick={handleSave}
                                            className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                                            disabled={updateUserRolesMutation.isPending}
                                        >
                                            <Save className="w-4 h-4 mr-2" />
                                            {updateUserRolesMutation.isPending ? 'Saving...' : 'Save Roles'}
                                        </Button>
                                    </div>
                                </>
                            )}
                        </div>
                    ) : (
                        <div className="text-center py-12">
                            <UsersIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                            <p className="text-gray-600">
                                Select a user from the left to assign roles
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>
            </div>
        </div>
    );
}
