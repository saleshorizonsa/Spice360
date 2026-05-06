import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
    AlertTriangle,
    CheckCircle,
    FileText
} from "lucide-react";
import DataTable from "../erp/DataTable";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

export default function NumberRangeManager() {
    const [editingSeries, setEditingSeries] = useState(null);
    const [showResetDialog, setShowResetDialog] = useState(false);
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const { data: series = [] } = useQuery({
        queryKey: ['documentSeries'],
        queryFn: () => base44.entities.DocumentNumberSeries.list(),
        initialData: []
    });

    // Group by document type for better organization
    const seriesByType = series.reduce((acc, s) => {
        if (!acc[s.document_type]) acc[s.document_type] = [];
        acc[s.document_type].push(s);
        return acc;
    }, {});

    const updateMutation = useMutation({
        mutationFn: ({ id, data }) => base44.entities.DocumentNumberSeries.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['documentSeries'] });
            toast({
                title: "Success",
                description: "Number series updated successfully"
            });
            setEditingSeries(null);
        }
    });

    const resetMutation = useMutation({
        mutationFn: ({ id }) => {
            const seriesData = series.find(s => s.id === id);
            return base44.entities.DocumentNumberSeries.update(id, {
                ...seriesData,
                current_number: seriesData.starting_number || 1
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['documentSeries'] });
            toast({
                title: "Success",
                description: "Number series reset successfully"
            });
            setShowResetDialog(false);
        }
    });

    const getBadgeColor = (value) => {
        const colors = {
            active: "bg-green-100 text-green-800",
            inactive: "bg-gray-100 text-gray-800",
            exhausted: "bg-red-100 text-red-800"
        };
        return colors[value] || "bg-gray-100 text-gray-800";
    };

    const columns = [
        { header: "Prefix", key: "prefix" },
        { header: "Branch", key: "branch_code" },
        { header: "FY", key: "fiscal_year" },
        { header: "Current #", key: "current_number" },
        { header: "Last Generated", key: "last_generated_number" },
        { header: "Example", key: "example_number" },
        { 
            header: "Continuous", 
            key: "continuous_series", 
            render: (val) => val ? <CheckCircle className="w-4 h-4 text-green-600" /> : null 
        },
        { 
            header: "Legal", 
            key: "legal_requirement", 
            render: (val) => val ? <AlertTriangle className="w-4 h-4 text-amber-600" /> : null 
        },
        { header: "Status", key: "status", isBadge: true }
    ];

    const handleEdit = (item) => {
        setEditingSeries(item);
    };

    const handleReset = (item) => {
        if (confirm(`Reset ${item.prefix} series for ${item.branch_code}? Current number will go back to ${item.starting_number || 1}.`)) {
            resetMutation.mutate({ id: item.id });
        }
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="p-6">
                        <div className="text-2xl font-bold">{series.length}</div>
                        <div className="text-sm text-gray-600">Total Series</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-6">
                        <div className="text-2xl font-bold text-green-600">
                            {series.filter(s => s.status === 'active').length}
                        </div>
                        <div className="text-sm text-gray-600">Active</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-6">
                        <div className="text-2xl font-bold text-amber-600">
                            {series.filter(s => s.continuous_series).length}
                        </div>
                        <div className="text-sm text-gray-600">Continuous</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-6">
                        <div className="text-2xl font-bold text-red-600">
                            {series.filter(s => s.legal_requirement).length}
                        </div>
                        <div className="text-sm text-gray-600">Legal Required</div>
                    </CardContent>
                </Card>
            </div>

            <Alert className="bg-blue-50 border-blue-200">
                <FileText className="w-4 h-4 text-blue-600" />
                <AlertDescription className="text-blue-900">
                    <strong>Number Range Format:</strong> {'{PREFIX}-{BR}-{FY}-{NNNNNN}'}<br/>
                    • Continuous series (invoices, master data) don't include FY<br/>
                    • Reserved numbers (canceled docs) are never reused<br/>
                    • Series reset annually at fiscal year end (except continuous)
                </AlertDescription>
            </Alert>

            {Object.entries(seriesByType).map(([docType, seriesList]) => (
                <Card key={docType}>
                    <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                            <span className="capitalize">{docType.replace(/_/g, ' ')}</span>
                            <Badge>{seriesList.length} series</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <DataTable
                            data={seriesList}
                            columns={columns}
                            getBadgeColor={getBadgeColor}
                            onEdit={handleEdit}
                        />
                    </CardContent>
                </Card>
            ))}

            {editingSeries && (
                <EditSeriesDialog
                    series={editingSeries}
                    onClose={() => setEditingSeries(null)}
                    onSave={(data) => updateMutation.mutate({ id: editingSeries.id, data })}
                />
            )}
        </div>
    );
}

function EditSeriesDialog({ series, onClose, onSave }) {
    const [formData, setFormData] = useState(series);

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Edit Number Series: {series.prefix}-{series.branch_code}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Current Number</Label>
                            <Input
                                type="number"
                                value={formData.current_number}
                                onChange={(e) => setFormData({...formData, current_number: parseInt(e.target.value)})}
                                min={formData.starting_number}
                                max={formData.max_number}
                            />
                        </div>
                        <div>
                            <Label>Status</Label>
                            <Select
                                value={formData.status}
                                onValueChange={(val) => setFormData({...formData, status: val})}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="inactive">Inactive</SelectItem>
                                    <SelectItem value="exhausted">Exhausted</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="flex items-center justify-between">
                        <Label>Auto Generate</Label>
                        <Switch
                            checked={formData.auto_generate}
                            onCheckedChange={(checked) => setFormData({...formData, auto_generate: checked})}
                        />
                    </div>

                    <div className="flex items-center justify-between">
                        <Label>Allow Manual Override</Label>
                        <Switch
                            checked={formData.allow_manual_override}
                            onCheckedChange={(checked) => setFormData({...formData, allow_manual_override: checked})}
                        />
                    </div>

                    <div>
                        <Label>Notes</Label>
                        <Input
                            value={formData.notes}
                            onChange={(e) => setFormData({...formData, notes: e.target.value})}
                        />
                    </div>

                    <div className="flex justify-end gap-3 border-t pt-4">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                            Save Changes
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}