import React, { useState, useEffect } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const nationalities = [
    "Sri Lankan", "Indian", "Pakistani", "Bangladeshi", "Filipino", "Nepalese",
    "Chinese", "Japanese", "Korean", "Indonesian", "Malaysian", "Vietnamese",
    "British", "American", "Canadian", "Australian", "German", "French",
    "Nigerian", "Ghanaian", "South African", "Egyptian", "Jordanian", "Lebanese",
    "Other"
].sort((a, b) => a === "Sri Lankan" ? -1 : b === "Sri Lankan" ? 1 : a.localeCompare(b));

export default function EmployeeForm({ item, onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const [formData, setFormData] = useState({
        employee_number: '',
        employee_name: '',
        nationality: 'Sri Lankan',
        national_id: '',
        nic_number: '',
        epf_number: '',
        passport_number: '',
        passport_issue_date: '',
        passport_expiry_date: '',
        passport_issue_place: '',
        date_of_birth: '',
        age: 0,
        gender: 'male',
        marital_status: 'single',
        religion: '',
        number_of_dependents: 0,
        email: '',
        personal_email: '',
        mobile: '',
        whatsapp: '',
        phone: '',
        address: '',
        city: '',
        state: '',
        postal_code: '',
        permanent_address: '',
        emergency_contact_name: '',
        emergency_contact_relationship: '',
        emergency_contact_phone: '',
        emergency_contact_address: '',
        department: '',
        designation: '',
        joining_date: new Date().toISOString().split('T')[0],
        contract_type: 'unlimited',
        contract_start_date: '',
        contract_end_date: '',
        basic_salary: 0,
        hra_percent: 20,
        housing_allowance: 0,
        transport_percent: 10,
        transport_allowance: 0,
        food_allowance: 0,
        mobile_allowance: 0,
        other_allowances: 0,
        gross_salary: 0,
        bank_name: '',
        bank_branch: '',
        iban: '',
        bank_account_number: '',
        medical_insurance_provider: '',
        medical_insurance_number: '',
        medical_insurance_class: 'basic',
        medical_insurance_start_date: '',
        medical_insurance_expiry_date: '',
        medical_insurance_coverage: '',
        annual_leave_days: 21,
        leave_balance: 0,
        employment_status: 'active',
        blood_group: '',
        vaccination_status: ''
    });

    const [expiryAlerts, setExpiryAlerts] = useState([]);

    useEffect(() => {
        if (item) {
            setFormData(item);
        }
    }, [item]);

    // Auto-calculate allowances
    useEffect(() => {
        const basic = parseFloat(formData.basic_salary) || 0;
        const hra = basic * (formData.hra_percent / 100);
        const transport = basic * (formData.transport_percent / 100);
        const gross = basic + hra + transport + 
                     (parseFloat(formData.food_allowance) || 0) + 
                     (parseFloat(formData.mobile_allowance) || 0) +
                     (parseFloat(formData.other_allowances) || 0);

        setFormData(prev => ({
            ...prev,
            housing_allowance: hra,
            transport_allowance: transport,
            gross_salary: gross
        }));
    }, [formData.basic_salary, formData.hra_percent, formData.transport_percent, 
        formData.food_allowance, formData.mobile_allowance, formData.other_allowances]);

    // Calculate age from date of birth
    useEffect(() => {
        if (formData.date_of_birth) {
            const today = new Date();
            const birthDate = new Date(formData.date_of_birth);
            let age = today.getFullYear() - birthDate.getFullYear();
            const monthDiff = today.getMonth() - birthDate.getMonth();
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                age--;
            }
            setFormData(prev => ({ ...prev, age }));
        }
    }, [formData.date_of_birth]);

    // Check document expiry dates
    useEffect(() => {
        const alerts = [];
        const today = new Date();
        const thirtyDaysFromNow = new Date(today.getTime() + (30 * 24 * 60 * 60 * 1000));


        if (formData.passport_expiry_date) {
            const expiryDate = new Date(formData.passport_expiry_date);
            if (expiryDate < today) {
                alerts.push({ type: 'error', message: 'Passport has expired!' });
            } else if (expiryDate < thirtyDaysFromNow) {
                alerts.push({ type: 'warning', message: 'Passport expiring soon!' });
            }
        }

        if (formData.medical_insurance_expiry_date) {
            const expiryDate = new Date(formData.medical_insurance_expiry_date);
            if (expiryDate < today) {
                alerts.push({ type: 'error', message: 'Medical insurance has expired!' });
            } else if (expiryDate < thirtyDaysFromNow) {
                alerts.push({ type: 'warning', message: 'Medical insurance expiring soon!' });
            }
        }

        setExpiryAlerts(alerts);
    }, [formData.passport_expiry_date, formData.medical_insurance_expiry_date]);

    const handleNationalityChange = (value) => {
        setFormData(prev => ({ ...prev, nationality: value }));
    };

    const saveMutation = useMutation({
        mutationFn: (data) => {
            if (item) {
                return matrixSales.entities.Employee.update(item.id, data);
            }
            return matrixSales.entities.Employee.create(data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['employees'] });
            toast({
                title: "Success",
                description: "Employee saved successfully"
            });
            onClose();
        },
        onError: (error) => {
            toast({
                title: "Error",
                description: error.message || "Failed to save employee",
                variant: "destructive"
            });
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        saveMutation.mutate(formData);
    };

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-2xl">{item ? 'Edit' : 'New'} Employee</DialogTitle>
                </DialogHeader>

                {/* Expiry Alerts */}
                {expiryAlerts.length > 0 && (
                    <div className="space-y-2">
                        {expiryAlerts.map((alert, idx) => (
                            <Alert key={idx} variant={alert.type === 'error' ? 'destructive' : 'default'} 
                                   className={alert.type === 'warning' ? 'border-amber-500 bg-amber-50' : ''}>
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>
                                    {alert.message}
                                </AlertDescription>
                            </Alert>
                        ))}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <Tabs defaultValue="personal" className="w-full">
                        <TabsList className="grid grid-cols-6 w-full">
                            <TabsTrigger value="personal">Personal</TabsTrigger>
                            <TabsTrigger value="documents">Documents</TabsTrigger>
                            <TabsTrigger value="contact">Contact</TabsTrigger>
                            <TabsTrigger value="employment">Employment</TabsTrigger>
                            <TabsTrigger value="salary">Salary</TabsTrigger>
                            <TabsTrigger value="compliance">Compliance</TabsTrigger>
                        </TabsList>

                        {/* Personal Information */}
                        <TabsContent value="personal" className="space-y-4 mt-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Employee Number *</Label>
                                    <Input
                                        value={formData.employee_number}
                                        onChange={(e) => setFormData({...formData, employee_number: e.target.value})}
                                        required
                                        placeholder="EMP001"
                                    />
                                </div>
                                <div>
                                    <Label>Full Name (English) *</Label>
                                    <Input
                                        value={formData.employee_name}
                                        onChange={(e) => setFormData({...formData, employee_name: e.target.value})}
                                        required
                                        placeholder="Ahmed Mohammed Ali"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <Label>Nationality *</Label>
                                    <Select value={formData.nationality} onValueChange={handleNationalityChange}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select nationality" />
                                        </SelectTrigger>
                                        <SelectContent className="max-h-[300px]">
                                            {nationalities.map(nat => (
                                                <SelectItem key={nat} value={nat}>{nat}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label>National ID / Iqama *</Label>
                                    <Input
                                        value={formData.national_id}
                                        onChange={(e) => setFormData({...formData, national_id: e.target.value})}
                                        required
                                        placeholder="2345678901"
                                    />
                                </div>
                                <div>
                                    <Label>Date of Birth *</Label>
                                    <Input
                                        type="date"
                                        value={formData.date_of_birth}
                                        onChange={(e) => setFormData({...formData, date_of_birth: e.target.value})}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-4 gap-4">
                                <div>
                                    <Label>Age</Label>
                                    <Input
                                        value={formData.age}
                                        disabled
                                        className="bg-gray-50"
                                    />
                                </div>
                                <div>
                                    <Label>Gender *</Label>
                                    <Select value={formData.gender} onValueChange={(val) => setFormData({...formData, gender: val})}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="male">Male</SelectItem>
                                            <SelectItem value="female">Female</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label>Marital Status</Label>
                                    <Select value={formData.marital_status} onValueChange={(val) => setFormData({...formData, marital_status: val})}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="single">Single</SelectItem>
                                            <SelectItem value="married">Married</SelectItem>
                                            <SelectItem value="divorced">Divorced</SelectItem>
                                            <SelectItem value="widowed">Widowed</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label>Number of Dependents</Label>
                                    <Input
                                        type="number"
                                        value={formData.number_of_dependents}
                                        onChange={(e) => setFormData({...formData, number_of_dependents: parseInt(e.target.value) || 0})}
                                        min="0"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Religion</Label>
                                    <Input
                                        value={formData.religion}
                                        onChange={(e) => setFormData({...formData, religion: e.target.value})}
                                        placeholder="Islam, Christianity, etc."
                                    />
                                </div>
                                <div>
                                    <Label>Blood Group</Label>
                                    <Select value={formData.blood_group} onValueChange={(val) => setFormData({...formData, blood_group: val})}>
                                        <SelectTrigger><SelectValue placeholder="Select blood group" /></SelectTrigger>
                                        <SelectContent>
                                            {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => (
                                                <SelectItem key={bg} value={bg}>{bg}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </TabsContent>

                        {/* Documents */}
                        <TabsContent value="documents" className="space-y-4 mt-4">
                            <div className="border-b pb-4">
                                <h3 className="font-semibold text-lg mb-4">National Identity Card (NIC)</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label>NIC Number</Label>
                                        <Input
                                            value={formData.nic_number || ''}
                                            onChange={(e) => setFormData({...formData, nic_number: e.target.value})}
                                            placeholder="199012345678 or 901234567V"
                                        />
                                    </div>
                                    <div>
                                        <Label>National ID Number</Label>
                                        <Input
                                            value={formData.national_id || ''}
                                            onChange={(e) => setFormData({...formData, national_id: e.target.value})}
                                            placeholder="Alternative ID"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <h3 className="font-semibold text-lg mb-4">Passport Details</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label>Passport Number *</Label>
                                        <Input
                                            value={formData.passport_number}
                                            onChange={(e) => setFormData({...formData, passport_number: e.target.value})}
                                            required
                                            placeholder="A12345678"
                                        />
                                    </div>
                                    <div>
                                        <Label>Passport Issue Place</Label>
                                        <Input
                                            value={formData.passport_issue_place}
                                            onChange={(e) => setFormData({...formData, passport_issue_place: e.target.value})}
                                            placeholder="Cairo, Mumbai, etc."
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4 mt-4">
                                    <div>
                                        <Label>Passport Issue Date</Label>
                                        <Input
                                            type="date"
                                            value={formData.passport_issue_date}
                                            onChange={(e) => setFormData({...formData, passport_issue_date: e.target.value})}
                                        />
                                    </div>
                                    <div>
                                        <Label>Passport Expiry Date</Label>
                                        <Input
                                            type="date"
                                            value={formData.passport_expiry_date}
                                            onChange={(e) => setFormData({...formData, passport_expiry_date: e.target.value})}
                                            className={formData.passport_expiry_date && new Date(formData.passport_expiry_date) < new Date() ? 'border-red-500' : ''}
                                        />
                                    </div>
                                </div>
                            </div>
                        </TabsContent>

                        {/* Contact Details */}
                        <TabsContent value="contact" className="space-y-4 mt-4">
                            <div className="border-b pb-4">
                                <h3 className="font-semibold text-lg mb-4">Contact Information</h3>
                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <Label>Official Email *</Label>
                                        <Input
                                            type="email"
                                            value={formData.email}
                                            onChange={(e) => setFormData({...formData, email: e.target.value})}
                                            required
                                            placeholder="kamal@company.lk"
                                        />
                                    </div>
                                    <div>
                                        <Label>Personal Email</Label>
                                        <Input
                                            type="email"
                                            value={formData.personal_email}
                                            onChange={(e) => setFormData({...formData, personal_email: e.target.value})}
                                            placeholder="kamal@gmail.com"
                                        />
                                    </div>
                                    <div>
                                        <Label>Mobile Number *</Label>
                                        <Input
                                            value={formData.mobile}
                                            onChange={(e) => setFormData({...formData, mobile: e.target.value})}
                                            required
                                            placeholder="+94712345678"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4 mt-4">
                                    <div>
                                        <Label>WhatsApp Number</Label>
                                        <Input
                                            value={formData.whatsapp}
                                            onChange={(e) => setFormData({...formData, whatsapp: e.target.value})}
                                            placeholder="+94712345678"
                                        />
                                    </div>
                                    <div>
                                        <Label>Office Phone</Label>
                                        <Input
                                            value={formData.phone}
                                            onChange={(e) => setFormData({...formData, phone: e.target.value})}
                                            placeholder="+94112345678"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="border-b pb-4">
                                <h3 className="font-semibold text-lg mb-4">Current Address</h3>
                                <div>
                                    <Label>Address</Label>
                                    <Textarea
                                        value={formData.address}
                                        onChange={(e) => setFormData({...formData, address: e.target.value})}
                                        placeholder="Building, Street, District"
                                        rows={2}
                                    />
                                </div>
                                <div className="grid grid-cols-3 gap-4 mt-4">
                                    <div>
                                        <Label>City</Label>
                                        <Input
                                            value={formData.city}
                                            onChange={(e) => setFormData({...formData, city: e.target.value})}
                                            placeholder="Riyadh, Jeddah, Dammam"
                                        />
                                    </div>
                                    <div>
                                        <Label>State/Province</Label>
                                        <Input
                                            value={formData.state}
                                            onChange={(e) => setFormData({...formData, state: e.target.value})}
                                            placeholder="Riyadh Province"
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
                            </div>

                            <div>
                                <h3 className="font-semibold text-lg mb-4">Emergency Contact</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label>Emergency Contact Name</Label>
                                        <Input
                                            value={formData.emergency_contact_name}
                                            onChange={(e) => setFormData({...formData, emergency_contact_name: e.target.value})}
                                            placeholder="Full name"
                                        />
                                    </div>
                                    <div>
                                        <Label>Relationship</Label>
                                        <Input
                                            value={formData.emergency_contact_relationship}
                                            onChange={(e) => setFormData({...formData, emergency_contact_relationship: e.target.value})}
                                            placeholder="Father, Brother, Wife, etc."
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4 mt-4">
                                    <div>
                                        <Label>Emergency Contact Phone</Label>
                                        <Input
                                            value={formData.emergency_contact_phone}
                                            onChange={(e) => setFormData({...formData, emergency_contact_phone: e.target.value})}
                                            placeholder="+94712345678"
                                        />
                                    </div>
                                    <div>
                                        <Label>Emergency Contact Address</Label>
                                        <Input
                                            value={formData.emergency_contact_address}
                                            onChange={(e) => setFormData({...formData, emergency_contact_address: e.target.value})}
                                            placeholder="Address"
                                        />
                                    </div>
                                </div>
                            </div>
                        </TabsContent>

                        {/* Employment Details */}
                        <TabsContent value="employment" className="space-y-4 mt-4">
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <Label>Joining Date *</Label>
                                    <Input
                                        type="date"
                                        value={formData.joining_date}
                                        onChange={(e) => setFormData({...formData, joining_date: e.target.value})}
                                        required
                                    />
                                </div>
                                <div>
                                    <Label>Department</Label>
                                    <Input
                                        value={formData.department}
                                        onChange={(e) => setFormData({...formData, department: e.target.value})}
                                        placeholder="Sales, Production, etc."
                                    />
                                </div>
                                <div>
                                    <Label>Designation</Label>
                                    <Input
                                        value={formData.designation}
                                        onChange={(e) => setFormData({...formData, designation: e.target.value})}
                                        placeholder="Manager, Engineer, etc."
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <Label>Contract Type</Label>
                                    <Select value={formData.contract_type} onValueChange={(val) => setFormData({...formData, contract_type: val})}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="unlimited">Unlimited Contract</SelectItem>
                                            <SelectItem value="limited">Limited Contract</SelectItem>
                                            <SelectItem value="probation">Probation</SelectItem>
                                            <SelectItem value="part_time">Part Time</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label>Contract Start Date</Label>
                                    <Input
                                        type="date"
                                        value={formData.contract_start_date}
                                        onChange={(e) => setFormData({...formData, contract_start_date: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <Label>Contract End Date</Label>
                                    <Input
                                        type="date"
                                        value={formData.contract_end_date}
                                        onChange={(e) => setFormData({...formData, contract_end_date: e.target.value})}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Employment Status</Label>
                                    <Select value={formData.employment_status} onValueChange={(val) => setFormData({...formData, employment_status: val})}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="active">Active</SelectItem>
                                            <SelectItem value="on_leave">On Leave</SelectItem>
                                            <SelectItem value="suspended">Suspended</SelectItem>
                                            <SelectItem value="resigned">Resigned</SelectItem>
                                            <SelectItem value="terminated">Terminated</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label>Annual Leave Days</Label>
                                    <Input
                                        type="number"
                                        value={formData.annual_leave_days}
                                        onChange={(e) => setFormData({...formData, annual_leave_days: parseInt(e.target.value) || 21})}
                                        min="0"
                                    />
                                </div>
                            </div>
                        </TabsContent>

                        {/* Salary & Benefits */}
                        <TabsContent value="salary" className="space-y-4 mt-4">
                            <div className="bg-blue-50 p-4 rounded-lg mb-4">
                                <p className="text-sm text-blue-900">
                                    <strong>Note:</strong> HRA and Transport allowances are calculated automatically based on basic salary percentages.
                                </p>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <Label>Basic Salary (LKR) *</Label>
                                    <Input
                                        type="number"
                                        value={formData.basic_salary}
                                        onChange={(e) => setFormData({...formData, basic_salary: parseFloat(e.target.value) || 0})}
                                        required
                                        min="0"
                                        step="0.01"
                                    />
                                </div>
                                <div>
                                    <Label>HRA % (Default 20%)</Label>
                                    <Input
                                        type="number"
                                        value={formData.hra_percent}
                                        onChange={(e) => setFormData({...formData, hra_percent: parseFloat(e.target.value) || 20})}
                                        min="0"
                                        max="100"
                                        step="0.1"
                                    />
                                </div>
                                <div>
                                    <Label>Housing Allowance (Auto)</Label>
                                    <Input
                                        value={formData.housing_allowance.toFixed(2)}
                                        disabled
                                        className="bg-gray-50 font-semibold"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <Label>Transport % (Default 10%)</Label>
                                    <Input
                                        type="number"
                                        value={formData.transport_percent}
                                        onChange={(e) => setFormData({...formData, transport_percent: parseFloat(e.target.value) || 10})}
                                        min="0"
                                        max="100"
                                        step="0.1"
                                    />
                                </div>
                                <div>
                                    <Label>Transport Allowance (Auto)</Label>
                                    <Input
                                        value={formData.transport_allowance.toFixed(2)}
                                        disabled
                                        className="bg-gray-50 font-semibold"
                                    />
                                </div>
                                <div>
                                    <Label>Food Allowance</Label>
                                    <Input
                                        type="number"
                                        value={formData.food_allowance}
                                        onChange={(e) => setFormData({...formData, food_allowance: parseFloat(e.target.value) || 0})}
                                        min="0"
                                        step="0.01"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <Label>Mobile Allowance</Label>
                                    <Input
                                        type="number"
                                        value={formData.mobile_allowance}
                                        onChange={(e) => setFormData({...formData, mobile_allowance: parseFloat(e.target.value) || 0})}
                                        min="0"
                                        step="0.01"
                                    />
                                </div>
                                <div>
                                    <Label>Other Allowances</Label>
                                    <Input
                                        type="number"
                                        value={formData.other_allowances}
                                        onChange={(e) => setFormData({...formData, other_allowances: parseFloat(e.target.value) || 0})}
                                        min="0"
                                        step="0.01"
                                    />
                                </div>
                                <div>
                                    <Label>Gross Salary (Auto)</Label>
                                    <Input
                                        value={formData.gross_salary.toFixed(2)}
                                        disabled
                                        className="bg-emerald-50 font-bold text-emerald-700"
                                    />
                                </div>
                            </div>

                            <div className="border-t pt-4 mt-4">
                                <h3 className="font-semibold text-lg mb-4">Bank Details</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label>Bank Name</Label>
                                        <Input
                                            value={formData.bank_name}
                                            onChange={(e) => setFormData({...formData, bank_name: e.target.value})}
                                            placeholder="Al Rajhi Bank, NCB, etc."
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
                                <div className="grid grid-cols-2 gap-4 mt-4">
                                    <div>
                                        <Label>IBAN (For WPS)</Label>
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
                                </div>
                            </div>
                        </TabsContent>

                        {/* Compliance */}
                        <TabsContent value="compliance" className="space-y-4 mt-4">
                            <div className="border-b pb-4">
                                <h3 className="font-semibold text-lg mb-4">EPF / ETF Details</h3>
                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <Label>EPF Member Number</Label>
                                        <Input
                                            value={formData.epf_number || ''}
                                            onChange={(e) => setFormData({...formData, epf_number: e.target.value})}
                                            placeholder="EPF-123456"
                                        />
                                    </div>
                                    <div>
                                        <Label>EPF Registration Date</Label>
                                        <Input
                                            type="date"
                                            value={formData.epf_registration_date || ''}
                                            onChange={(e) => setFormData({...formData, epf_registration_date: e.target.value})}
                                        />
                                    </div>
                                    <div>
                                        <Label>ETF Number</Label>
                                        <Input
                                            value={formData.etf_number || ''}
                                            onChange={(e) => setFormData({...formData, etf_number: e.target.value})}
                                            placeholder="ETF-123456"
                                        />
                                    </div>
                                </div>
                                <div className="mt-3 p-3 bg-blue-50 rounded text-sm text-blue-800">
                                    EPF: 8% employee + 12% employer. ETF: 3% employer. APIT withheld at source based on progressive brackets.
                                </div>
                            </div>

                            <div>
                                <h3 className="font-semibold text-lg mb-4">Medical Insurance</h3>
                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <Label>Insurance Provider</Label>
                                        <Input
                                            value={formData.medical_insurance_provider}
                                            onChange={(e) => setFormData({...formData, medical_insurance_provider: e.target.value})}
                                            placeholder="Bupa, Tawuniya, etc."
                                        />
                                    </div>
                                    <div>
                                        <Label>Policy Number</Label>
                                        <Input
                                            value={formData.medical_insurance_number}
                                            onChange={(e) => setFormData({...formData, medical_insurance_number: e.target.value})}
                                            placeholder="POL-123456"
                                        />
                                    </div>
                                    <div>
                                        <Label>Insurance Class</Label>
                                        <Select value={formData.medical_insurance_class} onValueChange={(val) => setFormData({...formData, medical_insurance_class: val})}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="basic">Basic</SelectItem>
                                                <SelectItem value="standard">Standard</SelectItem>
                                                <SelectItem value="premium">Premium</SelectItem>
                                                <SelectItem value="vip">VIP</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-4 mt-4">
                                    <div>
                                        <Label>Insurance Start Date</Label>
                                        <Input
                                            type="date"
                                            value={formData.medical_insurance_start_date}
                                            onChange={(e) => setFormData({...formData, medical_insurance_start_date: e.target.value})}
                                        />
                                    </div>
                                    <div>
                                        <Label>Insurance Expiry Date</Label>
                                        <Input
                                            type="date"
                                            value={formData.medical_insurance_expiry_date}
                                            onChange={(e) => setFormData({...formData, medical_insurance_expiry_date: e.target.value})}
                                            className={formData.medical_insurance_expiry_date && new Date(formData.medical_insurance_expiry_date) < new Date() ? 'border-red-500' : ''}
                                        />
                                    </div>
                                    <div>
                                        <Label>Coverage Details</Label>
                                        <Input
                                            value={formData.medical_insurance_coverage}
                                            onChange={(e) => setFormData({...formData, medical_insurance_coverage: e.target.value})}
                                            placeholder="Individual / Family"
                                        />
                                    </div>
                                </div>
                            </div>
                        </TabsContent>
                    </Tabs>

                    <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" disabled={saveMutation.isLoading}>
                            {saveMutation.isLoading ? 'Saving...' : (item ? 'Update Employee' : 'Create Employee')}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}