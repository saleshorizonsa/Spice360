import React, { useState } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";

export default function AcceptInviteScreen({ email, onAccepted }) {
    const { toast } = useToast();
    const [form, setForm] = useState({ full_name: "", password: "", confirm: "" });
    const [showPw, setShowPw] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!form.full_name.trim()) {
            toast({ title: "Required", description: "Please enter your full name.", variant: "destructive" });
            return;
        }
        if (form.password !== form.confirm) {
            toast({ title: "Passwords don't match", description: "Re-enter your new password.", variant: "destructive" });
            return;
        }

        setSubmitting(true);
        try {
            const result = await matrixSales.auth.acceptInvite({
                email,
                password: form.password,
                full_name: form.full_name.trim(),
            });

            // Mark the User entity as active (best-effort — may fail if entity table is empty)
            try {
                const userEntities = await matrixSales.entities.User.filter({ email });
                const userEntity = userEntities?.[0];
                if (userEntity?.id) {
                    await matrixSales.entities.User.update(userEntity.id, {
                        status: "active",
                        is_active: true,
                        full_name: form.full_name.trim(),
                    });
                }
            } catch {
                // Non-fatal
            }

            toast({ title: "Welcome!", description: "Your account is set up. You are now logged in." });
            onAccepted(result.user);
        } catch (err) {
            toast({ title: "Setup failed", description: err.message || "Could not activate your account.", variant: "destructive" });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#f5f7fb] flex items-center justify-center px-4">
            <div className="w-full max-w-md">
                <div className="bg-white rounded-2xl border shadow-xl p-8 space-y-6">
                    <div className="text-center">
                        <div className="flex justify-center mb-4">
                            <BrandLogo />
                        </div>
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-100 mb-3">
                            <ShieldCheck className="w-6 h-6 text-emerald-600" />
                        </div>
                        <h1 className="text-2xl font-bold text-slate-800">Accept Your Invitation</h1>
                        <p className="text-slate-500 text-sm mt-1">
                            Set your name and password to activate your account.
                        </p>
                    </div>

                    <div className="bg-slate-50 rounded-lg px-4 py-3">
                        <p className="text-xs text-slate-500">Invited email</p>
                        <p className="text-sm font-semibold text-slate-800">{email}</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-1.5">
                            <Label>Full Name <span className="text-red-500">*</span></Label>
                            <Input
                                value={form.full_name}
                                onChange={set("full_name")}
                                placeholder="Your full name"
                                autoFocus
                                required
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label>Password <span className="text-red-500">*</span></Label>
                            <div className="relative">
                                <Input
                                    type={showPw ? "text" : "password"}
                                    value={form.password}
                                    onChange={set("password")}
                                    placeholder="••••••••"
                                    autoComplete="new-password"
                                    required
                                    className="pr-9"
                                />
                                <button type="button" tabIndex={-1}
                                    onClick={() => setShowPw((v) => !v)}
                                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600">
                                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                            <p className="text-xs text-slate-500">Min 8 chars, uppercase, lowercase, and a number.</p>
                        </div>

                        <div className="space-y-1.5">
                            <Label>Confirm Password <span className="text-red-500">*</span></Label>
                            <div className="relative">
                                <Input
                                    type={showConfirm ? "text" : "password"}
                                    value={form.confirm}
                                    onChange={set("confirm")}
                                    placeholder="••••••••"
                                    autoComplete="new-password"
                                    required
                                    className="pr-9"
                                />
                                <button type="button" tabIndex={-1}
                                    onClick={() => setShowConfirm((v) => !v)}
                                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600">
                                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>

                        <Button
                            type="submit"
                            disabled={submitting}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold h-11"
                        >
                            {submitting ? "Setting up your account…" : "Activate Account & Sign In"}
                        </Button>
                    </form>
                </div>
            </div>
        </div>
    );
}
