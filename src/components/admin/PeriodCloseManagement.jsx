import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Calendar, Lock, RotateCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { matrixSales } from "@/api/matrixSalesClient";
import DataTable from "@/components/erp/DataTable";

const moduleOptions = [
    { value: "all", label: "All Modules" },
    { value: "finance", label: "Finance" },
    { value: "sales", label: "Sales" },
    { value: "purchasing", label: "Purchasing" },
    { value: "inventory", label: "Inventory" },
    { value: "operations", label: "Operations" },
    { value: "hr", label: "HR" },
    { value: "compliance", label: "Compliance" }
];

const getCurrentMonth = () => new Date().toISOString().slice(0, 7);

const getPeriodDates = (periodKey) => {
    const [year, month] = periodKey.split("-").map(Number);
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 0));
    return {
        period_start: start.toISOString().slice(0, 10),
        period_end: end.toISOString().slice(0, 10)
    };
};

const getModuleLabel = (value) =>
    moduleOptions.find((option) => option.value === value)?.label || value || "-";

const getBadgeColor = (status) => {
    const classes = {
        closed: "bg-red-100 text-red-800",
        open: "bg-emerald-100 text-emerald-800"
    };
    return classes[status] || "bg-slate-100 text-slate-800";
};

const loadPeriodCloses = async () => {
    try {
        return await matrixSales.entities.PeriodClose.list("-period_start");
    } catch (error) {
        if (/period_close|does not exist|not found/i.test(error.message || "")) {
            return [];
        }
        throw error;
    }
};

export default function PeriodCloseManagement() {
    const [moduleName, setModuleName] = useState("finance");
    const [periodKey, setPeriodKey] = useState(getCurrentMonth());
    const [notes, setNotes] = useState("");
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const { data: periodCloses = [], isLoading, error } = useQuery({
        queryKey: ["period-closes"],
        queryFn: loadPeriodCloses,
        initialData: []
    });

    const closedPeriods = useMemo(
        () => periodCloses.filter((period) => period.status === "closed"),
        [periodCloses]
    );

    const closeMutation = useMutation({
        mutationFn: async () => {
            const user = await matrixSales.auth.me().catch(() => null);
            const periodDates = getPeriodDates(periodKey);
            const existing = await matrixSales.entities.PeriodClose.filter({
                period_key: periodKey,
                module: moduleName
            });
            const payload = {
                period_key: periodKey,
                period_name: `${getModuleLabel(moduleName)} ${periodKey}`,
                module: moduleName,
                ...periodDates,
                status: "closed",
                closed_at: new Date().toISOString(),
                closed_by: user?.email || "system@horizon.local",
                notes
            };

            if (existing.length > 0) {
                return matrixSales.entities.PeriodClose.update(existing[0].id, {
                    ...existing[0],
                    ...payload
                });
            }
            return matrixSales.entities.PeriodClose.create(payload);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["period-closes"] });
            toast({
                title: "Period closed",
                description: `${getModuleLabel(moduleName)} ${periodKey} is now locked for posting changes.`
            });
        },
        onError: (mutationError) => {
            toast({
                title: "Unable to close period",
                description: mutationError.message || "Run the period_close migration, then try again.",
                variant: "destructive"
            });
        }
    });

    const reopenMutation = useMutation({
        mutationFn: async (period) => {
            const user = await matrixSales.auth.me().catch(() => null);
            return matrixSales.entities.PeriodClose.update(period.id, {
                ...period,
                status: "open",
                reopened_at: new Date().toISOString(),
                reopened_by: user?.email || "system@horizon.local"
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["period-closes"] });
            toast({
                title: "Period reopened",
                description: "Transactions in this period can be changed again."
            });
        },
        onError: (mutationError) => {
            toast({
                title: "Unable to reopen period",
                description: mutationError.message || "Please try again.",
                variant: "destructive"
            });
        }
    });

    return (
        <div className="space-y-4">
            <Alert className="border-amber-200 bg-amber-50">
                <AlertTriangle className="h-4 w-4 text-amber-700" />
                <AlertTitle>Financial control</AlertTitle>
                <AlertDescription>
                    Closed periods block create, update, and delete actions for dated business transactions. Posted,
                    cleared, paid, reported, completed, cancelled, and reversed records are also locked.
                </AlertDescription>
            </Alert>

            <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Calendar className="h-5 w-5 text-red-600" />
                            Close Period
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>Module</Label>
                            <Select value={moduleName} onValueChange={setModuleName}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select module" />
                                </SelectTrigger>
                                <SelectContent>
                                    {moduleOptions.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Period</Label>
                            <Input
                                type="month"
                                value={periodKey}
                                onChange={(event) => setPeriodKey(event.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Notes</Label>
                            <Textarea
                                value={notes}
                                onChange={(event) => setNotes(event.target.value)}
                                placeholder="Month-end close reference, approvals, or exception notes"
                                rows={4}
                            />
                        </div>

                        <Button
                            onClick={() => closeMutation.mutate()}
                            disabled={!periodKey || closeMutation.isPending}
                            className="w-full bg-red-600 hover:bg-red-700"
                        >
                            <Lock className="mr-2 h-4 w-4" />
                            {closeMutation.isPending ? "Closing..." : "Close Period"}
                        </Button>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center justify-between gap-3">
                            <span>Period Status</span>
                            <Badge variant="outline">{closedPeriods.length} Closed</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <DataTable
                            data={periodCloses}
                            columns={[
                                { header: "Period", key: "period_key" },
                                {
                                    header: "Module",
                                    key: "module",
                                    render: (value) => getModuleLabel(value)
                                },
                                { header: "Start", key: "period_start" },
                                { header: "End", key: "period_end" },
                                {
                                    header: "Status",
                                    key: "status",
                                    render: (value) => (
                                        <Badge className={getBadgeColor(value)}>{value || "open"}</Badge>
                                    )
                                },
                                { header: "Closed By", key: "closed_by" },
                                {
                                    header: "Actions",
                                    key: "actions",
                                    sortable: false,
                                    render: (_value, row) => (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            disabled={row.status !== "closed" || reopenMutation.isPending}
                                            onClick={() => reopenMutation.mutate(row)}
                                        >
                                            <RotateCcw className="mr-2 h-4 w-4" />
                                            Reopen
                                        </Button>
                                    )
                                }
                            ]}
                            searchFields={["period_key", "module", "status", "closed_by", "notes"]}
                            itemsPerPage={15}
                            enableSorting={true}
                        />
                        {isLoading && <p className="mt-3 text-sm text-slate-500">Loading period controls...</p>}
                        {error && (
                            <p className="mt-3 text-sm text-red-600">
                                Period close records could not be loaded. Run the new Supabase migration first.
                            </p>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
