import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { User, LogOut, Building2 } from "lucide-react";

export default function UserMenu({ onLogout, isRTL }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const initials = user?.full_name
    ? user.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : (user?.email?.[0] || "U").toUpperCase();

  return (
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
          <p className="text-sm font-semibold leading-tight truncate">{user?.full_name || "User"}</p>
          <p className="truncate text-xs text-slate-500">{user?.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate("/Profile")} className="cursor-pointer">
          <User className="mr-2 h-4 w-4" />
          {isRTL ? "ملفي الشخصي" : "My Profile"}
        </DropdownMenuItem>
        {(user?.role === "owner" || user?.role === "admin") && (
          <DropdownMenuItem onSelect={() => navigate("/OrganizationSettings")} className="cursor-pointer">
            <Building2 className="mr-2 h-4 w-4" />
            {isRTL ? "إعدادات المنظمة" : "Organization Settings"}
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onLogout} className="cursor-pointer text-red-600 focus:text-red-600">
          <LogOut className="mr-2 h-4 w-4" />
          {isRTL ? "تسجيل الخروج" : "Logout"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
