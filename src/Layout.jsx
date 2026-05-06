import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "./utils";
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
    Menu,
    Settings,
    Users,
    FileCheck,
    Briefcase,
    
    Target,
    BarChart3,
    Clock,
    Database,
    Languages,
    Calculator,
    TrendingDown,
    Recycle,
    Bot,
    ArrowLeft,
    Brain,
    Landmark,
    LogOut
} from "lucide-react";
import { matrixSales } from "@/api/matrixSalesClient";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Toaster } from "@/components/ui/toaster";
import { LanguageProvider, useLanguage } from "@/components/utils/languageContext";
import { OrganizationProvider } from "@/components/utils/OrganizationContext";
import OrganizationSwitcher from "@/components/shared/OrganizationSwitcher";
import NotificationBell from "@/components/notifications/NotificationBell";
import AIChatButton from "@/components/ai/AIChatButton";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";
import QuickActionSheet from "@/components/mobile/QuickActionSheet";
import OfflineIndicator from "@/components/mobile/OfflineIndicator";
import { useAuth } from "@/lib/AuthContext";
import BrandLogo from "@/components/BrandLogo";

function LayoutContent({ children, currentPageName }) {
    const [showQuickAction, setShowQuickAction] = React.useState(false);
    const [pendingApprovals, setPendingApprovals] = React.useState(0);
    const [unreadNotifications, setUnreadNotifications] = React.useState(0);
    
    // Fetch counts for mobile nav badges
    React.useEffect(() => {
        const fetchCounts = async () => {
            try {
                const [approvals, notifications] = await Promise.all([
                    matrixSales.entities.ApprovalRequest.filter({ status: 'pending' }),
                    matrixSales.entities.Notification.filter({ is_read: false })
                ]);
                setPendingApprovals(approvals?.length || 0);
                setUnreadNotifications(notifications?.length || 0);
            } catch (error) {
                console.error('Error fetching counts:', error);
            }
        };
        fetchCounts();
        const interval = setInterval(fetchCounts, 60000);
        return () => clearInterval(interval);
    }, []);
    const { language, isRTL, toggleLanguage, t } = useLanguage();
    const { logout } = useAuth();
    const navigate = useNavigate();

    const menuItems = [
        { name: t('dashboard'), path: "Dashboard", icon: LayoutDashboard, section: "Overview" },
        { name: t('analytics'), path: "Analytics", icon: BarChart3, section: "Overview" },
        { name: "AI Assistant", path: "AIAssistant", icon: Bot, section: "Overview" },
        { name: "KPI Dashboard", path: "KPIDashboard", icon: Target, section: "Overview" },
        { name: t('crm'), path: "CRM", icon: Target, section: "Sales" },
        { name: t('sales'), path: "Sales", icon: ShoppingCart, section: "Sales" },
        { name: "Point of Sale", path: "POS", icon: DollarSign, section: "Sales" },

        { name: t('inventory'), path: "Inventory", icon: Package, section: "Inventory" },
        { name: t('quality'), path: "Quality", icon: CheckCircle2, section: "Inventory" },
        { name: t('purchasing'), path: "Purchasing", icon: FileText, section: "Supply Chain" },
        { name: t('supplyChain'), path: "SupplyChain", icon: TrendingUp, section: "Supply Chain" },
        { name: "Demand Planning", path: "DemandPlanning", icon: Brain, section: "Supply Chain" },
        { name: "Costing", path: "Costing", icon: Calculator, section: "Finance" },
        { name: t('finance'), path: "Finance", icon: DollarSign, section: "Finance" },
        { name: "Treasury Management", path: "TreasuryManagement", icon: Landmark, section: "Finance" },
        { name: "Depreciation Reports", path: "DepreciationReports", icon: TrendingDown, section: "Finance" },
        { name: "Asset Lifecycle", path: "AssetLifecycle", icon: Recycle, section: "Finance" },
        { name: t('projects'), path: "Projects", icon: Briefcase, section: "Projects" },

        { name: t('hrPayroll'), path: "HR", icon: Users, section: "HR" },
        { name: t('zatca'), path: "ZATCA", icon: FileCheck, section: "Compliance" },
        { name: t('reports'), path: "Reports", icon: FileCheck, section: "Reports" },
        { name: t('approvals'), path: "Approvals", icon: Clock, section: "Workflow" },
        { name: "Approval Workflows", path: "ApprovalWorkflows", icon: Settings, section: "Workflow" },
        { name: t('masterData'), path: "MasterDataManagement", icon: Database, section: "Administration" },
        { name: t('adminCenter'), path: "AdminCenter", icon: Settings, section: "Administration" }
    ];

    const groupedMenuItems = menuItems.reduce((acc, item) => {
        if (!acc[item.section]) {
            acc[item.section] = [];
        }
        acc[item.section].push(item);
        return acc;
    }, {});

    const sectionOrder = [
        "Overview",
        "Sales",
        "Inventory",
        "Supply Chain",
        "Finance",
        "Projects",

        "HR",
        "Compliance",
        "Reports",
        "Workflow",
        "Administration"
    ];

    const NavContent = () => (
        <>
            <OrganizationSwitcher />
            <div className="space-y-1 px-4">
                {sectionOrder.map(section => {
                    const items = groupedMenuItems[section];
                    if (!items || items.length === 0) return null;
                    
                    return (
                        <div key={section}>
                            <div className="px-4 pt-4 pb-2">
                                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    {section}
                                </h3>
                            </div>
                            
                            {items.map((item) => {
                                const Icon = item.icon;
                                const isActive = currentPageName === item.path;
                                return (
                                    <Link
                                        key={item.path}
                                        to={createPageUrl(item.path)}
                                        className={`flex items-center gap-3 rounded-lg px-4 py-2.5 transition-colors ${
                                            isActive
                                                ? "bg-[#24466f] text-white shadow-sm"
                                                : "text-slate-700 hover:bg-[#eef3f9] hover:text-[#24466f]"
                                        }`}
                                    >
                                        <Icon className="w-5 h-5" />
                                        <span className="font-medium">{item.name}</span>
                                    </Link>
                                );
                            })}
                        </div>
                    );
                })}
            </div>
        </>
    );

    return (
        <div className={`min-h-screen bg-[#f5f7fb] ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
            <aside className={`hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col ${isRTL ? 'lg:right-0' : 'lg:left-0'}`}>
                <div className="flex flex-grow flex-col overflow-y-auto border-r border-slate-200 bg-white shadow-xl shadow-slate-200/60">
                    <div className="border-b border-slate-100 px-5 py-5">
                        <div className="rounded-2xl bg-white p-2 shadow-sm ring-1 ring-slate-100">
                            <BrandLogo imageClassName="h-14" />
                        </div>
                    </div>
                    
                    <div className="border-b border-slate-100 px-4 py-3">
                        <Button
                            onClick={toggleLanguage}
                            variant="outline"
                            size="sm"
                            className="w-full justify-start gap-2 border-slate-200 bg-[#f8fafc]"
                        >
                            <Languages className="w-4 h-4" />
                            <span className="flex-1 text-start">{language === 'en' ? 'العربية' : 'English'}</span>
                            <span className="text-xs text-gray-500">
                                {language === 'en' ? 'AR' : 'EN'}
                            </span>
                        </Button>
                        <Button
                            onClick={() => logout()}
                            variant="ghost"
                            size="sm"
                            className="mt-2 w-full justify-start gap-2 text-red-600 hover:bg-red-50 hover:text-red-700"
                        >
                            <LogOut className="w-4 h-4" />
                            <span className="flex-1 truncate text-start">Logout</span>
                        </Button>
                    </div>

                    <nav className="flex-1 overflow-y-auto py-5">
                        <NavContent />
                    </nav>
                </div>
            </aside>

            <div className="fixed left-0 right-0 top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur lg:hidden">
                <div className="flex items-center justify-between px-4 py-4">
                    <BrandLogo imageClassName="h-10" />
                    
                    <div className="flex items-center gap-2">
                        <NotificationBell />
                        
                        <Button
                            onClick={toggleLanguage}
                            variant="ghost"
                            size="icon"
                            className="relative"
                        >
                            <Languages className="w-5 h-5" />
                            <span className="absolute -bottom-1 -right-1 text-[10px] font-bold bg-emerald-600 text-white rounded px-1">
                                {language.toUpperCase()}
                            </span>
                        </Button>

                        <Button
                            onClick={() => logout()}
                            variant="ghost"
                            size="icon"
                            className="text-red-600"
                            aria-label="Logout"
                        >
                            <LogOut className="w-5 h-5" />
                        </Button>
                        
                        <Sheet>
                            <SheetTrigger asChild>
                                <Button variant="ghost" size="icon">
                                    <Menu className="w-6 h-6" />
                                </Button>
                            </SheetTrigger>
                            <SheetContent side={isRTL ? "right" : "left"} className="w-64 p-0">
                                <div className="flex flex-col h-full">
                                    <div className="px-6 py-6 border-b">
                                        <h2 className="text-lg font-semibold">{isRTL ? 'القائمة' : 'Navigation'}</h2>
                                    </div>
                                    <nav className="flex-1 py-6 overflow-y-auto">
                                        <NavContent />
                                    </nav>
                                </div>
                            </SheetContent>
                        </Sheet>
                    </div>
                </div>
            </div>

            <main className={`lg:pt-0 pt-16 ${isRTL ? 'lg:pr-64' : 'lg:pl-64'}`}>
                <div className="min-h-screen bg-[#f5f7fb]">
                    <div className="sticky top-16 z-40 border-b border-slate-200 bg-white/90 px-6 py-3 shadow-sm backdrop-blur lg:top-0">
                        <Button
                            onClick={() => navigate(-1)}
                            variant="outline"
                            size="sm"
                            className="gap-2"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            {t('previous')}
                        </Button>
                    </div>
                    {/* Add bottom padding on mobile for bottom nav */}
                    <div className="pb-20 lg:pb-0">
                        {children}
                    </div>
                    </div>
                    </main>
            
            <AIChatButton />

            {/* Mobile Bottom Navigation */}
            <MobileBottomNav 
                pendingApprovals={pendingApprovals}
                unreadNotifications={unreadNotifications}
                onQuickActionClick={() => setShowQuickAction(true)}
                createPageUrl={createPageUrl}
            />

            {/* Quick Action Sheet */}
            <QuickActionSheet 
                open={showQuickAction} 
                onOpenChange={setShowQuickAction}
                createPageUrl={createPageUrl}
            />

            {/* Offline Indicator */}
            <OfflineIndicator />

            <Toaster />

            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700&display=swap');
                
                .rtl {
                    font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif;
                }
                
                .rtl * {
                    font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif;
                }
                
                .rtl table {
                    direction: rtl;
                }
                
                .rtl th, .rtl td {
                    text-align: right;
                }
                
                .rtl input, .rtl textarea, .rtl select {
                    direction: rtl;
                    text-align: right;
                }
                
                .rtl input[type="number"] {
                    direction: ltr;
                    text-align: left;
                }
                
                .rtl .flex-row-reverse {
                    flex-direction: row-reverse;
                }
                
                .rtl [role="menu"] {
                    text-align: right;
                }
                
                .rtl .gap-2 > svg {
                    margin-left: 0;
                    margin-right: 0;
                }
                
                .rtl .numeric {
                    font-family: 'Courier New', monospace;
                    direction: ltr;
                    display: inline-block;
                }

                /* Mobile optimizations */
                @media (max-width: 1024px) {
                    .safe-area-inset-bottom {
                        padding-bottom: env(safe-area-inset-bottom, 0);
                    }

                    /* Improve touch targets */
                    button, a, [role="button"] {
                        min-height: 44px;
                    }

                    /* Disable hover effects on touch */
                    @media (hover: none) {
                        .hover\\:bg-gray-50:hover {
                            background-color: inherit;
                        }
                        .hover\\:shadow-lg:hover {
                            box-shadow: inherit;
                        }
                    }

                    /* Smooth scrolling */
                    * {
                        -webkit-overflow-scrolling: touch;
                    }
                }
                `}</style>
        </div>
    );
}

export default function Layout({ children, currentPageName }) {
    return (
        <OrganizationProvider>
            <LanguageProvider>
                <LayoutContent children={children} currentPageName={currentPageName} />
            </LanguageProvider>
        </OrganizationProvider>
    );
}
