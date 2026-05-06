import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Shield, Users } from "lucide-react";
import DataTable from "../erp/DataTable";
import RoleForm from "./RoleForm";
import { useToast } from "@/components/ui/use-toast";

export default function RoleManagement() {
    const [showDialog, setShowDialog] = useState(false);
    const [editingRole, setEditingRole] = useState(null);
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const { data: roles = [] } = useQuery({
        queryKey: ['roles'],
        queryFn: () => base44.entities.Role.list(),
        initialData: []
    });

    const { data: users = [] } = useQuery({
        queryKey: ['users'],
        queryFn: () => base44.entities.User.list(),
        initialData: []
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => base44.entities.Role.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['roles'] });
            toast({
                title: "Success",
                description: "Role deleted successfully",
            });
        },
        onError: () => {
            toast({
                title: "Error",
                description: "Cannot delete role - it may be in use",
                variant: "destructive"
            });
        }
    });

    // Count users per role
    const getUserCountByRole = (roleCode) => {
        return users.filter(u => 
            u.assigned_roles && u.assigned_roles.includes(roleCode)
        ).length;
    };

    const columns = [
        { header: "Role Code", key: "role_code" },
        { header: "Role Name", key: "role_name" },
        { 
            header: "Users", 
            key: "role_code",
            render: (roleCode) => {
                const count = getUserCountByRole(roleCode);
                return (
                    <Badge variant="outline">
                        <Users className="w-3 h-3 mr-1" />
                        {count}
                    </Badge>
                );
            }
        },
        { header: "Status", key: "status", isBadge: true },
        {
            header: "System Role",
            key: "is_system_role",
            render: (val) => val ? <Badge>System</Badge> : null
        }
    ];

    const getBadgeColor = (value) => {
        const colors = {
            active: "bg-green-100 text-green-800",
            inactive: "bg-gray-100 text-gray-800"
        };
        return colors[value] || "bg-gray-100 text-gray-800";
    };

    const handleCreate = () => {
        setEditingRole(null);
        setShowDialog(true);
    };

    const handleEdit = (role) => {
        setEditingRole(role);
        setShowDialog(true);
    };

    const handleDelete = (role) => {
        if (role.is_system_role) {
            toast({
                title: "Cannot Delete",
                description: "System roles cannot be deleted",
                variant: "destructive"
            });
            return;
        }

        const userCount = getUserCountByRole(role.role_code);
        if (userCount > 0) {
            toast({
                title: "Cannot Delete",
                description: `This role is assigned to ${userCount} user(s). Please reassign them first.`,
                variant: "destructive"
            });
            return;
        }

        if (confirm(`Delete role "${role.role_name}"?`)) {
            deleteMutation.mutate(role.id);
        }
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <Shield className="w-5 h-5 text-emerald-600" />
                            Role Management
                        </CardTitle>
                        <p className="text-sm text-gray-600 mt-1">
                            Define roles and configure permissions for system access
                        </p>
                    </div>
                    <Button 
                        onClick={handleCreate}
                        className="bg-emerald-600 hover:bg-emerald-700"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        New Role
                    </Button>
                </CardHeader>
                <CardContent>
                    <DataTable
                        data={roles}
                        columns={columns}
                        searchFields={["role_code", "role_name", "description"]}
                        getBadgeColor={getBadgeColor}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                    />
                </CardContent>
            </Card>

            {showDialog && (
                <RoleForm 
                    item={editingRole} 
                    onClose={() => {
                        setShowDialog(false);
                        setEditingRole(null);
                    }} 
                />
            )}
        </div>
    );
}