import React, { useState, useEffect } from "react";
import { WifiOff, Wifi, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "../utils/languageContext";

export default function OfflineIndicator() {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [showReconnected, setShowReconnected] = useState(false);
    const { t } = useLanguage();

    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            setShowReconnected(true);
            setTimeout(() => setShowReconnected(false), 3000);
        };

        const handleOffline = () => {
            setIsOnline(false);
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    if (isOnline && !showReconnected) return null;

    return (
        <div className={`fixed top-16 lg:top-0 left-0 right-0 z-50 px-4 py-2 text-center text-sm font-medium transition-all ${
            isOnline 
                ? 'bg-green-500 text-white' 
                : 'bg-red-500 text-white'
        }`}>
            <div className="flex items-center justify-center gap-2">
                {isOnline ? (
                    <>
                        <Wifi className="w-4 h-4" />
                        <span>Back online - syncing data...</span>
                    </>
                ) : (
                    <>
                        <WifiOff className="w-4 h-4" />
                        <span>You're offline - some features may be limited</span>
                        <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-6 px-2 text-white hover:bg-white/20"
                            onClick={() => window.location.reload()}
                        >
                            <RefreshCw className="w-3 h-3 mr-1" />
                            Retry
                        </Button>
                    </>
                )}
            </div>
        </div>
    );
}