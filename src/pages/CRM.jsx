
import React, { useState } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus, Users, Target, TrendingUp, Phone, AlertCircle } from "lucide-react";
import DataTable from "../components/erp/DataTable";
import LeadForm from "../components/crm/LeadForm";
import OpportunityForm from "../components/crm/OpportunityForm";
import ActivityForm from "../components/crm/ActivityForm";
import { useToast } from "@/components/ui/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { useLanguage } from "../components/utils/languageContext";

export default function CRM() {
    const [activeTab, setActiveTab] = useState("pipeline");
    const [showDialog, setShowDialog] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { t } = useLanguage();

    const { data: leads = [] } = useQuery({
        queryKey: ['leads'],
        queryFn: () => matrixSales.entities.Lead.list('-lead_date'),
        initialData: []
    });

    const { data: opportunities = [] } = useQuery({
        queryKey: ['opportunities'],
        queryFn: () => matrixSales.entities.Opportunity.list('-opportunity_date'),
        initialData: []
    });

    const { data: activities = [] } = useQuery({
        queryKey: ['activities'],
        queryFn: () => matrixSales.entities.Activity.list('-activity_date'),
        initialData: []
    });

    const { data: contacts = [] } = useQuery({
        queryKey: ['contacts'],
        queryFn: () => matrixSales.entities.Contact.list(),
        initialData: []
    });

    // KPI Calculations
    const openLeads = leads.filter(l => l.status === 'open' || l.status === 'contacted').length;
    const qualifiedLeads = leads.filter(l => l.qualification_status === 'qualified').length;
    const conversionRate = leads.length > 0 ? Math.round((leads.filter(l => l.converted_to_opportunity).length / leads.length) * 100) : 0;

    const openOpportunities = opportunities.filter(o => o.status === 'open').length;
    const pipelineValue = opportunities.filter(o => o.status === 'open').reduce((sum, o) => sum + (o.estimated_value || 0), 0);
    const weightedPipeline = opportunities.filter(o => o.status === 'open').reduce((sum, o) => sum + (o.weighted_value || 0), 0);

    const wonOpportunities = opportunities.filter(o => o.status === 'won').length;
    const lostOpportunities = opportunities.filter(o => o.status === 'lost').length;
    const closedTotal = wonOpportunities + lostOpportunities;
    const winRate = closedTotal > 0 ? Math.round((wonOpportunities / closedTotal) * 100) : 0;

    const wonRevenue = opportunities.filter(o => o.status === 'won').reduce((sum, o) => sum + (o.actual_revenue || 0), 0);

    const avgCycleDays = opportunities.filter(o => o.cycle_days && o.cycle_days > 0).reduce((sum, o, _, arr) => 
        sum + o.cycle_days / arr.length, 0
    );

    const overdueActivities = activities.filter(a => 
        !a.is_completed && 
        new Date(a.activity_date) < new Date()
    ).length;

    const todayActivities = activities.filter(a =>
        !a.is_completed &&
        new Date(a.activity_date).toDateString() === new Date().toDateString()
    ).length;

    // Pipeline by Stage
    const pipelineByStage = [
        { stage: 'Qualification', value: opportunities.filter(o => o.stage === 'qualification' && o.status === 'open').reduce((sum, o) => sum + (o.estimated_value || 0), 0) / 1000 },
        { stage: 'Needs Analysis', value: opportunities.filter(o => o.stage === 'needs_analysis' && o.status === 'open').reduce((sum, o) => sum + (o.estimated_value || 0), 0) / 1000 },
        { stage: 'Proposal', value: opportunities.filter(o => o.stage === 'proposal' && o.status === 'open').reduce((sum, o) => sum + (o.estimated_value || 0), 0) / 1000 },
        { stage: 'Negotiation', value: opportunities.filter(o => o.stage === 'negotiation' && o.status === 'open').reduce((sum, o) => sum + (o.estimated_value || 0), 0) / 1000 }
    ];

    // Win/Loss Distribution
    const winLossData = [
        { name: 'Won', value: wonOpportunities },
        { name: 'Lost', value: lostOpportunities }
    ];

    const COLORS = ['#10b981', '#ef4444'];

    const deleteMutation = useMutation({
        mutationFn: ({ entity, id }) => matrixSales.entities[entity].delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries();
            toast({
                title: t('success'),
                description: t('deletedSuccessfully')
            });
        }
    });

    const getBadgeColor = (value) => {
        const colors = {
            new: "bg-blue-100 text-blue-800",
            open: "bg-blue-100 text-blue-800",
            contacted: "bg-yellow-100 text-yellow-800",
            qualified: "bg-green-100 text-green-800",
            unqualified: "bg-gray-100 text-gray-800",
            disqualified: "bg-red-100 text-red-800",
            converted: "bg-emerald-100 text-emerald-800",
            lost: "bg-red-100 text-red-800",
            closed: "bg-gray-100 text-gray-800",
            qualification: "bg-blue-100 text-blue-800",
            needs_analysis: "bg-yellow-100 text-yellow-800",
            proposal: "bg-orange-100 text-orange-800",
            negotiation: "bg-purple-100 text-purple-800",
            closed_won: "bg-green-100 text-green-800",
            closed_lost: "bg-red-100 text-red-800",
            won: "bg-green-100 text-green-800",
            abandoned: "bg-gray-100 text-gray-800",
            scheduled: "bg-blue-100 text-blue-800",
            completed: "bg-green-100 text-green-800",
            cancelled: "bg-red-100 text-red-800",
            overdue: "bg-red-100 text-red-800",
            call: "bg-blue-100 text-blue-800",
            meeting: "bg-purple-100 text-purple-800",
            email: "bg-green-100 text-green-800",
            whatsapp: "bg-emerald-100 text-emerald-800",
            low: "bg-green-100 text-green-800",
            medium: "bg-yellow-100 text-yellow-800",
            high: "bg-orange-100 text-orange-800",
            urgent: "bg-red-100 text-red-800"
        };
        return colors[value] || "bg-gray-100 text-gray-800";
    };

    const leadColumns = [
        { header: "Lead #", key: "lead_number" },
        { header: t('date'), key: "lead_date" },
        { header: t('company'), key: "company_name" },
        { header: t('contact'), key: "contact_person" },
        { header: t('phone'), key: "phone" },
        { header: t('source'), key: "lead_source" },
        { header: t('value'), key: "estimated_value", render: (val) => `LKR ${val?.toLocaleString() || 0}` },
        { header: t('score'), key: "lead_score" },
        { header: t('assignedTo'), key: "assigned_to" },
        { header: t('qualification'), key: "qualification_status", isBadge: true },
        { header: t('status'), key: "status", isBadge: true }
    ];

    const opportunityColumns = [
        { header: "Opp #", key: "opportunity_number" },
        { header: t('name'), key: "opportunity_name" },
        { header: t('company'), key: "company_name" },
        { header: t('stage'), key: "stage", isBadge: true },
        { header: t('value'), key: "estimated_value", render: (val) => `LKR ${val?.toLocaleString() || 0}` },
        { header: t('probability'), key: "probability", render: (val) => `${val || 0}%` },
        { header: t('weighted'), key: "weighted_value", render: (val) => `LKR ${val?.toLocaleString() || 0}` },
        { header: t('closeDate'), key: "expected_close_date" },
        { header: t('assignedTo'), key: "assigned_to" },
        { header: t('status'), key: "status", isBadge: true }
    ];

    const activityColumns = [
        { header: "Activity #", key: "activity_number" },
        { header: t('type'), key: "activity_type", isBadge: true },
        { header: t('date'), key: "activity_date", render: (val) => new Date(val).toLocaleString() },
        { header: t('subject'), key: "subject" },
        { header: t('company'), key: "company_name" },
        { header: t('contact'), key: "contact_person" },
        { header: t('assignedTo'), key: "assigned_to" },
        { header: t('outcome'), key: "outcome" },
        { header: t('priority'), key: "priority", isBadge: true },
        { header: t('status'), key: "status", isBadge: true }
    ];

    const contactColumns = [
        { header: "Contact Code", key: "contact_code" },
        { header: t('name'), key: "full_name" },
        { header: t('company'), key: "company_name" },
        { header: t('jobTitle'), key: "job_title" },
        { header: t('role'), key: "role" },
        { header: t('email'), key: "email" },
        { header: t('phone'), key: "phone" },
        { header: t('mobile'), key: "mobile" },
        { header: t('primary'), key: "is_primary", render: (val) => val ? "✓" : "" },
        { header: t('status'), key: "status", isBadge: true }
    ];

    const handleCreate = (type) => {
        setEditingItem(null);
        setActiveTab(type);
        setShowDialog(true);
    };

    const handleEdit = (item, type) => {
        setEditingItem(item);
        setActiveTab(type);
        setShowDialog(true);
    };

    const handleDelete = (item, entity) => {
        if (confirm(t('areYouSure'))) {
            deleteMutation.mutate({ entity, id: item.id });
        }
    };

    const handlePrint = (item, type) => {
        const printWindow = window.open('', '_blank');
        let content = '';
        
        if (printWindow) {
            printWindow.document.write(`
                <html>
                    <head>
                        <title>${type} ${item[`${type.toLowerCase()}_number`] || item.activity_number || item.contact_code || 'Details'}</title>
                        <style>
                            body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
                            h1 { color: #059669; border-bottom: 2px solid #059669; padding-bottom: 10px; margin-bottom: 20px; }
                            h3 { color: #059669; margin-top: 20px; }
                            .section { margin: 15px 0; border: 1px solid #eee; padding: 15px; border-radius: 5px; background-color: #fcfcfc; }
                            p { margin: 5px 0; line-height: 1.5; }
                            strong { color: #555; }
                        </style>
                    </head>
                    <body>
                        <h1>${type} Information</h1>
                        <div class="section">
            `);
        }

        if (type === 'Lead') {
            content = `
                            <p><strong>Lead #:</strong> ${item.lead_number || 'N/A'}</p>
                            <p><strong>Lead Date:</strong> ${item.lead_date ? new Date(item.lead_date).toLocaleDateString() : 'N/A'}</p>
                            <p><strong>Company:</strong> ${item.company_name || 'N/A'}</p>
                            <p><strong>Contact Person:</strong> ${item.contact_person || 'N/A'}</p>
                            <p><strong>Job Title:</strong> ${item.job_title || 'N/A'}</p>
                            <p><strong>Email:</strong> ${item.email || 'N/A'}</p>
                            <p><strong>Phone:</strong> ${item.phone || 'N/A'}</p>
                            <p><strong>Industry:</strong> ${item.industry || 'N/A'}</p>
                            <p><strong>Lead Source:</strong> ${item.lead_source || 'N/A'}</p>
                            <p><strong>Estimated Value:</strong> LKR ${item.estimated_value?.toLocaleString() || 0}</p>
                            <p><strong>Assigned To:</strong> ${item.assigned_to || 'N/A'}</p>
                            <p><strong>Qualification Status:</strong> ${item.qualification_status || 'N/A'}</p>
                            <p><strong>Status:</strong> ${item.status || 'N/A'}</p>
                        </div>
                        <div class="section">
                            <h3>Requirements:</h3>
                            <p>${item.requirements || 'N/A'}</p>
            `;
        } else if (type === 'Opportunity') {
            content = `
                            <p><strong>Opportunity #:</strong> ${item.opportunity_number || 'N/A'}</p>
                            <p><strong>Name:</strong> ${item.opportunity_name || 'N/A'}</p>
                            <p><strong>Company:</strong> ${item.company_name || 'N/A'}</p>
                            <p><strong>Contact:</strong> ${item.contact_person || 'N/A'}</p>
                            <p><strong>Email:</strong> ${item.email || 'N/A'}</p>
                            <p><strong>Phone:</strong> ${item.phone || 'N/A'}</p>
                        </div>
                        <div class="section">
                            <p><strong>Stage:</strong> ${item.stage || 'N/A'}</p>
                            <p><strong>Probability:</strong> ${item.probability || 0}%</p>
                            <p><strong>Estimated Value:</strong> LKR ${item.estimated_value?.toLocaleString() || 0}</p>
                            <p><strong>Weighted Value:</strong> LKR ${item.weighted_value?.toLocaleString() || 0}</p>
                            <p><strong>Expected Close Date:</strong> ${item.expected_close_date ? new Date(item.expected_close_date).toLocaleDateString() : 'N/A'}</p>
                            <p><strong>Assigned To:</strong> ${item.assigned_to || 'N/A'}</p>
                            <p><strong>Status:</strong> ${item.status || 'N/A'}</p>
                        </div>
                        <div class="section">
                            <h3>Products/Services:</h3>
                            <p>${item.products || 'N/A'}</p>
                        </div>
                        <div class="section">
                            <h3>Proposed Solution:</h3>
                            <p>${item.proposed_solution || 'N/A'}</p>
            `;
        } else if (type === 'Activity') {
            content = `
                            <p><strong>Activity #:</strong> ${item.activity_number || 'N/A'}</p>
                            <p><strong>Type:</strong> ${item.activity_type || 'N/A'}</p>
                            <p><strong>Date:</strong> ${item.activity_date ? new Date(item.activity_date).toLocaleString() : 'N/A'}</p>
                            <p><strong>Duration:</strong> ${item.duration_minutes ? `${item.duration_minutes} minutes` : 'N/A'}</p>
                            <p><strong>Company:</strong> ${item.company_name || 'N/A'}</p>
                            <p><strong>Contact Person:</strong> ${item.contact_person || 'N/A'}</p>
                            <p><strong>Subject:</strong> ${item.subject || 'N/A'}</p>
                        </div>
                        <div class="section">
                            <h3>Description:</h3>
                            <p>${item.description || 'N/A'}</p>
                        </div>
                        <div class="section">
                            <p><strong>Outcome:</strong> ${item.outcome || 'N/A'}</p>
                            <p><strong>Next Action:</strong> ${item.next_action || 'N/A'}</p>
                            <p><strong>Priority:</strong> ${item.priority || 'N/A'}</p>
                            <p><strong>Status:</strong> ${item.status || 'N/A'}</p>
                            <p><strong>Assigned To:</strong> ${item.assigned_to || 'N/A'}</p>
            `;
        }
        
        if (printWindow) {
            printWindow.document.write(content);
            printWindow.document.write(`
                        </div>
                    </body>
                </html>
            `);
            printWindow.document.close();
            printWindow.print();
        } else {
            alert('Please allow pop-ups for printing.');
        }
    };

    const handleCloseDialog = () => {
        setShowDialog(false);
        setEditingItem(null);
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">{t('crm')}</h1>
                    <p className="text-gray-600 mt-1">Leads, Opportunities, Activities & Sales Pipeline</p>
                </div>
            </div>

            {(overdueActivities > 0 || todayActivities > 0) && (
                <div className="space-y-2">
                    {overdueActivities > 0 && (
                        <Alert className="bg-red-50 border-red-200">
                            <AlertCircle className="h-4 w-4 text-red-600" />
                            <AlertDescription className="text-red-900">
                                <strong>{overdueActivities} {t('overdue')} activities</strong> - {t('requireImmediateAttention')}
                            </AlertDescription>
                        </Alert>
                    )}
                    {todayActivities > 0 && (
                        <Alert className="bg-blue-50 border-blue-200">
                            <Phone className="h-4 w-4 text-blue-600" />
                            <AlertDescription className="text-blue-900">
                                <strong>{todayActivities} {t('activities')}</strong> {t('scheduledForToday')}
                            </AlertDescription>
                        </Alert>
                    )}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Sales Funnel by Stage</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={pipelineByStage}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="stage" angle={-45} textAnchor="end" height={80} />
                                <YAxis />
                                <Tooltip />
                                <Bar dataKey="value" fill="#10b981" name="Value (LKR K)" />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Win / Loss Distribution</CardTitle>
                    </CardHeader>
                    <CardContent className="flex justify-center">
                        <ResponsiveContainer width="100%" height={250}>
                            <PieChart>
                                <Pie
                                    data={winLossData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={(entry) => `${entry.name}: ${entry.value}`}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    dataKey="value"
                                >
                                    {winLossData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="grid grid-cols-5 w-full">
                    <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
                    <TabsTrigger value="leads">Leads</TabsTrigger>
                    <TabsTrigger value="opportunities">Opportunities</TabsTrigger>
                    <TabsTrigger value="activities">Activities</TabsTrigger>
                    <TabsTrigger value="contacts">Contacts</TabsTrigger>
                </TabsList>

                <TabsContent value="pipeline">
                    <Card>
                        <CardHeader>
                            <CardTitle>Sales Pipeline Overview</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {['qualification', 'needs_analysis', 'proposal', 'negotiation'].map(stage => {
                                    const stageOpps = opportunities.filter(o => o.stage === stage && o.status === 'open');
                                    const stageValue = stageOpps.reduce((sum, o) => sum + (o.estimated_value || 0), 0);
                                    return (
                                        <div key={stage} className="border rounded-lg p-4">
                                            <div className="flex justify-between items-center mb-2">
                                                <h3 className="font-semibold capitalize">{stage.replace('_', ' ')}</h3>
                                                <div className="text-right">
                                                    <p className="text-sm text-gray-600">{stageOpps.length} opportunities</p>
                                                    <p className="font-semibold">LKR {stageValue.toLocaleString()}</p>
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                {stageOpps.slice(0, 3).map(opp => (
                                                    <div key={opp.id} className="flex justify-between items-center bg-gray-50 p-2 rounded">
                                                        <span className="text-sm">{opp.opportunity_name}</span>
                                                        <span className="text-sm font-medium">LKR {opp.estimated_value?.toLocaleString()}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="leads">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Leads</CardTitle>
                            <Button 
                                onClick={() => handleCreate('leads')}
                                className="bg-emerald-600 hover:bg-emerald-700"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                {t('new')} {t('lead')}
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={leads}
                                columns={leadColumns}
                                getBadgeColor={getBadgeColor}
                                onEdit={(item) => handleEdit(item, 'leads')}
                                onDelete={(item) => handleDelete(item, 'Lead')}
                                onPrint={(item) => handlePrint(item, 'Lead')}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="opportunities">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Opportunities</CardTitle>
                            <Button 
                                onClick={() => handleCreate('opportunities')}
                                className="bg-emerald-600 hover:bg-emerald-700"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                {t('new')} {t('opportunity')}
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={opportunities}
                                columns={opportunityColumns}
                                getBadgeColor={getBadgeColor}
                                onEdit={(item) => handleEdit(item, 'opportunities')}
                                onDelete={(item) => handleDelete(item, 'Opportunity')}
                                onPrint={(item) => handlePrint(item, 'Opportunity')}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="activities">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Activities</CardTitle>
                            <Button 
                                onClick={() => handleCreate('activities')}
                                className="bg-emerald-600 hover:bg-emerald-700"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                {t('logActivity')}
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={activities}
                                columns={activityColumns}
                                getBadgeColor={getBadgeColor}
                                onEdit={(item) => handleEdit(item, 'activities')}
                                onDelete={(item) => handleDelete(item, 'Activity')}
                                onPrint={(item) => handlePrint(item, 'Activity')}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="contacts">
                    <Card>
                        <CardHeader>
                            <CardTitle>Contacts</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={contacts}
                                columns={contactColumns}
                                getBadgeColor={getBadgeColor}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {showDialog && activeTab === 'leads' && (
                <LeadForm item={editingItem} onClose={handleCloseDialog} />
            )}
            {showDialog && activeTab === 'opportunities' && (
                <OpportunityForm item={editingItem} onClose={handleCloseDialog} />
            )}
            {showDialog && activeTab === 'activities' && (
                <ActivityForm item={editingItem} onClose={handleCloseDialog} />
            )}
        </div>
    );
}
