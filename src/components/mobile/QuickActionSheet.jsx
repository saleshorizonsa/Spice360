import React from "react";
import { Link } from "react-router-dom";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import { 
    FileText, 
    ShoppingCart, 
    Package, 
    DollarSign, 
    ClipboardList,
    MessageCircle,
    Repeat2,
    Truck,
    Receipt,
    UserPlus
} from "lucide-react";
import { useLanguage } from "../utils/languageContext";
import { isPageEnabledForModules } from "@/lib/tenantModules";

export default function QuickActionSheet({ open, onOpenChange, createPageUrl, enabledModules, isPlatformOwner = false }) {
    const { t } = useLanguage();
    
    const quickActions = [
        {
            category: "Service Revenue",
            items: [
                { name: "Service Contract", icon: Repeat2, page: "Sales", params: "tab=services&action=new-contract", color: "bg-emerald-100 text-emerald-600" },
                { name: "Service Invoice", icon: Receipt, page: "Sales", params: "tab=invoices&mode=service", color: "bg-pink-100 text-pink-600" },
                { name: t('quotation'), icon: FileText, page: "Sales", params: "action=new-quotation", color: "bg-blue-100 text-blue-600" },
                { name: "WhatsApp Reminder", icon: MessageCircle, page: "Sales", params: "action=whatsapp-reminder", color: "bg-green-100 text-green-600" },
            ]
        },
        {
            category: t('sales'),
            items: [
                { name: t('salesOrder'), icon: ShoppingCart, page: "Sales", params: "action=new-order", color: "bg-emerald-100 text-emerald-600" },
                { name: t('delivery'), icon: Truck, page: "Sales", params: "action=new-delivery", color: "bg-purple-100 text-purple-600" },
            ]
        },
        {
            category: t('purchasing'),
            items: [
                { name: t('purchaseRequisition'), icon: ClipboardList, page: "Purchasing", params: "action=new-pr", color: "bg-orange-100 text-orange-600" },
                { name: t('purchaseOrder'), icon: Package, page: "Purchasing", params: "action=new-po", color: "bg-indigo-100 text-indigo-600" },
            ]
        },
        {
            category: t('finance'),
            items: [
                { name: t('invoice'), icon: Receipt, page: "Finance", params: "action=new-invoice", color: "bg-pink-100 text-pink-600" },
                { name: "Payment", icon: DollarSign, page: "Finance", params: "action=new-payment", color: "bg-green-100 text-green-600" },
            ]
        },
        {
            category: t('hr'),
            items: [
                { name: "Leave Request", icon: UserPlus, page: "HR", params: "action=new-leave", color: "bg-teal-100 text-teal-600" },
            ]
        }
    ]
        .map((category) => ({
            ...category,
            items: category.items.filter((item) => isPageEnabledForModules(item.page, enabledModules, isPlatformOwner))
        }))
        .filter((category) => category.items.length > 0);

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="bottom" className="h-[70vh] rounded-t-3xl">
                <SheetHeader className="pb-4">
                    <SheetTitle className="text-center">{t('create')} {t('new')}</SheetTitle>
                </SheetHeader>
                
                <div className="overflow-y-auto h-full pb-8 space-y-6">
                    {quickActions.map((category, idx) => (
                        <div key={idx}>
                            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                                {category.category}
                            </h3>
                            <div className="grid grid-cols-3 gap-3">
                                {category.items.map((action, actionIdx) => (
                                    <Link
                                        key={actionIdx}
                                        to={`${createPageUrl(action.page)}?${action.params}`}
                                        onClick={() => onOpenChange(false)}
                                        className="flex flex-col items-center p-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors"
                                    >
                                        <div className={`p-3 rounded-full ${action.color} mb-2`}>
                                            <action.icon className="w-5 h-5" />
                                        </div>
                                        <span className="text-xs text-center font-medium text-gray-700 line-clamp-2">
                                            {action.name}
                                        </span>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </SheetContent>
        </Sheet>
    );
}
