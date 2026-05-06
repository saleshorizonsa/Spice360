import React from "react";
import { Link, useLocation } from "react-router-dom";
import { 
    LayoutDashboard, 
    CheckCircle, 
    Bell, 
    Plus, 
    Menu 
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "../utils/languageContext";

export default function MobileBottomNav({ pendingApprovals = 0, unreadNotifications = 0, onQuickActionClick, createPageUrl }) {
    const location = useLocation();
    const { t } = useLanguage();
    
    const navItems = [
        { 
            name: t('dashboard'), 
            path: "Dashboard", 
            icon: LayoutDashboard 
        },
        { 
            name: t('approvals'), 
            path: "Approvals", 
            icon: CheckCircle,
            badge: pendingApprovals 
        },
        { 
            name: "Quick", 
            action: true, 
            icon: Plus,
            primary: true
        },
        { 
            name: t('notifications'), 
            path: "Notifications", 
            icon: Bell,
            badge: unreadNotifications 
        },
        { 
            name: "More", 
            path: "MobileMenu", 
            icon: Menu 
        }
    ];

    const isActive = (path) => {
        return location.pathname.includes(path);
    };

    return (
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 safe-area-inset-bottom">
            <div className="flex items-center justify-around h-16 px-2">
                {navItems.map((item, idx) => {
                    if (item.action) {
                        return (
                            <button
                                key={idx}
                                onClick={onQuickActionClick}
                                className="flex flex-col items-center justify-center -mt-6"
                            >
                                <div className="bg-emerald-600 p-4 rounded-full shadow-lg">
                                    <item.icon className="w-6 h-6 text-white" />
                                </div>
                            </button>
                        );
                    }
                    
                    const Icon = item.icon;
                    const active = isActive(item.path);
                    
                    return (
                        <Link
                            key={idx}
                            to={createPageUrl(item.path)}
                            className={`flex flex-col items-center justify-center flex-1 py-2 relative ${
                                active ? 'text-emerald-600' : 'text-gray-500'
                            }`}
                        >
                            <div className="relative">
                                <Icon className={`w-6 h-6 ${active ? 'text-emerald-600' : 'text-gray-500'}`} />
                                {item.badge > 0 && (
                                    <Badge className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 bg-red-500 text-white text-xs">
                                        {item.badge > 9 ? '9+' : item.badge}
                                    </Badge>
                                )}
                            </div>
                            <span className={`text-xs mt-1 ${active ? 'font-medium' : ''}`}>
                                {item.name}
                            </span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}