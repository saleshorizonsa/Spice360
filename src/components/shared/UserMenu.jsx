import React, { useState } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Key, LogOut, Eye, EyeOff } from "lucide-react";

export default function UserMenu({ onLogout, isRTL }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showDialog, setShowDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [form, setForm] = useState({ old: "", newPass: "", confirm: "" });

  const initials = user?.full_name
    ? user.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : (user?.email?.[0] || "U").toUpperCase();

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.newPass !== form.confirm) {
      toast({ title: isRTL ? "خطأ" : "Error", description: isRTL ? "كلمتا المرور الجديدتان غير متطابقتين." : "New passwords do not match.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      await matrixSales.auth.changePassword(form.old, form.newPass);
      toast({
        title: isRTL ? "تم تغيير كلمة المرور" : "Password changed",
        description: isRTL ? "تم تغيير كلمة المرور بنجاح. تم إرسال بريد إلكتروني للتأكيد." : "Password changed successfully. A confirmation email has been sent.",
      });
      setShowDialog(false);
      setForm({ old: "", newPass: "", confirm: "" });
    } catch (err) {
      toast({ title: isRTL ? "فشل التغيير" : "Change failed", description: err.message || "Could not change password.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[#24466f] text-xs font-bold text-white hover:bg-[#193658] focus:outline-none focus:ring-2 focus:ring-[#24466f] focus:ring-offset-2"
            aria-label="User menu"
          >
            {initials}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56" dir={isRTL ? "rtl" : "ltr"}>
          <DropdownMenuLabel className="font-normal">
            <p className="text-sm font-semibold leading-tight">{user?.full_name || "User"}</p>
            <p className="truncate text-xs text-slate-500">{user?.email}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setShowDialog(true)} className="cursor-pointer">
            <Key className="mr-2 h-4 w-4" />
            {isRTL ? "تغيير كلمة المرور" : "Change Password"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onLogout} className="cursor-pointer text-red-600 focus:text-red-600">
            <LogOut className="mr-2 h-4 w-4" />
            {isRTL ? "تسجيل الخروج" : "Logout"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={showDialog} onOpenChange={(v) => { setShowDialog(v); if (!v) setForm({ old: "", newPass: "", confirm: "" }); }}>
        <DialogContent className="sm:max-w-sm" dir={isRTL ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{isRTL ? "تغيير كلمة المرور" : "Change Password"}</DialogTitle>
            <DialogDescription>
              {isRTL
                ? "أدخل كلمة المرور الحالية ثم كلمة المرور الجديدة. سيتم إرسال بريد تأكيد."
                : "Enter your current password, then your new password. A confirmation email will be sent."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            {/* Current password */}
            <div className="space-y-1.5">
              <Label>{isRTL ? "كلمة المرور الحالية" : "Current Password"}</Label>
              <div className="relative">
                <Input
                  type={showOld ? "text" : "password"}
                  value={form.old}
                  onChange={set("old")}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowOld((v) => !v)}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                >
                  {showOld ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* New password */}
            <div className="space-y-1.5">
              <Label>{isRTL ? "كلمة المرور الجديدة" : "New Password"}</Label>
              <div className="relative">
                <Input
                  type={showNew ? "text" : "password"}
                  value={form.newPass}
                  onChange={set("newPass")}
                  required
                  autoComplete="new-password"
                  placeholder="••••••••"
                  className="pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowNew((v) => !v)}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                >
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-slate-500">
                {isRTL ? "8 أحرف على الأقل، حرف كبير، حرف صغير، رقم." : "Min 8 chars, uppercase, lowercase, and a number."}
              </p>
            </div>

            {/* Confirm new password */}
            <div className="space-y-1.5">
              <Label>{isRTL ? "تأكيد كلمة المرور الجديدة" : "Confirm New Password"}</Label>
              <div className="relative">
                <Input
                  type={showConfirm ? "text" : "password"}
                  value={form.confirm}
                  onChange={set("confirm")}
                  required
                  autoComplete="new-password"
                  placeholder="••••••••"
                  className="pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)} disabled={loading}>
                {isRTL ? "إلغاء" : "Cancel"}
              </Button>
              <Button type="submit" disabled={loading} className="bg-[#24466f] hover:bg-[#193658] text-white">
                {loading
                  ? (isRTL ? "جاري التغيير..." : "Changing...")
                  : (isRTL ? "تغيير كلمة المرور" : "Change Password")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
