import React, { useState } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/components/ui/use-toast";
import {
    AlertTriangle, CheckCircle2, Edit2, Save, X,
    TrendingUp, Users, ShieldAlert, ShieldCheck, Search
} from "lucide-react";

function UtilizationBar({ used, limit }) {
    if (!limit || limit === 0) return <span className="text-xs text-gray-400">No limit set</span>;
    const pct = Math.min((used / limit) * 100, 100);
    const color = pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-emerald-500";
    return (
        <div className="space-y-1">
            <div className="w-full bg-gray-100 rounded-full h-2">
                <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
            </div>
            <div className="flex justify-between text-xs text-gray-500">
                <span>LKR {(used || 0).toLocaleString()}</span>
                <span className={pct >= 100 ? "text-red-600 font-bold" : ""}>{pct.toFixed(0)}%</span>
                <span>LKR {limit.toLocaleString()}</span>
            </div>
        </div>
    );
}

function CreditStatusBadge({ used, limit }) {
    if (!limit || limit === 0) return <Badge className="bg-gray-100 text-gray-600">No Limit</Badge>;
    const pct = (used / limit) * 100;
    if (pct >= 100) return <Badge className="bg-red-100 text-red-700 border border-red-200">Over Limit</Badge>;
    if (pct >= 80) return <Badge className="bg-amber-100 text-amber-700 border border-amber-200">Near Limit</Badge>;
    return <Badge className="bg-green-100 text-green-700 border border-green-200">Good Standing</Badge>;
}

export default function CreditLimitManager() {
    const [editingId, setEditingId] = useState(null);
    const [editValues, setEditValues] = useState({});
    const [searchTerm, setSearchTerm] = useState("");
    const [filterStatus, setFilterStatus] = useState("all");
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const { data: customers = [], isLoading } = useQuery({
        queryKey: ['customersCredit'],
        queryFn: () => matrixSales.entities.Customer.list(),
        initialData: []
    });

    const { data: orders = [] } = useQuery({
        queryKey: ['salesOrdersCredit'],
        queryFn: () => matrixSales.entities.SalesOrder.filter({ status: 'invoiced' }),
        initialData: []
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }) => matrixSales.entities.Customer.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['customersCredit'] });
            setEditingId(null);
            toast({ title: "Credit limit updated successfully" });
        }
    });

    // Compute outstanding per customer from open sales orders
    const getOutstanding = (customerName) => {
        return orders
            .filter(o => o.customer_name === customerName)
            .reduce((s, o) => s + (o.total_amount || 0), 0);
    };

    const handleEdit = (customer) => {
        setEditingId(customer.id);
        setEditValues({
            credit_limit: customer.credit_limit || 0,
            outstanding_balance: customer.outstanding_balance || 0,
            payment_terms: customer.payment_terms || 'net_30'
        });
    };

    const handleSave = (customer) => {
        updateMutation.mutate({
            id: customer.id,
            data: {
                credit_limit: parseFloat(editValues.credit_limit) || 0,
                outstanding_balance: parseFloat(editValues.outstanding_balance) || 0,
                payment_terms: editValues.payment_terms
            }
        });
    };

    const handleBlock = (customer) => {
        updateMutation.mutate({
            id: customer.id,
            data: { status: customer.status === 'blocked' ? 'active' : 'blocked' }
        });
    };

    const filtered = customers.filter(c => {
        const matchSearch = !searchTerm ||
            c.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.customer_code?.toLowerCase().includes(searchTerm.toLowerCase());

        const used = c.outstanding_balance || 0;
        const limit = c.credit_limit || 0;
        const pct = limit > 0 ? (used / limit) * 100 : 0;

        if (filterStatus === "over") return matchSearch && pct >= 100;
        if (filterStatus === "near") return matchSearch && pct >= 80 && pct < 100;
        if (filterStatus === "good") return matchSearch && pct < 80;
        if (filterStatus === "blocked") return matchSearch && c.status === 'blocked';
        return matchSearch;
    });

    // Summary stats
    const overLimit = customers.filter(c => c.credit_limit > 0 && (c.outstanding_balance || 0) >= c.credit_limit).length;
    const nearLimit = customers.filter(c => {
        const pct = c.credit_limit > 0 ? ((c.outstanding_balance || 0) / c.credit_limit) * 100 : 0;
        return pct >= 80 && pct < 100;
    }).length;
    const blocked = customers.filter(c => c.status === 'blocked').length;
    const totalExposure = customers.reduce((s, c) => s + (c.outstanding_balance || 0), 0);

    if (isLoading) return <div className="py-12 text-center text-gray-400">Loading customer credit data…</div>;

    return (
        <div className="space-y-4">
            {/* Summary stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card className="border-red-100">
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="bg-red-100 p-2 rounded-lg"><ShieldAlert className="w-5 h-5 text-red-600" /></div>
                        <div>
                            <p className="text-2xl font-bold text-red-700">{overLimit}</p>
                            <p className="text-xs text-gray-500">Over Credit Limit</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-amber-100">
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="bg-amber-100 p-2 rounded-lg"><AlertTriangle className="w-5 h-5 text-amber-600" /></div>
                        <div>
                            <p className="text-2xl font-bold text-amber-700">{nearLimit}</p>
                            <p className="text-xs text-gray-500">Near Limit (≥80%)</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-gray-100">
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="bg-gray-100 p-2 rounded-lg"><Users className="w-5 h-5 text-gray-600" /></div>
                        <div>
                            <p className="text-2xl font-bold text-gray-700">{blocked}</p>
                            <p className="text-xs text-gray-500">Blocked Accounts</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-blue-100">
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="bg-blue-100 p-2 rounded-lg"><TrendingUp className="w-5 h-5 text-blue-600" /></div>
                        <div>
                            <p className="text-2xl font-bold text-blue-700">LKR {(totalExposure / 1000).toFixed(0)}K</p>
                            <p className="text-xs text-gray-500">Total Exposure</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {overLimit > 0 && (
                <Alert className="bg-red-50 border-red-200">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-red-800">
                        <strong>{overLimit} customer{overLimit > 1 ? 's' : ''}</strong> {overLimit > 1 ? 'have' : 'has'} exceeded their credit limit. New orders will be automatically placed on hold.
                    </AlertDescription>
                </Alert>
            )}

            {/* Filters */}
            <div className="flex flex-wrap gap-2 items-center">
                <div className="relative flex-1 max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                        placeholder="Search customers…"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="pl-9 h-9 text-sm"
                    />
                </div>
                {[
                    { key: "all", label: "All" },
                    { key: "over", label: "Over Limit" },
                    { key: "near", label: "Near Limit" },
                    { key: "good", label: "Good Standing" },
                    { key: "blocked", label: "Blocked" },
                ].map(f => (
                    <button key={f.key} onClick={() => setFilterStatus(f.key)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${filterStatus === f.key ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-400'}`}>
                        {f.label}
                    </button>
                ))}
            </div>

            {/* Customer credit table */}
            <div className="space-y-3">
                {filtered.length === 0 && (
                    <div className="text-center py-10 text-gray-400">No customers match your filter</div>
                )}
                {filtered.map(customer => {
                    const isEditing = editingId === customer.id;
                    const used = customer.outstanding_balance || 0;
                    const limit = customer.credit_limit || 0;
                    const available = Math.max(0, limit - used);

                    return (
                        <Card key={customer.id} className={`transition-all ${customer.status === 'blocked' ? 'border-red-200 bg-red-50/30' : used >= limit && limit > 0 ? 'border-amber-200 bg-amber-50/20' : ''}`}>
                            <CardContent className="p-4">
                                <div className="flex items-start gap-4">
                                    {/* Customer info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <p className="font-bold text-gray-900">{customer.customer_name}</p>
                                            <span className="text-xs text-gray-400 font-mono">{customer.customer_code}</span>
                                            <CreditStatusBadge used={used} limit={limit} />
                                            {customer.status === 'blocked' && <Badge className="bg-red-100 text-red-700">Blocked</Badge>}
                                        </div>
                                        <p className="text-xs text-gray-500 mb-3">
                                            {customer.contact_person} · {customer.payment_terms?.replace('_', ' ').toUpperCase()} · {customer.city}
                                        </p>

                                        {/* Utilization bar */}
                                        <UtilizationBar used={used} limit={limit} />
                                    </div>

                                    {/* Credit figures */}
                                    {isEditing ? (
                                        <div className="flex items-end gap-2 shrink-0">
                                            <div className="space-y-1">
                                                <label className="text-xs text-gray-500">Credit Limit (LKR)</label>
                                                <Input
                                                    type="number"
                                                    value={editValues.credit_limit}
                                                    onChange={e => setEditValues(v => ({ ...v, credit_limit: e.target.value }))}
                                                    className="h-8 w-36 text-sm"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs text-gray-500">Outstanding (LKR)</label>
                                                <Input
                                                    type="number"
                                                    value={editValues.outstanding_balance}
                                                    onChange={e => setEditValues(v => ({ ...v, outstanding_balance: e.target.value }))}
                                                    className="h-8 w-36 text-sm"
                                                />
                                            </div>
                                            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 h-8" onClick={() => handleSave(customer)} disabled={updateMutation.isPending}>
                                                <Save className="w-3.5 h-3.5 mr-1" /> Save
                                            </Button>
                                            <Button size="sm" variant="outline" className="h-8" onClick={() => setEditingId(null)}>
                                                <X className="w-3.5 h-3.5" />
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="flex items-start gap-6 shrink-0 text-right">
                                            <div>
                                                <p className="text-xs text-gray-400">Credit Limit</p>
                                                <p className="text-base font-bold text-gray-800">LKR {limit.toLocaleString()}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-400">Outstanding</p>
                                                <p className={`text-base font-bold ${used >= limit && limit > 0 ? 'text-red-600' : 'text-gray-800'}`}>LKR {used.toLocaleString()}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-400">Available</p>
                                                <p className={`text-base font-bold ${available === 0 ? 'text-red-600' : 'text-emerald-600'}`}>LKR {available.toLocaleString()}</p>
                                            </div>
                                            <div className="flex flex-col gap-1 mt-1">
                                                <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => handleEdit(customer)}>
                                                    <Edit2 className="w-3 h-3" /> Edit
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className={`h-8 text-xs gap-1 ${customer.status === 'blocked' ? 'text-emerald-600 border-emerald-200 hover:bg-emerald-50' : 'text-red-600 border-red-200 hover:bg-red-50'}`}
                                                    onClick={() => handleBlock(customer)}
                                                    disabled={updateMutation.isPending}
                                                >
                                                    {customer.status === 'blocked'
                                                        ? <><ShieldCheck className="w-3 h-3" /> Unblock</>
                                                        : <><ShieldAlert className="w-3 h-3" /> Block</>
                                                    }
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}