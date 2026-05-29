import React, { useState, useEffect } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bell, Check, Trash2 } from "lucide-react";
import { markAsRead, markAllAsRead } from "../components/utils/notificationService";
import { useNavigate } from "react-router-dom";
import moment from "moment";
import { useLanguage } from "../components/utils/languageContext";

export default function NotificationsPage() {
    const [currentUser, setCurrentUser] = useState(null);
    const [activeTab, setActiveTab] = useState("all");
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const { t } = useLanguage();

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const user = await matrixSales.auth.me();
                setCurrentUser(user);
            } catch (error) {
                console.error('Error fetching user:', error);
            }
        };
        fetchUser();
    }, []);

    const { data: notifications = [] } = useQuery({
        queryKey: ['notifications', currentUser?.email],
        queryFn: async () => {
            if (!currentUser?.email) return [];
            const now = new Date().toISOString();
            const all = await matrixSales.entities.Notification.filter(
                { user_email: currentUser.email },
                '-created_at',
                200
            );
            return all.filter((n) => !n.expires_at || n.expires_at > now);
        },
        enabled: !!currentUser?.email,
        refetchInterval: 30000,
        initialData: []
    });

    const filteredNotifications = notifications.filter(n => {
        if (activeTab === "unread") return !n.is_read;
        if (activeTab === "read") return n.is_read;
        return true;
    });

    const markAsReadMutation = useMutation({
        mutationFn: markAsRead,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
        }
    });

    const markAllAsReadMutation = useMutation({
        mutationFn: () => markAllAsRead(currentUser?.email),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => matrixSales.entities.Notification.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
        }
    });

    const handleNotificationClick = async (notification) => {
        if (!notification.is_read) {
            await markAsReadMutation.mutateAsync(notification.id);
        }
        if (notification.action_url) {
            const pageName = notification.action_url.replace('/', '');
            navigate(`/${pageName}`);
        }
    };

    const getPriorityBadge = (priority) => {
        const config = {
            critical: { color: 'bg-red-100 text-red-800', label: 'Critical' },
            high: { color: 'bg-orange-100 text-orange-800', label: 'High' },
            medium: { color: 'bg-blue-100 text-blue-800', label: 'Medium' },
            low: { color: 'bg-gray-100 text-gray-800', label: 'Low' }
        };
        const { color, label } = config[priority] || config.medium;
        return <Badge className={color}>{label}</Badge>;
    };

    const unreadCount = notifications.filter(n => !n.is_read).length;

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">{t('notifications')}</h1>
                    <p className="text-gray-600 mt-1">
                        {unreadCount} {t('unreadNotifications')}
                    </p>
                </div>
                {unreadCount > 0 && (
                    <Button
                        onClick={() => markAllAsReadMutation.mutate()}
                        disabled={markAllAsReadMutation.isPending}
                    >
                        <Check className="w-4 h-4 mr-2" />
                        {t('markAllRead')}
                    </Button>
                )}
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                    <TabsTrigger value="all">
                        All ({notifications.length})
                    </TabsTrigger>
                    <TabsTrigger value="unread">
                        {t('unreadNotifications')} ({unreadCount})
                    </TabsTrigger>
                    <TabsTrigger value="read">
                        {t('readNotifications')} ({notifications.length - unreadCount})
                    </TabsTrigger>
                </TabsList>

                <TabsContent value={activeTab} className="space-y-3 mt-6">
                    {filteredNotifications.length === 0 ? (
                        <Card>
                            <CardContent className="py-12 text-center">
                                <Bell className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                                <p className="text-gray-500">{t('noNotifications')}</p>
                            </CardContent>
                        </Card>
                    ) : (
                        filteredNotifications.map((notification) => (
                            <Card 
                                key={notification.id}
                                className={`cursor-pointer transition-all hover:shadow-md ${
                                    !notification.is_read ? 'border-l-4 border-l-blue-500 bg-blue-50' : ''
                                }`}
                                onClick={() => handleNotificationClick(notification)}
                            >
                                <CardContent className="p-6">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 space-y-2">
                                            <div className="flex items-center gap-3">
                                                <h3 className="font-semibold text-lg">
                                                    {notification.title}
                                                </h3>
                                                {!notification.is_read && (
                                                    <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                                                )}
                                            </div>
                                            
                                            <p className="text-gray-700">
                                                {notification.message}
                                            </p>

                                            <div className="flex items-center gap-3 text-sm text-gray-500">
                                                {getPriorityBadge(notification.priority)}
                                                
                                                {notification.related_document_number && (
                                                    <Badge variant="outline">
                                                        {notification.related_document_number}
                                                    </Badge>
                                                )}
                                                
                                                <span>
                                                    {moment(notification.created_date).format('MMM D, YYYY h:mm A')}
                                                </span>
                                                
                                                <span className="text-gray-400">
                                                    ({moment(notification.created_date).fromNow()})
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex gap-2">
                                            {!notification.is_read && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        markAsReadMutation.mutate(notification.id);
                                                    }}
                                                    title="Mark as read"
                                                >
                                                    <Check className="w-4 h-4 text-blue-600" />
                                                </Button>
                                            )}
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    deleteMutation.mutate(notification.id);
                                                }}
                                                title={t('delete')}
                                            >
                                                <Trash2 className="w-4 h-4 text-red-600" />
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}