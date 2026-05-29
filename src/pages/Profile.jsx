import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { matrixSales } from "@/api/matrixSalesClient";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
    User, Mail, Phone, Briefcase, Building2, Globe, Shield,
    Edit2, Check, X, Eye, EyeOff, KeyRound, Clock, CheckCircle2
} from "lucide-react";
import { useLanguage } from "@/components/utils/languageContext";
import moment from "moment";

const TIMEZONES = [
    "Asia/Riyadh",
    "Asia/Dubai",
    "Asia/Kuwait",
    "Asia/Bahrain",
    "Asia/Muscat",
    "Asia/Qatar",
    "Africa/Cairo",
    "Europe/London",
    "Europe/Paris",
    "America/New_York",
    "America/Los_Angeles",
    "UTC",
];

const ROLE_LABELS = {
    owner: { label: "Platform Owner", color: "bg-purple-100 text-purple-700" },
    admin: { label: "Administrator", color: "bg-blue-100 text-blue-700" },
    user:  { label: "User",          color: "bg-slate-100 text-slate-700" },
};

function AvatarCircle({ name, size = "lg" }) {
    const initials = name
        ? name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
        : "U";
    const sizeClass = size === "lg"
        ? "h-24 w-24 text-3xl"
        : "h-10 w-10 text-sm";
    return (
        <div className={`flex items-center justify-center rounded-full bg-[#24466f] font-bold text-white ${sizeClass}`}>
            {initials}
        </div>
    );
}

function ReadOnlyRow({ icon: Icon, label, value, extra }) {
    return (
        <div className="flex items-start gap-3 py-3 border-b last:border-0">
            <div className="mt-0.5 flex-shrink-0 text-slate-400">
                <Icon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-500 mb-0.5">{label}</p>
                <p className="text-sm font-medium text-slate-800 break-all">{value || "—"}</p>
                {extra}
            </div>
        </div>
    );
}

export default function Profile() {
    const { user, isAuthenticated } = useAuth();
    const { toast } = useToast();
    const { isRTL } = useLanguage?.() ?? { isRTL: false };

    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        full_name: "",
        phone: "",
        job_title: "",
        department: "",
        language_preference: "en",
        timezone: "Asia/Riyadh",
    });

    // Change-password state
    const [showPwSection, setShowPwSection] = useState(false);
    const [pwForm, setPwForm] = useState({ old: "", newPass: "", confirm: "" });
    const [showOld, setShowOld] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [pwSaving, setPwSaving] = useState(false);

    useEffect(() => {
        if (user) {
            setForm({
                full_name:           user.full_name || "",
                phone:               user.phone || "",
                job_title:           user.job_title || "",
                department:          user.department || "",
                language_preference: user.language_preference || "en",
                timezone:            user.timezone || "Asia/Riyadh",
            });
        }
    }, [user]);

    const set = (field) => (e) =>
        setForm((f) => ({ ...f, [field]: e.target.value }));

    const handleSave = async () => {
        setSaving(true);
        try {
            await matrixSales.auth.updateProfile(form);
            toast({ title: "Profile updated", description: "Your changes have been saved." });
            setEditing(false);
        } catch (err) {
            toast({ title: "Save failed", description: err.message || "Could not save profile.", variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = () => {
        setForm({
            full_name:           user?.full_name || "",
            phone:               user?.phone || "",
            job_title:           user?.job_title || "",
            department:          user?.department || "",
            language_preference: user?.language_preference || "en",
            timezone:            user?.timezone || "Asia/Riyadh",
        });
        setEditing(false);
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        if (pwForm.newPass !== pwForm.confirm) {
            toast({ title: "Passwords don't match", description: "New passwords must match.", variant: "destructive" });
            return;
        }
        setPwSaving(true);
        try {
            await matrixSales.auth.changePassword(pwForm.old, pwForm.newPass);
            toast({ title: "Password changed", description: "A confirmation email has been sent." });
            setShowPwSection(false);
            setPwForm({ old: "", newPass: "", confirm: "" });
        } catch (err) {
            toast({ title: "Failed", description: err.message || "Could not change password.", variant: "destructive" });
        } finally {
            setPwSaving(false);
        }
    };

    if (!isAuthenticated || !user) return null;

    const roleInfo = ROLE_LABELS[user.role] || ROLE_LABELS.user;
    const memberSince = user.created_at ? moment(user.created_at).format("MMMM D, YYYY") : null;

    return (
        <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-slate-800">My Profile</h1>
                <p className="text-sm text-slate-500 mt-1">Manage your personal information and account settings</p>
            </div>

            {/* Avatar + Summary */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex items-center gap-5">
                        <AvatarCircle name={user.full_name} size="lg" />
                        <div>
                            <h2 className="text-xl font-semibold text-slate-800">{user.full_name}</h2>
                            {user.job_title && (
                                <p className="text-sm text-slate-500 mt-0.5">{user.job_title}
                                    {user.department && <span className="text-slate-400"> · {user.department}</span>}
                                </p>
                            )}
                            <div className="flex items-center gap-2 mt-2">
                                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${roleInfo.color}`}>
                                    {roleInfo.label}
                                </span>
                                {memberSince && (
                                    <span className="text-xs text-slate-400 flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        Member since {memberSince}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Personal Information */}
            <Card>
                <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                            <User className="h-4 w-4 text-slate-500" />
                            Personal Information
                        </CardTitle>
                        {!editing ? (
                            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                                <Edit2 className="h-3.5 w-3.5 mr-1.5" />
                                Edit
                            </Button>
                        ) : (
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={handleCancel} disabled={saving}>
                                    <X className="h-3.5 w-3.5 mr-1" />
                                    Cancel
                                </Button>
                                <Button size="sm" onClick={handleSave} disabled={saving}
                                    className="bg-[#24466f] hover:bg-[#193658] text-white">
                                    <Check className="h-3.5 w-3.5 mr-1" />
                                    {saving ? "Saving…" : "Save"}
                                </Button>
                            </div>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {editing ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5 sm:col-span-2">
                                <Label>Full Name <span className="text-red-500">*</span></Label>
                                <Input value={form.full_name} onChange={set("full_name")} placeholder="Your full name" />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Phone</Label>
                                <Input value={form.phone} onChange={set("phone")} placeholder="+966 50 000 0000" type="tel" />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Job Title</Label>
                                <Input value={form.job_title} onChange={set("job_title")} placeholder="e.g. Finance Manager" />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Department</Label>
                                <Input value={form.department} onChange={set("department")} placeholder="e.g. Finance" />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Language</Label>
                                <Select value={form.language_preference}
                                    onValueChange={(v) => setForm((f) => ({ ...f, language_preference: v }))}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="en">English</SelectItem>
                                        <SelectItem value="ar">العربية</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5 sm:col-span-2">
                                <Label>Timezone</Label>
                                <Select value={form.timezone}
                                    onValueChange={(v) => setForm((f) => ({ ...f, timezone: v }))}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {TIMEZONES.map((tz) => (
                                            <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    ) : (
                        <div className="divide-y">
                            <ReadOnlyRow icon={User}     label="Full Name"   value={user.full_name} />
                            <ReadOnlyRow icon={Phone}    label="Phone"       value={user.phone} />
                            <ReadOnlyRow icon={Briefcase} label="Job Title"  value={user.job_title} />
                            <ReadOnlyRow icon={Building2} label="Department" value={user.department} />
                            <ReadOnlyRow icon={Globe}    label="Language"
                                value={user.language_preference === "ar" ? "العربية" : "English"} />
                            <ReadOnlyRow icon={Clock}    label="Timezone"    value={user.timezone || "Asia/Riyadh"} />
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Account Information (read-only) */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Shield className="h-4 w-4 text-slate-500" />
                        Account Information
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="divide-y">
                        <ReadOnlyRow
                            icon={Mail}
                            label="Email Address"
                            value={user.email}
                            extra={
                                user.email_verified ? (
                                    <span className="inline-flex items-center gap-1 text-xs text-green-600 mt-1">
                                        <CheckCircle2 className="h-3 w-3" /> Verified
                                    </span>
                                ) : (
                                    <span className="text-xs text-amber-600 mt-1">Not verified</span>
                                )
                            }
                        />
                        <ReadOnlyRow
                            icon={Shield}
                            label="Role"
                            value={null}
                            extra={
                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium mt-1 ${roleInfo.color}`}>
                                    {roleInfo.label}
                                </span>
                            }
                        />
                        {memberSince && (
                            <ReadOnlyRow icon={Clock} label="Member Since" value={memberSince} />
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Security */}
            <Card>
                <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                            <KeyRound className="h-4 w-4 text-slate-500" />
                            Security
                        </CardTitle>
                        {!showPwSection && (
                            <Button variant="outline" size="sm" onClick={() => setShowPwSection(true)}>
                                Change Password
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    {!showPwSection ? (
                        <div className="flex items-center gap-3 py-1">
                            <div className="text-slate-400">
                                <KeyRound className="h-4 w-4" />
                            </div>
                            <div>
                                <p className="text-xs text-slate-500">Password</p>
                                <p className="text-sm font-medium text-slate-800 tracking-widest">••••••••••</p>
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleChangePassword} className="space-y-4">
                            <div className="space-y-1.5">
                                <Label>Current Password</Label>
                                <div className="relative">
                                    <Input type={showOld ? "text" : "password"} value={pwForm.old} required
                                        onChange={(e) => setPwForm((f) => ({ ...f, old: e.target.value }))}
                                        autoComplete="current-password" placeholder="••••••••" className="pr-9" />
                                    <button type="button" tabIndex={-1}
                                        onClick={() => setShowOld((v) => !v)}
                                        className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600">
                                        {showOld ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label>New Password</Label>
                                <div className="relative">
                                    <Input type={showNew ? "text" : "password"} value={pwForm.newPass} required
                                        onChange={(e) => setPwForm((f) => ({ ...f, newPass: e.target.value }))}
                                        autoComplete="new-password" placeholder="••••••••" className="pr-9" />
                                    <button type="button" tabIndex={-1}
                                        onClick={() => setShowNew((v) => !v)}
                                        className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600">
                                        {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                                <p className="text-xs text-slate-500">Min 8 chars, uppercase, lowercase, and a number.</p>
                            </div>

                            <div className="space-y-1.5">
                                <Label>Confirm New Password</Label>
                                <div className="relative">
                                    <Input type={showConfirm ? "text" : "password"} value={pwForm.confirm} required
                                        onChange={(e) => setPwForm((f) => ({ ...f, confirm: e.target.value }))}
                                        autoComplete="new-password" placeholder="••••••••" className="pr-9" />
                                    <button type="button" tabIndex={-1}
                                        onClick={() => setShowConfirm((v) => !v)}
                                        className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600">
                                        {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>

                            <div className="flex gap-2 pt-1">
                                <Button type="button" variant="outline" disabled={pwSaving}
                                    onClick={() => { setShowPwSection(false); setPwForm({ old: "", newPass: "", confirm: "" }); }}>
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={pwSaving}
                                    className="bg-[#24466f] hover:bg-[#193658] text-white">
                                    {pwSaving ? "Changing…" : "Change Password"}
                                </Button>
                            </div>
                        </form>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
