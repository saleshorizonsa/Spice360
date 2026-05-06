import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
    Package, 
    Upload, 
    Download, 
    Plus,
    Users,
    RefreshCw,
    UserCheck, // New icon import
    Calculator // New icon import
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import MaterialForm from "../components/admin/MaterialForm";
import ExcelUploadForm from "../components/admin/ExcelUploadForm";
import CustomerForm from "../components/admin/CustomerForm";
import VendorForm from "../components/admin/VendorForm";
import SalesmanForm from "../components/admin/SalesmanForm"; // New component import
import MaterialGroupForm from "../components/admin/MaterialGroupForm"; // New component import
import MaterialSubGroupForm from "../components/admin/MaterialSubGroupForm"; // New component import
import UnitConversionForm from "../components/admin/UnitConversionForm"; // New component import
import DataTable from "../components/erp/DataTable";
import { useLanguage } from "../components/utils/languageContext";

export default function MasterDataManagement() {
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState("materials");
    const [showMaterialForm, setShowMaterialForm] = useState(false);
    const [showCustomerForm, setShowCustomerForm] = useState(false);
    const [showVendorForm, setShowVendorForm] = useState(false);
    const [showSalesmanForm, setShowSalesmanForm] = useState(false); // New state
    const [showGroupForm, setShowGroupForm] = useState(false); // New state
    const [showSubGroupForm, setShowSubGroupForm] = useState(false); // New state
    const [showConversionForm, setShowConversionForm] = useState(false); // New state
    const [showExcelUpload, setShowExcelUpload] = useState(false);
    const [editingRecord, setEditingRecord] = useState(null);
    
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const { data: materials = [], isLoading: loadingMaterials } = useQuery({
        queryKey: ['materials'],
        queryFn: () => base44.entities.Material.list(),
        initialData: []
    });

    const { data: customers = [], isLoading: loadingCustomers } = useQuery({
        queryKey: ['customers'],
        queryFn: () => base44.entities.Customer.list(),
        initialData: []
    });

    const { data: vendors = [], isLoading: loadingVendors } = useQuery({
        queryKey: ['vendors'],
        queryFn: () => base44.entities.Vendor.list(),
        initialData: []
    });

    const { data: salesmen = [], isLoading: loadingSalesmen } = useQuery({ // New query
        queryKey: ['salesmen'],
        queryFn: () => base44.entities.Salesman.list(),
        initialData: []
    });

    const { data: materialGroups = [] } = useQuery({
        queryKey: ['materialGroups'],
        queryFn: () => base44.entities.MaterialGroup.list(),
        initialData: []
    });

    const { data: materialSubGroups = [] } = useQuery({ // New query
        queryKey: ['materialSubGroups'],
        queryFn: () => base44.entities.MaterialSubGroup.list(),
        initialData: []
    });

    const { data: unitConversions = [] } = useQuery({ // New query
        queryKey: ['unitConversions'],
        queryFn: () => base44.entities.UnitConversion.list(),
        initialData: []
    });

    const deleteMaterialMutation = useMutation({
        mutationFn: (id) => base44.entities.Material.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['materials'] });
            toast({
                title: "Success",
                description: "Material deleted successfully",
            });
        },
        onError: (error) => {
            toast({
                title: "Error",
                description: error.message || "Failed to delete material",
                variant: "destructive",
            });
        }
    });

    const deleteCustomerMutation = useMutation({
        mutationFn: (id) => base44.entities.Customer.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['customers'] });
            toast({
                title: "Success",
                description: "Customer deleted successfully",
            });
        },
        onError: (error) => {
            toast({
                title: "Error",
                description: error.message || "Failed to delete customer",
                variant: "destructive",
            });
        }
    });

    const deleteVendorMutation = useMutation({
        mutationFn: (id) => base44.entities.Vendor.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['vendors'] });
            toast({
                title: "Success",
                description: "Vendor deleted successfully",
            });
        },
        onError: (error) => {
            toast({
                title: "Error",
                description: error.message || "Failed to delete vendor",
                variant: "destructive",
            });
        }
    });

    const deleteSalesmanMutation = useMutation({ // New mutation
        mutationFn: (id) => base44.entities.Salesman.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['salesmen'] });
            toast({ title: "Success", description: "Salesman deleted successfully" });
        },
        onError: (error) => {
            toast({
                title: "Error",
                description: error.message || "Failed to delete salesman",
                variant: "destructive",
            });
        }
    });

    const deleteMaterialGroupMutation = useMutation({ // New mutation
        mutationFn: (id) => base44.entities.MaterialGroup.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['materialGroups'] });
            toast({ title: "Success", description: "Material Group deleted successfully" });
        },
        onError: (error) => {
            toast({
                title: "Error",
                description: error.message || "Failed to delete material group",
                variant: "destructive",
            });
        }
    });

    const deleteMaterialSubGroupMutation = useMutation({ // New mutation
        mutationFn: (id) => base44.entities.MaterialSubGroup.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['materialSubGroups'] });
            toast({ title: "Success", description: "Material Sub-Group deleted successfully" });
        },
        onError: (error) => {
            toast({
                title: "Error",
                description: error.message || "Failed to delete material sub-group",
                variant: "destructive",
            });
        }
    });

    const deleteUnitConversionMutation = useMutation({ // New mutation
        mutationFn: (id) => base44.entities.UnitConversion.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['unitConversions'] });
            toast({ title: "Success", description: "Unit Conversion deleted successfully" });
        },
        onError: (error) => {
            toast({
                title: "Error",
                description: error.message || "Failed to delete unit conversion",
                variant: "destructive",
            });
        }
    });

    const handleDownloadTemplate = (type) => {
        let csvContent = "";
        let filename = "";

        if (type === "material") {
            csvContent = `material_code,material_name,material_type,unit_of_measure,unit_price,unit_cost,group_code,subgroup_code,reorder_point,max_stock_level,location_code,supplier_code,lead_time_days,specifications,status
M001,PVC Pipe 50mm,raw_material,meter,25.50,20.00,PIPE,PIPE-PVC,100,500,WH01,V001,7,50mm diameter PVC pipe,active
M002,UPVC Fitting Elbow,raw_material,piece,5.75,4.50,FITTING,FIT-ELBOW,50,200,WH01,V001,5,90 degree elbow fitting,active`;
            filename = "material_template.csv";
        } else if (type === "customer") {
            csvContent = `customer_code,customer_name,customer_type,salesman_code,contact_person,email,phone,mobile,address,city,state,postal_code,country,tax_id,credit_limit,payment_terms,status
C001,ABC Trading Company,corporate,SALES-001,Ahmed Ali,ahmed@abc.com,+966112345678,+966501234567,King Fahd Road,Riyadh,Riyadh,11564,Saudi Arabia,300123456700003,50000,net_30,active
C002,XYZ Construction,corporate,SALES-002,Mohammed Hassan,mohammed@xyzconstruction.com,+966212345678,+966502345678,Tahlia Street,Jeddah,Makkah Province,21589,Saudi Arabia,300987654300003,100000,net_45,active`;
            filename = "customer_template.csv";
        } else if (type === "vendor") {
            csvContent = `vendor_code,vendor_name,vendor_type,contact_person,email,phone,mobile,address,city,state,postal_code,country,tax_id,payment_terms,currency,rating,status
V001,Global Plastics Supplier,manufacturer,John Smith,john@globalplastics.com,+966312345678,+966503456789,Industrial City,Dammam,Eastern Province,31952,Saudi Arabia,300456789100003,net_30,SAR,4,active
V002,Al-Salam Chemical Industries,manufacturer,Khalid Ahmed,khalid@alsalam.com,+966412345678,+966504567890,Jubail Industrial,Jubail,Eastern Province,31961,Saudi Arabia,300654321900003,net_45,SAR,5,active`;
            filename = "vendor_template.csv";
        } else if (type === "salesman") { // New template
            csvContent = `salesman_code,salesman_name,email,phone,mobile,territory,commission_percent,monthly_target,status
S001,Ali Ahmed,ali.ahmed@example.com,+966501112222,+966501112222,Eastern,5,100000,active
S002,Fahad Mohammed,fahad.mohammed@example.com,+966503334444,+966503334444,Central,7,150000,active`;
            filename = "salesman_template.csv";
        } else if (type === "materialGroup") { // New template
            csvContent = `group_code,group_name,group_name_ar,description,status
PIPE,Pipes,أنابيب,Various types of pipes,active
FIT,Fittings,تجهيزات,Various pipe fittings,active`;
            filename = "material_group_template.csv";
        } else if (type === "materialSubGroup") { // New template
            csvContent = `subgroup_code,subgroup_name,subgroup_name_ar,group_code,description,status
PIPE-PVC,PVC Pipes,أنابيب PVC,PIPE,Polyvinyl Chloride Pipes,active
FIT-ELBOW,Elbow Fittings,تجهيزات الكوع,FIT,90 degree elbow fittings,active`;
            filename = "material_subgroup_template.csv";
        } else if (type === "unitConversion") { // New template
            csvContent = `material_code,from_unit,to_unit,conversion_factor,is_default,description,status
M001,meter,piece,0.5,false,"Half a piece is a meter",active
M002,piece,box,10,true,"10 pieces per box",active`;
            filename = "unit_conversion_template.csv";
        }


        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();

        toast({
            title: "Template Downloaded",
            description: `${filename} has been downloaded. Fill it with your data and upload.`,
        });
    };

    const materialColumns = [ // Modified columns
        { key: 'material_code', label: 'Code' },
        { key: 'material_name', label: 'Name' },
        { key: 'group_name', label: 'Group' }, // New
        { key: 'subgroup_name', label: 'Sub-Group' }, // New
        { key: 'material_type', label: 'Type' },
        { key: 'unit_of_measure', label: 'UOM' },
        { key: 'unit_price', label: 'Price (SAR)', render: (val) => val?.toLocaleString() },
        { key: 'current_stock', label: 'Stock', render: (val) => val?.toLocaleString() || 0 },
        { key: 'status', label: 'Status', render: (val) => (
            <span className={`px-2 py-1 rounded text-xs ${
                val === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
            }`}>
                {val}
            </span>
        )},
    ];

    const customerColumns = [ // Modified columns
        { key: 'customer_code', label: 'Code' },
        { key: 'customer_name', label: 'Name' },
        { key: 'salesman_name', label: 'Salesman' }, // New
        { key: 'contact_person', label: 'Contact' },
        { key: 'email', label: 'Email' },
        { key: 'phone', label: 'Phone' },
        { key: 'credit_limit', label: 'Credit Limit', render: (val) => `SAR ${val?.toLocaleString()}` },
        // Removed outstanding_balance column
        { key: 'status', label: 'Status', render: (val) => (
            <span className={`px-2 py-1 rounded text-xs ${
                val === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
                {val}
            </span>
        )},
    ];

    const vendorColumns = [ // Unchanged
        { key: 'vendor_code', label: 'Code' },
        { key: 'vendor_name', label: 'Name' },
        { key: 'contact_person', label: 'Contact' },
        { key: 'email', label: 'Email' },
        { key: 'phone', label: 'Phone' },
        { key: 'rating', label: 'Rating', render: (val) => '⭐'.repeat(val || 0) },
        { key: 'status', label: 'Status', render: (val) => (
            <span className={`px-2 py-1 rounded text-xs ${
                val === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
                {val}
            </span>
        )},
    ];

    const salesmanColumns = [ // New columns
        { key: 'salesman_code', label: 'Code' },
        { key: 'salesman_name', label: 'Name' },
        { key: 'territory', label: 'Territory' },
        { key: 'phone', label: 'Phone' },
        { key: 'commission_percent', label: 'Commission %' },
        { key: 'monthly_target', label: 'Target (SAR)', render: (val) => val?.toLocaleString() },
        { key: 'status', label: 'Status', render: (val) => (
            <span className={`px-2 py-1 rounded text-xs ${
                val === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
            }`}>
                {val}
            </span>
        )},
    ];

    const groupColumns = [ // New columns
        { key: 'group_code', label: 'Group Code' },
        { key: 'group_name', label: 'Group Name' },
        { key: 'group_name_ar', label: 'Name (Arabic)' },
        { key: 'description', label: 'Description' },
        { key: 'status', label: 'Status', render: (val) => (
            <span className={`px-2 py-1 rounded text-xs ${
                val === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
            }`}>
                {val}
            </span>
        )},
    ];

    const subGroupColumns = [ // New columns
        { key: 'subgroup_code', label: 'Sub-Group Code' },
        { key: 'subgroup_name', label: 'Sub-Group Name' },
        { key: 'group_name', label: 'Parent Group' }, // Assuming this will be populated
        { key: 'subgroup_name_ar', label: 'Name (Arabic)' },
        { key: 'status', label: 'Status', render: (val) => (
            <span className={`px-2 py-1 rounded text-xs ${
                val === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
            }`}>
                {val}
            </span>
        )},
    ];

    const conversionColumns = [ // New columns
        { key: 'material_code', label: 'Material' },
        { key: 'from_unit', label: 'From Unit' },
        { key: 'to_unit', label: 'To Unit' },
        { key: 'conversion_factor', label: 'Factor' },
        { key: 'description', label: 'Description' },
        { key: 'is_default', label: 'Default', render: (val) => val ? '✓' : '' },
        { key: 'status', label: 'Status', render: (val) => (
            <span className={`px-2 py-1 rounded text-xs ${
                val === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
            }`}>
                {val}
            </span>
        )},
    ];

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Master Data Management</h1>
                    <p className="text-gray-600 mt-1">Manage materials, customers, vendors, salesmen & hierarchies</p> {/* Modified description */}
                </div>
                <Button 
                    variant="outline" 
                    className="gap-2"
                    onClick={() => {
                        queryClient.invalidateQueries();
                        toast({
                            title: "Data Refreshed",
                            description: "All master data has been reloaded",
                        });
                    }}
                >
                    <RefreshCw className="w-4 h-4" />
                    {t('refreshAll')}
                </Button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Total Materials</p>
                                <p className="text-2xl font-bold text-gray-900">{materials.length}</p>
                                <p className="text-xs text-gray-500 mt-1">
                                    {materialGroups.length} groups {/* Modified content */}
                                </p>
                            </div>
                            <Package className="w-8 h-8 text-emerald-600" />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Total Customers</p>
                                <p className="text-2xl font-bold text-gray-900">{customers.length}</p>
                                <p className="text-xs text-gray-500 mt-1">
                                    {customers.filter(c => c.status === 'active').length} active
                                </p>
                            </div>
                            <Users className="w-8 h-8 text-blue-600" />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Salesmen</p> {/* Modified content */}
                                <p className="text-2xl font-bold text-gray-900">{salesmen.length}</p> {/* Modified content */}
                                <p className="text-xs text-gray-500 mt-1">
                                    {salesmen.filter(s => s.status === 'active').length} active {/* Modified content */}
                                </p>
                            </div>
                            <UserCheck className="w-8 h-8 text-purple-600" /> {/* Modified icon */}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Unit Conversions</p> {/* Modified content */}
                                <p className="text-2xl font-bold text-gray-900">{unitConversions.length}</p> {/* Modified content */}
                                <p className="text-xs text-gray-500 mt-1">Multi-UOM enabled</p> {/* Modified content */}
                            </div>
                            <Calculator className="w-8 h-8 text-amber-600" /> {/* Modified icon */}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-7"> {/* Modified grid columns */}
                    <TabsTrigger value="materials">Materials</TabsTrigger>
                    <TabsTrigger value="customers">Customers</TabsTrigger>
                    <TabsTrigger value="vendors">Vendors</TabsTrigger>
                    <TabsTrigger value="salesmen">Salesmen</TabsTrigger> {/* New Tab */}
                    <TabsTrigger value="groups">Groups</TabsTrigger> {/* New Tab */}
                    <TabsTrigger value="subgroups">Sub-Groups</TabsTrigger> {/* New Tab */}
                    <TabsTrigger value="conversions">Unit Conversions</TabsTrigger> {/* New Tab */}
                </TabsList>

                {/* Materials Tab */}
                <TabsContent value="materials" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <CardTitle>Materials & Items Master</CardTitle>
                                <div className="flex gap-2">
                                    <Button 
                                        variant="outline" 
                                        size="sm"
                                        onClick={() => handleDownloadTemplate('material')}
                                    >
                                        <Download className="w-4 h-4 mr-2" />
                                        Template {/* Modified text */}
                                    </Button>
                                    <Button 
                                        variant="outline" 
                                        size="sm"
                                        onClick={() => setShowExcelUpload(true)}
                                    >
                                        <Upload className="w-4 h-4 mr-2" />
                                        Excel Upload {/* Modified text */}
                                    </Button>
                                    <Button 
                                        className="bg-emerald-600 hover:bg-emerald-700"
                                        size="sm"
                                        onClick={() => {
                                            setEditingRecord(null);
                                            setShowMaterialForm(true);
                                        }}
                                    >
                                        <Plus className="w-4 h-4 mr-2" />
                                        New Material
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={materials}
                                columns={materialColumns}
                                onEdit={(material) => {
                                    setEditingRecord(material);
                                    setShowMaterialForm(true);
                                }}
                                onDelete={(material) => {
                                    if (confirm(`Delete material ${material.material_code}?`)) {
                                        deleteMaterialMutation.mutate(material.id);
                                    }
                                }}
                                isLoading={loadingMaterials}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Customers Tab */}
                <TabsContent value="customers" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <CardTitle>Customer Master (Linked to Salesman)</CardTitle> {/* Modified title */}
                                <div className="flex gap-2">
                                    <Button 
                                        variant="outline" 
                                        size="sm"
                                        onClick={() => handleDownloadTemplate('customer')}
                                    >
                                        <Download className="w-4 h-4 mr-2" />
                                        Template {/* Modified text */}
                                    </Button>
                                    <Button 
                                        variant="outline" 
                                        size="sm"
                                        onClick={() => setShowExcelUpload(true)}
                                    >
                                        <Upload className="w-4 h-4 mr-2" />
                                        Excel Upload {/* Modified text */}
                                    </Button>
                                    <Button 
                                        className="bg-blue-600 hover:bg-blue-700"
                                        size="sm"
                                        onClick={() => {
                                            setEditingRecord(null);
                                            setShowCustomerForm(true);
                                        }}
                                    >
                                        <Plus className="w-4 h-4 mr-2" />
                                        New Customer
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={customers}
                                columns={customerColumns}
                                onEdit={(customer) => {
                                    setEditingRecord(customer);
                                    setShowCustomerForm(true);
                                }}
                                onDelete={(customer) => {
                                    if (confirm(`Delete customer ${customer.customer_code}?`)) {
                                        deleteCustomerMutation.mutate(customer.id);
                                    }
                                }}
                                isLoading={loadingCustomers}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Vendors Tab */}
                <TabsContent value="vendors" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <CardTitle>Vendor Master</CardTitle>
                                <div className="flex gap-2">
                                    <Button 
                                        variant="outline" 
                                        size="sm"
                                        onClick={() => handleDownloadTemplate('vendor')}
                                    >
                                        <Download className="w-4 h-4 mr-2" />
                                        Template
                                    </Button>
                                    <Button 
                                        variant="outline" 
                                        size="sm"
                                        onClick={() => setShowExcelUpload(true)}
                                    >
                                        <Upload className="w-4 h-4 mr-2" />
                                        Excel Upload
                                    </Button>
                                    <Button 
                                        className="bg-purple-600 hover:bg-purple-700"
                                        size="sm"
                                        onClick={() => {
                                            setEditingRecord(null);
                                            setShowVendorForm(true);
                                        }}
                                    >
                                        <Plus className="w-4 h-4 mr-2" />
                                        New Vendor
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={vendors}
                                columns={vendorColumns}
                                onEdit={(vendor) => {
                                    setEditingRecord(vendor);
                                    setShowVendorForm(true);
                                }}
                                onDelete={(vendor) => {
                                    if (confirm(`Delete vendor ${vendor.vendor_code}?`)) {
                                        deleteVendorMutation.mutate(vendor.id);
                                    }
                                }}
                                isLoading={loadingVendors}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Salesmen Tab (New) */}
                <TabsContent value="salesmen" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <CardTitle>Salesmen Master</CardTitle>
                                <div className="flex gap-2">
                                    <Button 
                                        variant="outline" 
                                        size="sm"
                                        onClick={() => handleDownloadTemplate('salesman')}
                                    >
                                        <Download className="w-4 h-4 mr-2" />
                                        Template
                                    </Button>
                                    <Button 
                                        variant="outline" 
                                        size="sm"
                                        onClick={() => setShowExcelUpload(true)}
                                    >
                                        <Upload className="w-4 h-4 mr-2" />
                                        Excel Upload
                                    </Button>
                                    <Button 
                                        className="bg-purple-600 hover:bg-purple-700"
                                        size="sm"
                                        onClick={() => {
                                            setEditingRecord(null);
                                            setShowSalesmanForm(true);
                                        }}
                                    >
                                        <Plus className="w-4 h-4 mr-2" />
                                        New Salesman
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={salesmen}
                                columns={salesmanColumns}
                                onEdit={(salesman) => {
                                    setEditingRecord(salesman);
                                    setShowSalesmanForm(true);
                                }}
                                onDelete={(salesman) => {
                                    if (confirm(`Delete salesman ${salesman.salesman_code}?`)) {
                                        deleteSalesmanMutation.mutate(salesman.id);
                                    }
                                }}
                                isLoading={loadingSalesmen}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Material Groups Tab (New) */}
                <TabsContent value="groups" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <CardTitle>Material Groups</CardTitle>
                                <div className="flex gap-2">
                                    <Button 
                                        variant="outline" 
                                        size="sm"
                                        onClick={() => handleDownloadTemplate('materialGroup')}
                                    >
                                        <Download className="w-4 h-4 mr-2" />
                                        Template
                                    </Button>
                                    <Button 
                                        variant="outline" 
                                        size="sm"
                                        onClick={() => setShowExcelUpload(true)}
                                    >
                                        <Upload className="w-4 h-4 mr-2" />
                                        Excel Upload
                                    </Button>
                                    <Button 
                                        className="bg-emerald-600 hover:bg-emerald-700"
                                        size="sm"
                                        onClick={() => {
                                            setEditingRecord(null);
                                            setShowGroupForm(true);
                                        }}
                                    >
                                        <Plus className="w-4 h-4 mr-2" />
                                        New Group
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={materialGroups}
                                columns={groupColumns}
                                onEdit={(group) => {
                                    setEditingRecord(group);
                                    setShowGroupForm(true);
                                }}
                                onDelete={(group) => {
                                    if (confirm(`Delete group ${group.group_code}?`)) {
                                        deleteMaterialGroupMutation.mutate(group.id);
                                    }
                                }}
                                // No specific loading state for groups provided in outline
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Material Sub-Groups Tab (New) */}
                <TabsContent value="subgroups" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <CardTitle>Material Sub-Groups</CardTitle>
                                <div className="flex gap-2">
                                    <Button 
                                        variant="outline" 
                                        size="sm"
                                        onClick={() => handleDownloadTemplate('materialSubGroup')}
                                    >
                                        <Download className="w-4 h-4 mr-2" />
                                        Template
                                    </Button>
                                    <Button 
                                        variant="outline" 
                                        size="sm"
                                        onClick={() => setShowExcelUpload(true)}
                                    >
                                        <Upload className="w-4 h-4 mr-2" />
                                        Excel Upload
                                    </Button>
                                    <Button 
                                        className="bg-emerald-600 hover:bg-emerald-700"
                                        size="sm"
                                        onClick={() => {
                                            setEditingRecord(null);
                                            setShowSubGroupForm(true);
                                        }}
                                    >
                                        <Plus className="w-4 h-4 mr-2" />
                                        New Sub-Group
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={materialSubGroups}
                                columns={subGroupColumns}
                                onEdit={(subgroup) => {
                                    setEditingRecord(subgroup);
                                    setShowSubGroupForm(true);
                                }}
                                onDelete={(subgroup) => {
                                    if (confirm(`Delete sub-group ${subgroup.subgroup_code}?`)) {
                                        deleteMaterialSubGroupMutation.mutate(subgroup.id);
                                    }
                                }}
                                // No specific loading state for subgroups provided in outline
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Unit Conversions Tab (New) */}
                <TabsContent value="conversions" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <CardTitle>Unit Conversions (Pcs ↔ Bundle ↔ Tons)</CardTitle>
                                <div className="flex gap-2">
                                    <Button 
                                        variant="outline" 
                                        size="sm"
                                        onClick={() => handleDownloadTemplate('unitConversion')}
                                    >
                                        <Download className="w-4 h-4 mr-2" />
                                        Template
                                    </Button>
                                    <Button 
                                        variant="outline" 
                                        size="sm"
                                        onClick={() => setShowExcelUpload(true)}
                                    >
                                        <Upload className="w-4 h-4 mr-2" />
                                        Excel Upload
                                    </Button>
                                    <Button 
                                        className="bg-amber-600 hover:bg-amber-700"
                                        size="sm"
                                        onClick={() => {
                                            setEditingRecord(null);
                                            setShowConversionForm(true);
                                        }}
                                    >
                                        <Plus className="w-4 h-4 mr-2" />
                                        New Conversion
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={unitConversions}
                                columns={conversionColumns}
                                onEdit={(conversion) => {
                                    setEditingRecord(conversion);
                                    setShowConversionForm(true);
                                }}
                                onDelete={(conversion) => {
                                    if (confirm(`Delete conversion ${conversion.conversion_id}?`)) {
                                        deleteUnitConversionMutation.mutate(conversion.id);
                                    }
                                }}
                                // No specific loading state for conversions provided in outline
                            />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Forms as Modals */}
            {showMaterialForm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <MaterialForm
                            material={editingRecord}
                            onClose={() => {
                                setShowMaterialForm(false);
                                setEditingRecord(null);
                            }}
                        />
                    </div>
                </div>
            )}

            {showCustomerForm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <CustomerForm
                            customer={editingRecord}
                            onClose={() => {
                                setShowCustomerForm(false);
                                setEditingRecord(null);
                            }}
                        />
                    </div>
                </div>
            )}

            {showVendorForm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <VendorForm
                            vendor={editingRecord}
                            onClose={() => {
                                setShowVendorForm(false);
                                setEditingRecord(null);
                            }}
                        />
                    </div>
                </div>
            )}

            {showSalesmanForm && ( // New Salesman form modal
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <SalesmanForm
                            item={editingRecord}
                            onClose={() => {
                                setShowSalesmanForm(false);
                                setEditingRecord(null);
                            }}
                        />
                    </div>
                </div>
            )}

            {showGroupForm && ( // New Material Group form modal
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <MaterialGroupForm
                            item={editingRecord}
                            onClose={() => {
                                setShowGroupForm(false);
                                setEditingRecord(null);
                            }}
                        />
                    </div>
                </div>
            )}

            {showSubGroupForm && ( // New Material Sub-Group form modal
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <MaterialSubGroupForm
                            item={editingRecord}
                            onClose={() => {
                                setShowSubGroupForm(false);
                                setEditingRecord(null);
                            }}
                        />
                    </div>
                </div>
            )}

            {showConversionForm && ( // New Unit Conversion form modal
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <UnitConversionForm
                            item={editingRecord}
                            onClose={() => {
                                setShowConversionForm(false);
                                setEditingRecord(null);
                            }}
                        />
                    </div>
                </div>
            )}

            {showExcelUpload && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                        <ExcelUploadForm
                            entityType={ // Modified entityType logic for new tabs
                                activeTab === 'materials' ? 'Material' : 
                                activeTab === 'customers' ? 'Customer' : 
                                activeTab === 'vendors' ? 'Vendor' :
                                activeTab === 'salesmen' ? 'Salesman' : 
                                activeTab === 'groups' ? 'MaterialGroup' : 
                                activeTab === 'subgroups' ? 'MaterialSubGroup' : 
                                activeTab === 'conversions' ? 'UnitConversion' : 
                                'Material' // Default fallback
                            }
                            onClose={() => setShowExcelUpload(false)}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}