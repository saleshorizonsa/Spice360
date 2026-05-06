import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserCog, Search, Shield, Save, Users as UsersIcon } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { logAuditTrail } from "../utils/auditTrail";

export default function UserRoleAssignment() {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedUser, setSelectedUser] = useState(null);
    const [selectedRoles, setSelectedRoles] = useState([]);
    const [currentUser, setCurrentUser] = useState(null);
    const queryClient = useQueryClient();
    const { toast } = useToast();

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const user = await base44.auth.me();
                setCurrentUser(user);
            } catch (error) {
                console.error('Error fetching user:', error);
            }
        };
        fetchUser();
    }, []);

    const { data: users = [] } = useQuery({
        queryKey: ['users'],
        queryFn: () => base44.entities.User.list(),
        initialData: []
    });

    const { data: roles = [] } = useQuery({
        queryKey: ['roles'],
        queryFn: () => base44.entities.Role.filter({ status: 'active' }),
        initialData: []
    });

    const updateUserRolesMutation = useMutation({
        mutationFn: async ({ userId, roleCodes }) => {
            const beforeData = selectedUser;
            
            const updated = await base44.entities.User.update(userId, {
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

    return (
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
                        {filteredUsers.map(user => {
                            const isSelected = selectedUser?.id === user.id;
                            const roleCount = user.assigned_roles?.length || 0;
                            
                            return (
                                <div
                                    key={user.id}
                                    onClick={() => handleSelectUser(user)}
                                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                                        isSelected 
                                            ? 'bg-emerald-50 border-emerald-300' 
                                            : 'hover:bg-gray-50'
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                            <p className="font-semibold">{user.full_name}</p>
                                            <p className="text-sm text-gray-600">{user.email}</p>
                                            {user.employee_number && (
                                                <p className="text-xs text-gray-500">
                                                    Emp #: {user.employee_number}
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            {user.role === 'admin' ? (
                                                <Badge className="bg-purple-600">Admin</Badge>
                                            ) : (
                                                <Badge variant="outline">
                                                    {roleCount} role{roleCount !== 1 ? 's' : ''}
                                                </Badge>
                                            )}
                                            {user.is_active === false && (
                                                <Badge variant="secondary">Inactive</Badge>
                                            )}
                                        </div>
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
    );
}