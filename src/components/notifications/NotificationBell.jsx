import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Check, Trash2 } from "lucide-react";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { markAsRead, markAllAsRead } from "../utils/notificationService";
import { Link, useNavigate } from "react-router-dom";
import moment from "moment";

export default function NotificationBell() {
    const [currentUser, setCurrentUser] = useState(null);
    const [open, setOpen] = useState(false);
    const queryClient = useQueryClient();
    const navigate = useNavigate();

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const user = await base44.auth.me();
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
            return await base44.entities.Notification.filter({
                user_email: currentUser.email,
                expires_at: { $gt: now }
            }, '-created_date', 50);
        },
        enabled: !!currentUser?.email,
        refetchInterval: 30000,
        initialData: []
    });

    const unreadCount = notifications.filter(n => !n.is_read).length;

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
        mutationFn: (id) => base44.entities.Notification.delete(id),
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
            setOpen(false);
        }
    };

    const getPriorityIcon = (priority) => {
        switch (priority) {
            case 'critical': return '🔴';
            case 'high': return '🟠';
            case 'medium': return '🔵';
            case 'low': return '⚪';
            default: return '⚪';
        }
    };

    if (!currentUser) return null;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                    <Bell className="w-5 h-5" />
                    {unreadCount > 0 && (
                        <Badge 
                            className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-red-500 text-white text-xs"
                        >
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </Badge>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-96 p-0" align="end">
                <div className="flex items-center justify-between p-4 border-b">
                    <h3 className="font-semibold text-lg">Notifications</h3>
                    {unreadCount > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => markAllAsReadMutation.mutate()}
                            disabled={markAllAsReadMutation.isPending}
                        >
                            <Check className="w-4 h-4 mr-1" />
                            Mark all read
                        </Button>
                    )}
                </div>

                <ScrollArea className="h-96">
                    {notifications.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">
                            <Bell className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                            <p>No notifications</p>
                        </div>
                    ) : (
                        <div className="divide-y">
                            {notifications.map((notification) => (
                                <div
                                    key={notification.id}
                                    className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                                        !notification.is_read ? 'bg-blue-50' : ''
                                    }`}
                                >
                                    <div className="flex gap-3">
                                        <div className="flex-shrink-0 text-xl">
                                            {getPriorityIcon(notification.priority)}
                                        </div>
                                        <div 
                                            className="flex-1 min-w-0"
                                            onClick={() => handleNotificationClick(notification)}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <p className={`text-sm font-medium ${!notification.is_read ? 'text-gray-900' : 'text-gray-600'}`}>
                                                    {notification.title}
                                                </p>
                                                {!notification.is_read && (
                                                    <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0 mt-1"></div>
                                                )}
                                            </div>
                                            <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                                                {notification.message}
                                            </p>
                                            {notification.related_document_number && (
                                                <p className="text-xs text-gray-500 mt-1">
                                                    {notification.related_document_number}
                                                </p>
                                            )}
                                            <p className="text-xs text-gray-400 mt-1">
                                                {moment(notification.created_date).fromNow()}
                                            </p>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="flex-shrink-0 h-8 w-8"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                deleteMutation.mutate(notification.id);
                                            }}
                                        >
                                            <Trash2 className="w-3 h-3 text-gray-400" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>

                {notifications.length > 0 && (
                    <div className="p-3 border-t text-center">
                        <Link
                            to="/Notifications"
                            className="text-sm text-blue-600 hover:text-blue-700"
                            onClick={() => setOpen(false)}
                        >
                            View all notifications
                        </Link>
                    </div>
                )}
            </PopoverContent>
        </Popover>
    );
}