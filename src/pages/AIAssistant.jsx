import React, { useState, useEffect, useRef } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
    Bot, 
    Send, 
    Plus, 
    MessageSquare, 
    Sparkles,
    Loader2,
    TrendingUp,
    BarChart3
} from "lucide-react";
import MessageBubble from "../components/ai/MessageBubble";
import AIInsights from "../components/ai/AIInsights";
import ConversationsList from "../components/ai/ConversationsList";
import { useLanguage } from "../components/utils/languageContext";

export default function AIAssistant() {
    const [conversations, setConversations] = useState([]);
    const [activeConversation, setActiveConversation] = useState(null);
    const [messages, setMessages] = useState([]);
    const [inputMessage, setInputMessage] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState("chat");
    const messagesEndRef = useRef(null);
    const { t } = useLanguage();

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        loadConversations();
    }, []);

    useEffect(() => {
        if (activeConversation?.id) {
            const unsubscribe = matrixSales.agents.subscribeToConversation(
                activeConversation.id,
                (data) => {
                    setMessages(data.messages || []);
                }
            );

            return () => unsubscribe();
        }
    }, [activeConversation?.id]);

    const loadConversations = async () => {
        try {
            const convos = await matrixSales.agents.listConversations({
                agent_name: "erp_assistant"
            });
            setConversations(convos || []);
            
            if (convos && convos.length > 0) {
                const latest = convos[0];
                setActiveConversation(latest);
                setMessages(latest.messages || []);
            }
        } catch (error) {
            console.error("Error loading conversations:", error);
        }
    };

    const createNewConversation = async () => {
        try {
            const conversation = await matrixSales.agents.createConversation({
                agent_name: "erp_assistant",
                metadata: {
                    name: `Chat ${new Date().toLocaleString()}`,
                    description: "ERP Assistant Conversation"
                }
            });
            
            setConversations([conversation, ...conversations]);
            setActiveConversation(conversation);
            setMessages([]);
            return conversation;
        } catch (error) {
            console.error("Error creating conversation:", error);
            return null;
        }
    };

    const sendMessage = async () => {
        if (!inputMessage.trim() || isLoading) return;

        let conversationToUse = activeConversation;
        
        if (!conversationToUse) {
            conversationToUse = await createNewConversation();
            if (!conversationToUse) return;
        }

        const userMessage = inputMessage;
        setInputMessage("");
        setIsLoading(true);

        try {
            await matrixSales.agents.addMessage(conversationToUse, {
                role: "user",
                content: userMessage
            });
        } catch (error) {
            console.error("Error sending message:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    return (
        <div className="h-screen flex flex-col">
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-6">
                <div className="max-w-7xl mx-auto">
                    <h1 className="text-3xl font-bold flex items-center gap-3">
                        <Bot className="w-8 h-8" />
                        {t('aiAssistantAnalytics')}
                    </h1>
                    <p className="mt-2 text-emerald-100">
                        {t('aiInsightsDesc')}
                    </p>
                </div>
            </div>

            <div className="flex-1 overflow-hidden">
                <div className="max-w-7xl mx-auto h-full p-6">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
                        <TabsList className="grid grid-cols-2 w-96">
                            <TabsTrigger value="chat">
                                <MessageSquare className="w-4 h-4 mr-2" />
                                {t('chatAssistant')}
                            </TabsTrigger>
                            <TabsTrigger value="insights">
                                <Sparkles className="w-4 h-4 mr-2" />
                                {t('aiInsights')}
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="chat" className="flex-1 flex gap-4 mt-4">
                            <div className="w-72 flex-shrink-0">
                                <Card className="h-full flex flex-col">
                                    <CardHeader className="pb-3">
                                        <Button 
                                            onClick={createNewConversation}
                                            className="w-full bg-emerald-600 hover:bg-emerald-700"
                                        >
                                            <Plus className="w-4 h-4 mr-2" />
                                            {t('newChat')}
                                        </Button>
                                    </CardHeader>
                                    <CardContent className="flex-1 overflow-hidden">
                                        <ConversationsList
                                            conversations={conversations}
                                            activeConversation={activeConversation}
                                            onSelectConversation={(conv) => {
                                                setActiveConversation(conv);
                                                setMessages(conv.messages || []);
                                            }}
                                        />
                                    </CardContent>
                                </Card>
                            </div>

                            <Card className="flex-1 flex flex-col">
                                {activeConversation ? (
                                    <>
                                        <CardHeader className="border-b">
                                            <CardTitle className="flex items-center gap-2 text-base">
                                                <Bot className="w-5 h-5 text-emerald-600" />
                                                {t('erpAssistant')}
                                                <Badge variant="outline" className="ml-auto">
                                                    {messages.length} {t('messages')}
                                                </Badge>
                                            </CardTitle>
                                        </CardHeader>
                                        
                                        <CardContent className="flex-1 overflow-y-auto p-6 space-y-4">
                                            {messages.length === 0 ? (
                                                <div className="h-full flex items-center justify-center">
                                                    <div className="text-center max-w-md">
                                                        <Bot className="w-16 h-16 text-emerald-600 mx-auto mb-4" />
                                                        <h3 className="text-xl font-semibold mb-2">{t('howCanIHelp')}</h3>
                                                        <p className="text-gray-600 mb-6">
                                                            {t('askMeAnything')}
                                                        </p>
                                                        <div className="grid grid-cols-1 gap-2 text-left">
                                                            <Button 
                                                                variant="outline" 
                                                                className="justify-start"
                                                                onClick={() => setInputMessage("Show me sales performance this month")}
                                                            >
                                                                <TrendingUp className="w-4 h-4 mr-2" />
                                                                {t('showSalesPerformance')}
                                                            </Button>
                                                            <Button 
                                                                variant="outline" 
                                                                className="justify-start"
                                                                onClick={() => setInputMessage("Which items are low on stock?")}
                                                            >
                                                                <BarChart3 className="w-4 h-4 mr-2" />
                                                                {t('checkInventoryLevels')}
                                                            </Button>
                                                            <Button 
                                                                variant="outline" 
                                                                className="justify-start"
                                                                onClick={() => setInputMessage("What are the pending approvals?")}
                                                            >
                                                                <MessageSquare className="w-4 h-4 mr-2" />
                                                                {t('viewPendingApprovals')}
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    {messages.map((message, idx) => (
                                                        <MessageBubble key={idx} message={message} />
                                                    ))}
                                                    <div ref={messagesEndRef} />
                                                </>
                                            )}
                                        </CardContent>

                                        <div className="border-t p-4">
                                            <div className="flex gap-2">
                                                <Input
                                                    value={inputMessage}
                                                    onChange={(e) => setInputMessage(e.target.value)}
                                                    onKeyPress={handleKeyPress}
                                                    placeholder={t('askAnything')}
                                                    disabled={isLoading}
                                                    className="flex-1"
                                                />
                                                <Button
                                                    onClick={sendMessage}
                                                    disabled={isLoading || !inputMessage.trim()}
                                                    className="bg-emerald-600 hover:bg-emerald-700"
                                                >
                                                    {isLoading ? (
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                    ) : (
                                                        <Send className="w-4 h-4" />
                                                    )}
                                                </Button>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <CardContent className="flex-1 flex items-center justify-center">
                                        <div className="text-center">
                                            <MessageSquare className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                                            <h3 className="text-lg font-semibold mb-2">{t('noConversationSelected')}</h3>
                                            <p className="text-gray-600 mb-4">{t('createChatToStart')}</p>
                                            <Button 
                                                onClick={createNewConversation}
                                                className="bg-emerald-600 hover:bg-emerald-700"
                                            >
                                                <Plus className="w-4 h-4 mr-2" />
                                                {t('startNewChat')}
                                            </Button>
                                        </div>
                                    </CardContent>
                                )}
                            </Card>
                        </TabsContent>

                        <TabsContent value="insights" className="flex-1 mt-4">
                            <AIInsights />
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
        </div>
    );
}