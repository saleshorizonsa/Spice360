import React, { useState, useEffect } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Building2, Upload, Check, AlertCircle } from "lucide-react";

export default function OrganizationSetupForm() {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const { data: organizations = [], isLoading } = useQuery({
        queryKey: ['organizations'],
        queryFn: () => matrixSales.entities.Organization.list(),
        initialData: []
    });

    const existingOrg = organizations.length > 0 ? organizations[0] : null;

    const [formData, setFormData] = useState({
        organization_code: 'ORG001',
        organization_name: '',
        organization_name_ar: '',
        trade_name: '',
        trade_name_ar: '',
        cr_number: '',
        cr_issue_date: '',
        cr_expiry_date: '',
        vat_registration_number: '',
        vat_registration_date: '',
        tax_office: '',
        industry: '',
        business_type: 'manufacturing',
        establishment_date: '',
        legal_form: 'llc',
        authorized_capital: 0,
        paid_capital: 0,
        fiscal_year_start: '01-01',
        fiscal_year_end: '12-31',
        base_currency: 'LKR',
        default_language: 'en',
        country: 'Sri Lanka',
        headquarters_address: '',
        headquarters_address_ar: '',
        building_number: '',
        street_name: '',
        street_name_ar: '',
        district: '',
        district_ar: '',
        city: '',
        city_ar: '',
        postal_code: '',
        po_box: '',
        additional_number: '',
        phone: '',
        fax: '',
        email: '',
        website: '',
        ceo_name: '',
        ceo_name_ar: '',
        cfo_name: '',
        authorized_signatory: '',
        authorized_signatory_title: '',
        logo_url: '',
        mol_establishment_number: '',
        chamber_of_commerce_number: '',
        chamber_membership_expiry: '',
        bank_name: '',
        bank_branch: '',
        bank_account_number: '',
        iban: '',
        swift_code: '',
        zatca_environment: 'sandbox',
        zatca_device_name: '',
        multi_branch_enabled: false,
        inter_branch_transactions: false,
        consolidated_reporting: true,
        status: 'active'
    });

    useEffect(() => {
        if (existingOrg) {
            setFormData(existingOrg);
        }
    }, [existingOrg]);

    const saveMutation = useMutation({
        mutationFn: (data) => {
            if (existingOrg) {
                return matrixSales.entities.Organization.update(existingOrg.id, data);
            }
            return matrixSales.entities.Organization.create(data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['organizations'] });
            toast({
                title: "Success",
                description: "Organization setup saved successfully. Changes will reflect across all modules.",
            });
        },
        onError: (error) => {
            toast({
                title: "Error",
                description: error.message || "Failed to save organization setup",
                variant: "destructive"
            });
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (confirm("Save organization setup? This will be used across all modules.")) {
            saveMutation.mutate(formData);
        }
    };

    const handleLogoUpload = async (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                const { file_url } = await matrixSales.integrations.Core.UploadFile({ file });
                setFormData(prev => ({ ...prev, logo_url: file_url }));
                toast({
                    title: "Success",
                    description: "Logo uploaded successfully"
                });
            } catch (error) {
                toast({
                    title: "Error",
                    description: "Failed to upload logo",
                    variant: "destructive"
                });
            }
        }
    };

    if (isLoading) {
        return <div className="p-6">Loading organization setup...</div>;
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-2xl">
                    <Building2 className="w-6 h-6 text-emerald-600" />
                    Organization Setup
                </CardTitle>
                <p className="text-sm text-gray-600">
                    Configure your organization details. This information will be used across all modules.
                </p>
            </CardHeader>
            <CardContent>
                {existingOrg && (
                    <Alert className="mb-4 bg-blue-50 border-blue-200">
                        <Check className="h-4 w-4 text-blue-600" />
                        <AlertDescription className="text-blue-900">
                            Organization already configured. You can update the details below.
                        </AlertDescription>
                    </Alert>
                )}

                <form onSubmit={handleSubmit}>
                    <Tabs defaultValue="basic" className="w-full">
                        <TabsList className="grid grid-cols-6 w-full">
                            <TabsTrigger value="basic">Basic Info</TabsTrigger>
                            <TabsTrigger value="legal">Legal Details</TabsTrigger>
                            <TabsTrigger value="address">Address</TabsTrigger>
                            <TabsTrigger value="financial">Financial</TabsTrigger>
                            <TabsTrigger value="compliance">Compliance</TabsTrigger>
                            <TabsTrigger value="settings">Settings</TabsTrigger>
                        </TabsList>

                        {/* Basic Information */}
                        <TabsContent value="basic" className="space-y-4 mt-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Organization Name (English) *</Label>
                                    <Input
                                        value={formData.organization_name}
                                        onChange={(e) => setFormData({...formData, organization_name: e.target.value})}
                                        required
                                        placeholder="MatrixERP Manufacturing Company"
                                    />
                                </div>
                                <div>
                                    <Label>Organization Name (Arabic)</Label>
                                    <Input
                                        value={formData.organization_name_ar}
                                        onChange={(e) => setFormData({...formData, organization_name_ar: e.target.value})}
                                        placeholder="شركة MatrixERP للتصنيع"
                                        dir="rtl"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Trade Name (English)</Label>
                                    <Input
                                        value={formData.trade_name}
                                        onChange={(e) => setFormData({...formData, trade_name: e.target.value})}
                                        placeholder="MatrixERP"
                                    />
                                </div>
                                <div>
                                    <Label>Trade Name (Arabic)</Label>
                                    <Input
                                        value={formData.trade_name_ar}
                                        onChange={(e) => setFormData({...formData, trade_name_ar: e.target.value})}
                                        placeholder="ماتريكس إي آر بي"
                                        dir="rtl"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <Label>Industry</Label>
                                    <Input
                                        value={formData.industry}
                                        onChange={(e) => setFormData({...formData, industry: e.target.value})}
                                        placeholder="Manufacturing, Trading, etc."
                                    />
                                </div>
                                <div>
                                    <Label>Business Type</Label>
                                    <Select value={formData.business_type} onValueChange={(val) => setFormData({...formData, business_type: val})}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="manufacturing">Manufacturing</SelectItem>
                                            <SelectItem value="trading">Trading</SelectItem>
                                            <SelectItem value="services">Services</SelectItem>
                                            <SelectItem value="contracting">Contracting</SelectItem>
                                            <SelectItem value="retail">Retail</SelectItem>
                                            <SelectItem value="wholesale">Wholesale</SelectItem>
                                            <SelectItem value="mixed">Mixed</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label>Establishment Date</Label>
                                    <Input
                                        type="date"
                                        value={formData.establishment_date}
                                        onChange={(e) => setFormData({...formData, establishment_date: e.target.value})}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <Label>Phone *</Label>
                                    <Input
                                        value={formData.phone}
                                        onChange={(e) => setFormData({...formData, phone: e.target.value})}
                                        required
                                        placeholder="+966112345678"
                                    />
                                </div>
                                <div>
                                    <Label>Email *</Label>
                                    <Input
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                                        required
                                        placeholder="info@company.com"
                                    />
                                </div>
                                <div>
                                    <Label>Website</Label>
                                    <Input
                                        value={formData.website}
                                        onChange={(e) => setFormData({...formData, website: e.target.value})}
                                        placeholder="www.company.com"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <Label>CEO Name</Label>
                                    <Input
                                        value={formData.ceo_name}
                                        onChange={(e) => setFormData({...formData, ceo_name: e.target.value})}
                                        placeholder="Full name"
                                    />
                                </div>
                                <div>
                                    <Label>CFO Name</Label>
                                    <Input
                                        value={formData.cfo_name}
                                        onChange={(e) => setFormData({...formData, cfo_name: e.target.value})}
                                        placeholder="Full name"
                                    />
                                </div>
                                <div>
                                    <Label>Authorized Signatory</Label>
                                    <Input
                                        value={formData.authorized_signatory}
                                        onChange={(e) => setFormData({...formData, authorized_signatory: e.target.value})}
                                        placeholder="Full name"
                                    />
                                </div>
                            </div>

                            <div>
                                <Label>Company Logo</Label>
                                <div className="flex items-center gap-4">
                                    {formData.logo_url && (
                                        <img src={formData.logo_url} alt="Logo" className="h-16 w-16 object-contain border rounded" />
                                    )}
                                    <Button type="button" variant="outline" onClick={() => document.getElementById('logo-upload').click()}>
                                        <Upload className="w-4 h-4 mr-2" />
                                        Upload Logo
                                    </Button>
                                    <input
                                        id="logo-upload"
                                        type="file"
                                        accept="image/*"
                                        onChange={handleLogoUpload}
                                        className="hidden"
                                    />
                                </div>
                            </div>
                        </TabsContent>

                        {/* Legal Details */}
                        <TabsContent value="legal" className="space-y-4 mt-4">
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <Label>CR Number *</Label>
                                    <Input
                                        value={formData.cr_number}
                                        onChange={(e) => setFormData({...formData, cr_number: e.target.value})}
                                        required
                                        placeholder="1010123456"
                                    />
                                </div>
                                <div>
                                    <Label>CR Issue Date</Label>
                                    <Input
                                        type="date"
                                        value={formData.cr_issue_date}
                                        onChange={(e) => setFormData({...formData, cr_issue_date: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <Label>CR Expiry Date</Label>
                                    <Input
                                        type="date"
                                        value={formData.cr_expiry_date}
                                        onChange={(e) => setFormData({...formData, cr_expiry_date: e.target.value})}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <Label>VAT Registration Number *</Label>
                                    <Input
                                        value={formData.vat_registration_number}
                                        onChange={(e) => setFormData({...formData, vat_registration_number: e.target.value})}
                                        required
                                        placeholder="300123456700003"
                                        maxLength="15"
                                    />
                                </div>
                                <div>
                                    <Label>VAT Registration Date</Label>
                                    <Input
                                        type="date"
                                        value={formData.vat_registration_date}
                                        onChange={(e) => setFormData({...formData, vat_registration_date: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <Label>Tax Office</Label>
                                    <Input
                                        value={formData.tax_office}
                                        onChange={(e) => setFormData({...formData, tax_office: e.target.value})}
                                        placeholder="Riyadh Tax Office"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Legal Form</Label>
                                    <Select value={formData.legal_form} onValueChange={(val) => setFormData({...formData, legal_form: val})}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="llc">Limited Liability Company (LLC)</SelectItem>
                                            <SelectItem value="joint_stock">Joint Stock Company</SelectItem>
                                            <SelectItem value="partnership">Partnership</SelectItem>
                                            <SelectItem value="sole_proprietorship">Sole Proprietorship</SelectItem>
                                            <SelectItem value="branch">Branch</SelectItem>
                                            <SelectItem value="holding">Holding Company</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Chamber of Commerce Number</Label>
                                    <Input
                                        value={formData.chamber_of_commerce_number}
                                        onChange={(e) => setFormData({...formData, chamber_of_commerce_number: e.target.value})}
                                        placeholder="12345678"
                                    />
                                </div>
                                <div>
                                    <Label>Chamber Membership Expiry</Label>
                                    <Input
                                        type="date"
                                        value={formData.chamber_membership_expiry}
                                        onChange={(e) => setFormData({...formData, chamber_membership_expiry: e.target.value})}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Authorized Capital (LKR)</Label>
                                    <Input
                                        type="number"
                                        value={formData.authorized_capital}
                                        onChange={(e) => setFormData({...formData, authorized_capital: parseFloat(e.target.value) || 0})}
                                        min="0"
                                    />
                                </div>
                                <div>
                                    <Label>Paid-up Capital (LKR)</Label>
                                    <Input
                                        type="number"
                                        value={formData.paid_capital}
                                        onChange={(e) => setFormData({...formData, paid_capital: parseFloat(e.target.value) || 0})}
                                        min="0"
                                    />
                                </div>
                            </div>
                        </TabsContent>

                        {/* Address */}
                        <TabsContent value="address" className="space-y-4 mt-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Headquarters Address (English)</Label>
                                    <Textarea
                                        value={formData.headquarters_address}
                                        onChange={(e) => setFormData({...formData, headquarters_address: e.target.value})}
                                        rows={2}
                                    />
                                </div>
                                <div>
                                    <Label>Headquarters Address (Arabic)</Label>
                                    <Textarea
                                        value={formData.headquarters_address_ar}
                                        onChange={(e) => setFormData({...formData, headquarters_address_ar: e.target.value})}
                                        rows={2}
                                        dir="rtl"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <Label>Building Number</Label>
                                    <Input
                                        value={formData.building_number}
                                        onChange={(e) => setFormData({...formData, building_number: e.target.value})}
                                        placeholder="1234"
                                    />
                                </div>
                                <div>
                                    <Label>Additional Number</Label>
                                    <Input
                                        value={formData.additional_number}
                                        onChange={(e) => setFormData({...formData, additional_number: e.target.value})}
                                        placeholder="5678"
                                    />
                                </div>
                                <div>
                                    <Label>Postal Code</Label>
                                    <Input
                                        value={formData.postal_code}
                                        onChange={(e) => setFormData({...formData, postal_code: e.target.value})}
                                        placeholder="11564"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Street Name (English)</Label>
                                    <Input
                                        value={formData.street_name}
                                        onChange={(e) => setFormData({...formData, street_name: e.target.value})}
                                        placeholder="King Fahd Road"
                                    />
                                </div>
                                <div>
                                    <Label>Street Name (Arabic)</Label>
                                    <Input
                                        value={formData.street_name_ar}
                                        onChange={(e) => setFormData({...formData, street_name_ar: e.target.value})}
                                        placeholder="طريق الملك فهد"
                                        dir="rtl"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>District (English)</Label>
                                    <Input
                                        value={formData.district}
                                        onChange={(e) => setFormData({...formData, district: e.target.value})}
                                        placeholder="Olaya"
                                    />
                                </div>
                                <div>
                                    <Label>District (Arabic)</Label>
                                    <Input
                                        value={formData.district_ar}
                                        onChange={(e) => setFormData({...formData, district_ar: e.target.value})}
                                        placeholder="العليا"
                                        dir="rtl"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <Label>City (English)</Label>
                                    <Input
                                        value={formData.city}
                                        onChange={(e) => setFormData({...formData, city: e.target.value})}
                                        placeholder="Riyadh"
                                    />
                                </div>
                                <div>
                                    <Label>City (Arabic)</Label>
                                    <Input
                                        value={formData.city_ar}
                                        onChange={(e) => setFormData({...formData, city_ar: e.target.value})}
                                        placeholder="الرياض"
                                        dir="rtl"
                                    />
                                </div>
                                <div>
                                    <Label>P.O. Box</Label>
                                    <Input
                                        value={formData.po_box}
                                        onChange={(e) => setFormData({...formData, po_box: e.target.value})}
                                        placeholder="12345"
                                    />
                                </div>
                            </div>
                        </TabsContent>

                        {/* Financial */}
                        <TabsContent value="financial" className="space-y-4 mt-4">
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <Label>Fiscal Year Start (MM-DD)</Label>
                                    <Input
                                        value={formData.fiscal_year_start}
                                        onChange={(e) => setFormData({...formData, fiscal_year_start: e.target.value})}
                                        placeholder="01-01"
                                    />
                                </div>
                                <div>
                                    <Label>Fiscal Year End (MM-DD)</Label>
                                    <Input
                                        value={formData.fiscal_year_end}
                                        onChange={(e) => setFormData({...formData, fiscal_year_end: e.target.value})}
                                        placeholder="12-31"
                                    />
                                </div>
                                <div>
                                    <Label>Base Currency</Label>
                                    <Input
                                        value={formData.base_currency}
                                        disabled
                                        className="bg-gray-50"
                                    />
                                </div>
                            </div>

                            <div className="border-t pt-4">
                                <h3 className="font-semibold text-lg mb-4">Primary Bank Account</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label>Bank Name</Label>
                                        <Input
                                            value={formData.bank_name}
                                            onChange={(e) => setFormData({...formData, bank_name: e.target.value})}
                                            placeholder="Al Rajhi Bank"
                                        />
                                    </div>
                                    <div>
                                        <Label>Branch Name</Label>
                                        <Input
                                            value={formData.bank_branch}
                                            onChange={(e) => setFormData({...formData, bank_branch: e.target.value})}
                                            placeholder="Olaya Branch"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-4 mt-4">
                                    <div>
                                        <Label>IBAN</Label>
                                        <Input
                                            value={formData.iban}
                                            onChange={(e) => setFormData({...formData, iban: e.target.value})}
                                            placeholder="SA1234567890123456789012"
                                        />
                                    </div>
                                    <div>
                                        <Label>Account Number</Label>
                                        <Input
                                            value={formData.bank_account_number}
                                            onChange={(e) => setFormData({...formData, bank_account_number: e.target.value})}
                                            placeholder="1234567890"
                                        />
                                    </div>
                                    <div>
                                        <Label>SWIFT Code</Label>
                                        <Input
                                            value={formData.swift_code}
                                            onChange={(e) => setFormData({...formData, swift_code: e.target.value})}
                                            placeholder="RJHISARI"
                                        />
                                    </div>
                                </div>
                            </div>
                        </TabsContent>

                        {/* Compliance */}
                        <TabsContent value="compliance" className="space-y-4 mt-4">
                            <div>
                                <Label>Ministry of Labor Number</Label>
                                <Input
                                    value={formData.mol_establishment_number}
                                    onChange={(e) => setFormData({...formData, mol_establishment_number: e.target.value})}
                                    placeholder="700-123456"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>ZATCA Environment</Label>
                                    <Select value={formData.zatca_environment} onValueChange={(val) => setFormData({...formData, zatca_environment: val})}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="sandbox">Sandbox (Testing)</SelectItem>
                                            <SelectItem value="simulation">Simulation</SelectItem>
                                            <SelectItem value="production">Production</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div>
                                <Label>ZATCA Device Name (E-invoicing)</Label>
                                <Input
                                    value={formData.zatca_device_name}
                                    onChange={(e) => setFormData({...formData, zatca_device_name: e.target.value})}
                                    placeholder="MatrixERP-POS-001"
                                />
                            </div>
                        </TabsContent>

                        {/* Settings */}
                        <TabsContent value="settings" className="space-y-4 mt-4">
                            <div>
                                <Label>Default Language</Label>
                                <Select value={formData.default_language} onValueChange={(val) => setFormData({...formData, default_language: val})}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="en">English</SelectItem>
                                        <SelectItem value="ar">Arabic (العربية)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-4 border-t pt-4">
                                <h3 className="font-semibold text-lg">Multi-Branch Configuration</h3>
                                
                                <div className="flex items-center justify-between p-4 border rounded">
                                    <div>
                                        <Label>Enable Multi-Branch Operations</Label>
                                        <p className="text-sm text-gray-600">Allow multiple branches/locations</p>
                                    </div>
                                    <Switch
                                        checked={formData.multi_branch_enabled}
                                        onCheckedChange={(checked) => setFormData({...formData, multi_branch_enabled: checked})}
                                    />
                                </div>

                                {formData.multi_branch_enabled && (
                                    <>
                                        <div className="flex items-center justify-between p-4 border rounded">
                                            <div>
                                                <Label>Inter-Branch Transactions</Label>
                                                <p className="text-sm text-gray-600">Allow stock transfers between branches</p>
                                            </div>
                                            <Switch
                                                checked={formData.inter_branch_transactions}
                                                onCheckedChange={(checked) => setFormData({...formData, inter_branch_transactions: checked})}
                                            />
                                        </div>

                                        <div className="flex items-center justify-between p-4 border rounded">
                                            <div>
                                                <Label>Consolidated Reporting</Label>
                                                <p className="text-sm text-gray-600">Generate consolidated financial reports</p>
                                            </div>
                                            <Switch
                                                checked={formData.consolidated_reporting}
                                                onCheckedChange={(checked) => setFormData({...formData, consolidated_reporting: checked})}
                                            />
                                        </div>
                                    </>
                                )}
                            </div>

                            <Alert className="bg-yellow-50 border-yellow-200">
                                <AlertCircle className="h-4 w-4 text-yellow-600" />
                                <AlertDescription className="text-yellow-900">
                                    <strong>Important:</strong> Organization setup will be used across all modules including Sales, Finance, HR, and Reporting. Make sure all information is accurate.
                                </AlertDescription>
                            </Alert>
                        </TabsContent>
                    </Tabs>

                    <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                        <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" disabled={saveMutation.isLoading}>
                            {saveMutation.isLoading ? 'Saving...' : (existingOrg ? 'Update Organization' : 'Create Organization')}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}