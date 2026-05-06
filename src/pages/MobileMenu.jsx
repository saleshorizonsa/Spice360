import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { matrixSales } from "@/api/matrixSalesClient";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
    LayoutDashboard, 
    Factory, 
    Package, 
    CheckCircle2, 
    ShoppingCart, 
    FileText,
    TrendingUp,
    DollarSign,
    Wrench,
    Users,
    FileCheck,
    Briefcase,
    Target,
    BarChart3,
    Clock,
    Database,
    Calculator,
    Bot,
    Scissors,
    Search,
    ChevronRight,
    LogOut,
    Settings,
    Landmark
} from "lucide-react";
import { useLanguage } from "../components/utils/languageContext";

export default function MobileMenu() {
    const { t, isRTL, toggleLanguage, language } = useLanguage();
    const [user, setUser] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const currentUser = await matrixSales.auth.me();
                setUser(currentUser);
            } catch (error) {
                console.error('Error fetching user:', error);
            }
        };
        fetchUser();
    }, []);

    const menuSections = [
        {
            title: "Overview",
            items: [
                { name: t('dashboard'), path: "Dashboard", icon: LayoutDashboard },
                { name: t('analytics'), path: "Analytics", icon: BarChart3 },
                { name: "AI Assistant", path: "AIAssistant", icon: Bot },
                { name: "KPI Dashboard", path: "KPIDashboard", icon: Target },
            ]
        },
        {
            title: t('sales'),
            items: [
                { name: t('sales'), path: "Sales", icon: ShoppingCart },
            ]
        },
        {
            title: "Manufacturing",
            items: [
                { name: t('production'), path: "Production", icon: Factory },
                { name: "Coil Management", path: "CoilManagement", icon: Scissors },
            ]
        },
        {
            title: t('inventory'),
            items: [
                { name: t('inventory'), path: "Inventory", icon: Package },
                { name: t('quality'), path: "Quality", icon: CheckCircle2 },
            ]
        },
        {
            title: "Supply Chain",
            items: [
                { name: t('purchasing'), path: "Purchasing", icon: FileText },
                { name: t('supplyChain'), path: "SupplyChain", icon: TrendingUp },
            ]
        },
        {
            title: t('finance'),
            items: [
                { name: "Costing", path: "Costing", icon: Calculator },
                { name: t('finance'), path: "Finance", icon: DollarSign },
                { name: "Treasury", path: "TreasuryManagement", icon: Landmark },
            ]
        },
        {
            title: "Operations",
            items: [
                { name: t('projects'), path: "Projects", icon: Briefcase },
                { name: t('maintenance'), path: "Maintenance", icon: Wrench },
            ]
        },
        {
            title: t('hr'),
            items: [
                { name: t('hrPayroll'), path: "HR", icon: Users },
            ]
        },
        {
            title: "Compliance",
            items: [
                { name: t('zatca'), path: "ZATCA", icon: FileCheck },
                { name: t('reports'), path: "Reports", icon: FileCheck },
            ]
        },
        {
            title: "Administration",
            items: [
                { name: t('approvals'), path: "Approvals", icon: Clock },
                { name: t('masterData'), path: "MasterDataManagement", icon: Database },
                { name: t('adminCenter'), path: "AdminCenter", icon: Settings },
            ]
        }
    ];

    const filteredSections = menuSections.map(section => ({
        ...section,
        items: section.items.filter(item => 
            item.name.toLowerCase().includes(searchQuery.toLowerCase())
        )
    })).filter(section => section.items.length > 0);

    const handleLogout = () => {
        matrixSales.auth.logout();
    };

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            {/* Header */}
            <div className="bg-white p-4 border-b sticky top-0 z-10">
                <div className="flex items-center gap-3 mb-4">
                    {user && (
                        <>
                            <div className="w-12 h-12 bg-emerald-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                                {user.full_name?.charAt(0) || user.email?.charAt(0) || 'U'}
                            </div>
                            <div className="flex-1">
                                <p className="font-semibold text-gray-900">{user.full_name || 'User'}</p>
                                <p className="text-sm text-gray-500">{user.email}</p>
                            </div>
                        </>
                    )}
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                        placeholder={`${t('search')}...`}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                    />
                </div>
            </div>

            {/* Menu Sections */}
            <div className="p-4 space-y-4">
                {filteredSections.map((section, sectionIdx) => (
                    <div key={sectionIdx}>
                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-1">
                            {section.title}
                        </h3>
                        <Card>
                            <CardContent className="p-0 divide-y">
                                {section.items.map((item, itemIdx) => {
                                    const Icon = item.icon;
                                    return (
                                        <Link
                                            key={itemIdx}
                                            to={createPageUrl(item.path)}
                                            className="flex items-center gap-3 p-4 hover:bg-gray-50 active:bg-gray-100 transition-colors"
                                        >
                                            <div className="bg-gray-100 p-2 rounded-lg">
                                                <Icon className="w-5 h-5 text-gray-600" />
                                            </div>
                                            <span className="flex-1 font-medium text-gray-900">{item.name}</span>
                                            <ChevronRight className="w-5 h-5 text-gray-400" />
                                        </Link>
                                    );
                                })}
                            </CardContent>
                        </Card>
                    </div>
                ))}

                {/* Language Toggle & Logout */}
                <Card>
                    <CardContent className="p-0 divide-y">
                        <button
                            onClick={toggleLanguage}
                            className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 active:bg-gray-100 transition-colors"
                        >
                            <div className="bg-blue-100 p-2 rounded-lg">
                                <span className="text-blue-600 font-bold text-sm">
                                    {language === 'en' ? 'AR' : 'EN'}
                                </span>
                            </div>
                            <span className="flex-1 font-medium text-gray-900 text-left">
                                {language === 'en' ? 'العربية' : 'English'}
                            </span>
                            <Badge variant="outline">{language.toUpperCase()}</Badge>
                        </button>
                        
                        <button
                            onClick={handleLogout}
                            className="w-full flex items-center gap-3 p-4 hover:bg-red-50 active:bg-red-100 transition-colors text-red-600"
                        >
                            <div className="bg-red-100 p-2 rounded-lg">
                                <LogOut className="w-5 h-5 text-red-600" />
                            </div>
                            <span className="flex-1 font-medium text-left">Logout</span>
                        </button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
