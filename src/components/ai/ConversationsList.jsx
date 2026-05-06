import React from "react";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Clock } from "lucide-react";
import { format } from "date-fns";

export default function ConversationsList({ conversations, activeConversation, onSelectConversation }) {
    if (!conversations || conversations.length === 0) {
        return (
            <div className="text-center py-8">
                <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600">No conversations yet</p>
            </div>
        );
    }

    return (
        <div className="space-y-2 overflow-y-auto h-full">
            {conversations.map((conversation) => {
                const isActive = activeConversation?.id === conversation.id;
                const messageCount = conversation.messages?.length || 0;
                const lastMessage = conversation.messages?.[conversation.messages?.length - 1];
                
                return (
                    <div
                        key={conversation.id}
                        onClick={() => onSelectConversation(conversation)}
                        className={`p-3 rounded-lg cursor-pointer transition-colors ${
                            isActive 
                                ? 'bg-emerald-50 border-2 border-emerald-300' 
                                : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                        }`}
                    >
                        <div className="flex items-start justify-between mb-1">
                            <span className="font-medium text-sm truncate flex-1">
                                {conversation.metadata?.name || 'Untitled Chat'}
                            </span>
                            <Badge variant="outline" className="ml-2">
                                {messageCount}
                            </Badge>
                        </div>
                        
                        {lastMessage && (
                            <p className="text-xs text-gray-600 truncate">
                                {lastMessage.role === 'user' ? 'You: ' : 'AI: '}
                                {lastMessage.content?.substring(0, 50)}...
                            </p>
                        )}
                        
                        <div className="flex items-center gap-1 mt-2 text-xs text-gray-500">
                            <Clock className="w-3 h-3" />
                            {format(new Date(conversation.created_date), 'MMM dd, HH:mm')}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}