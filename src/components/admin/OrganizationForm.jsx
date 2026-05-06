import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { Switch } from "@/components/ui/switch";
import { Upload } from "lucide-react";

export default function OrganizationForm({ item, onClose }) {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const [formData, setFormData] = useState({
        organization_code: '',
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
        base_currency: 'SAR',
        default_language: 'en',
        country: 'Saudi Arabia',
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
        gosi_establishment_number: '',
        gosi_registration_date: '',
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
        if (item) {
            setFormData(item);
        }
    }, [item]);

    const saveMutation = useMutation({
        mutationFn: (data) => {
            if (item) {
                return base44.entities.Organization.update(item.id, data);
            }
            return base44.entities.Organization.create(data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['organizations'] });
            toast({
                title: "Success",
                description: `Organization ${item ? 'updated' : 'created'} successfully`,
            });
            onClose();
        },
        onError: (error) => {
            toast({
                title: "Error",
                description: error.message || "Failed to save organization",
                variant: "destructive"
            });
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        saveMutation.mutate(formData);
    };

    const handleLogoUpload = async (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                const { file_url } = await base44.integrations.Core.UploadFile({ file });
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

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {item ? 'Edit Organization' : 'Create New Organization'}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <Tabs defaultValue="basic" className="w-full">
                        <TabsList className="grid grid-cols-5 w-full">
                            <TabsTrigger value="basic">Basic Info</TabsTrigger>
                            <TabsTrigger value="legal">Legal</TabsTrigger>
                            <TabsTrigger value="address">Address</TabsTrigger>
                            <TabsTrigger value="financial">Financial</TabsTrigger>
                            <TabsTrigger value="settings">Settings</TabsTrigger>
                        </TabsList>

                        {/* Basic Information */}
                        <TabsContent value="basic" className="space-y-4 mt-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Organization Code *</Label>
                                    <Input
                                        value={formData.organization_code}
                                        onChange={(e) => setFormData({...formData, organization_code: e.target.value.toUpperCase()})}
                                        required
                                        placeholder="ORG001"
                                    />
                                </div>
                                <div>
                                    <Label>Status</Label>
                                    <Select value={formData.status} onValueChange={(val) => setFormData({...formData, status: val})}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="active">Active</SelectItem>
                                            <SelectItem value="inactive">Inactive</SelectItem>
                                            <SelectItem value="suspended">Suspended</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Organization Name (English) *</Label>
                                    <Input
                                        value={formData.organization_name}
                                        onChange={(e) => setFormData({...formData, organization_name: e.target.value})}
                                        required
                                        placeholder="ABC Manufacturing Company"
                                    />
                                </div>
                                <div>
                                    <Label>Organization Name (Arabic)</Label>
                                    <Input
                                        value={formData.organization_name_ar}
                                        onChange={(e) => setFormData({...formData, organization_name_ar: e.target.value})}
                                        placeholder="شركة ABC للتصنيع"
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
                                        placeholder="Manufacturing"
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
                                    <Label>Legal Form</Label>
                                    <Select value={formData.legal_form} onValueChange={(val) => setFormData({...formData, legal_form: val})}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="llc">Limited Liability Company (LLC)</SelectItem>
                                            <SelectItem value="joint_stock">Joint Stock Company</SelectItem>
                                            <SelectItem value="partnership">Partnership</SelectItem>
                                            <SelectItem value="sole_proprietorship">Sole Proprietorship</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </TabsContent>

                        {/* Address */}
                        <TabsContent value="address" className="space-y-4 mt-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>City *</Label>
                                    <Input
                                        value={formData.city}
                                        onChange={(e) => setFormData({...formData, city: e.target.value})}
                                        required
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
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Street Name</Label>
                                    <Input
                                        value={formData.street_name}
                                        onChange={(e) => setFormData({...formData, street_name: e.target.value})}
                                        placeholder="King Fahd Road"
                                    />
                                </div>
                                <div>
                                    <Label>Building Number</Label>
                                    <Input
                                        value={formData.building_number}
                                        onChange={(e) => setFormData({...formData, building_number: e.target.value})}
                                        placeholder="1234"
                                    />
                                </div>
                            </div>

                            <div>
                                <Label>Full Address</Label>
                                <Textarea
                                    value={formData.headquarters_address}
                                    onChange={(e) => setFormData({...formData, headquarters_address: e.target.value})}
                                    rows={2}
                                />
                            </div>
                        </TabsContent>

                        {/* Financial */}
                        <TabsContent value="financial" className="space-y-4 mt-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Bank Name</Label>
                                    <Input
                                        value={formData.bank_name}
                                        onChange={(e) => setFormData({...formData, bank_name: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <Label>IBAN</Label>
                                    <Input
                                        value={formData.iban}
                                        onChange={(e) => setFormData({...formData, iban: e.target.value})}
                                        placeholder="SA..."
                                    />
                                </div>
                            </div>
                        </TabsContent>

                        {/* Settings */}
                        <TabsContent value="settings" className="space-y-4 mt-4">
                            <div className="flex items-center justify-between p-4 border rounded">
                                <div>
                                    <Label>Multi-Branch Operations</Label>
                                    <p className="text-sm text-gray-600">Enable multiple branches/locations</p>
                                </div>
                                <Switch
                                    checked={formData.multi_branch_enabled}
                                    onCheckedChange={(checked) => setFormData({...formData, multi_branch_enabled: checked})}
                                />
                            </div>
                        </TabsContent>
                    </Tabs>

                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                            {item ? 'Update' : 'Create'} Organization
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}