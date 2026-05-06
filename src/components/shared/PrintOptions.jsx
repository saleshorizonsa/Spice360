import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { 
    Printer, 
    FileText, 
    Image, 
    Mail, 
    MessageCircle,
    Share2
} from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function PrintOptions({ 
    documentType, 
    documentData, 
    onPrintPDF, 
    onPrintJPEG,
    onEmail,
    onWhatsApp 
}) {
    const [showEmailDialog, setShowEmailDialog] = useState(false);
    const [showWhatsAppDialog, setShowWhatsAppDialog] = useState(false);
    const [emailData, setEmailData] = useState({
        to: '',
        subject: '',
        body: ''
    });
    const [whatsappData, setWhatsappData] = useState({
        phone: '',
        message: ''
    });
    const { toast } = useToast();

    const handlePrintPDF = async () => {
        try {
            if (onPrintPDF) {
                await onPrintPDF();
            } else {
                // Default print behavior
                window.print();
            }
            toast({
                title: "Success",
                description: "PDF generated successfully"
            });
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to generate PDF",
                variant: "destructive"
            });
        }
    };

    const handlePrintJPEG = async () => {
        try {
            if (onPrintJPEG) {
                await onPrintJPEG();
            }
            toast({
                title: "Success",
                description: "Image generated successfully"
            });
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to generate image",
                variant: "destructive"
            });
        }
    };

    const handleSendEmail = async () => {
        try {
            if (onEmail) {
                await onEmail(emailData);
            }
            toast({
                title: "Success",
                description: "Email sent successfully"
            });
            setShowEmailDialog(false);
            setEmailData({ to: '', subject: '', body: '' });
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to send email",
                variant: "destructive"
            });
        }
    };

    const handleSendWhatsApp = async () => {
        try {
            if (onWhatsApp) {
                await onWhatsApp(whatsappData);
            } else {
                // Default WhatsApp Web behavior
                const message = encodeURIComponent(whatsappData.message);
                const phone = whatsappData.phone.replace(/[^0-9]/g, '');
                window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
            }
            toast({
                title: "Success",
                description: "Opening WhatsApp..."
            });
            setShowWhatsAppDialog(false);
            setWhatsappData({ phone: '', message: '' });
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to open WhatsApp",
                variant: "destructive"
            });
        }
    };

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="gap-2">
                        <Share2 className="w-4 h-4" />
                        Print & Share
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem onClick={handlePrintPDF}>
                        <FileText className="w-4 h-4 mr-2" />
                        Print to PDF
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handlePrintJPEG}>
                        <Image className="w-4 h-4 mr-2" />
                        Export as Image
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setShowEmailDialog(true)}>
                        <Mail className="w-4 h-4 mr-2" />
                        Send via Email
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setShowWhatsAppDialog(true)}>
                        <MessageCircle className="w-4 h-4 mr-2" />
                        Send via WhatsApp
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => window.print()}>
                        <Printer className="w-4 h-4 mr-2" />
                        Print Directly
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Email Dialog */}
            <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Send via Email</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label>To Email *</Label>
                            <Input
                                type="email"
                                value={emailData.to}
                                onChange={(e) => setEmailData({...emailData, to: e.target.value})}
                                placeholder="recipient@example.com"
                                required
                            />
                        </div>
                        <div>
                            <Label>Subject *</Label>
                            <Input
                                value={emailData.subject}
                                onChange={(e) => setEmailData({...emailData, subject: e.target.value})}
                                placeholder={`${documentType} - ${documentData?.number || ''}`}
                                required
                            />
                        </div>
                        <div>
                            <Label>Message</Label>
                            <Textarea
                                value={emailData.body}
                                onChange={(e) => setEmailData({...emailData, body: e.target.value})}
                                rows={4}
                                placeholder="Optional message..."
                            />
                        </div>
                        <div className="flex justify-end gap-3">
                            <Button variant="outline" onClick={() => setShowEmailDialog(false)}>
                                Cancel
                            </Button>
                            <Button onClick={handleSendEmail} className="bg-emerald-600 hover:bg-emerald-700">
                                <Mail className="w-4 h-4 mr-2" />
                                Send Email
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* WhatsApp Dialog */}
            <Dialog open={showWhatsAppDialog} onOpenChange={setShowWhatsAppDialog}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Send via WhatsApp</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label>Phone Number (with country code) *</Label>
                            <Input
                                value={whatsappData.phone}
                                onChange={(e) => setWhatsappData({...whatsappData, phone: e.target.value})}
                                placeholder="+966501234567"
                                required
                            />
                            <p className="text-sm text-gray-500 mt-1">
                                Include country code (e.g., +966 for Saudi Arabia)
                            </p>
                        </div>
                        <div>
                            <Label>Message</Label>
                            <Textarea
                                value={whatsappData.message}
                                onChange={(e) => setWhatsappData({...whatsappData, message: e.target.value})}
                                rows={4}
                                placeholder={`Here is your ${documentType}: ${documentData?.number || ''}`}
                            />
                        </div>
                        <div className="flex justify-end gap-3">
                            <Button variant="outline" onClick={() => setShowWhatsAppDialog(false)}>
                                Cancel
                            </Button>
                            <Button onClick={handleSendWhatsApp} className="bg-green-600 hover:bg-green-700">
                                <MessageCircle className="w-4 h-4 mr-2" />
                                Open WhatsApp
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}