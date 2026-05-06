import React from "react";
import { Button } from "@/components/ui/button";
import { Bot } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function AIChatButton() {
    return (
        <Link to={createPageUrl('AIAssistant')}>
            <Button 
                className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 z-50"
                size="icon"
            >
                <Bot className="w-6 h-6 text-white" />
            </Button>
        </Link>
    );
}