import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { Upload, Loader2, X } from "lucide-react";

export default function DocumentUpload({ 
    relatedEntity, 
    relatedEntityId, 
    relatedDocumentNumber,
    onClose,
    onUploadComplete 
}) {
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [documentType, setDocumentType] = useState("other");
    const [description, setDescription] = useState("");
    const [isPrivate, setIsPrivate] = useState(false);
    const [uploading, setUploading] = useState(false);
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const handleFileSelect = (e) => {
        const files = Array.from(e.target.files);
        setSelectedFiles(prev => [...prev, ...files]);
    };

    const removeFile = (index) => {
        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    };

    const uploadDocuments = async () => {
        if (selectedFiles.length === 0) {
            toast({ title: "Error", description: "Please select at least one file", variant: "destructive" });
            return;
        }

        setUploading(true);
        const currentUser = await base44.auth.me();

        try {
            for (const file of selectedFiles) {
                // Upload file
                const { file_url } = await base44.integrations.Core.UploadFile({ file });

                // Create document record
                await base44.entities.Document.create({
                    document_id: `DOC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    file_name: file.name,
                    file_url: file_url,
                    file_size: file.size,
                    file_type: file.type,
                    document_type: documentType,
                    related_entity: relatedEntity,
                    related_entity_id: relatedEntityId,
                    related_document_number: relatedDocumentNumber,
                    description: description,
                    upload_date: new Date().toISOString(),
                    uploaded_by: currentUser.email,
                    uploaded_by_name: currentUser.full_name,
                    is_private: isPrivate,
                    status: "active"
                });
            }

            queryClient.invalidateQueries({ queryKey: ['documents'] });
            toast({ title: "Success", description: `${selectedFiles.length} document(s) uploaded successfully` });
            
            if (onUploadComplete) onUploadComplete();
            if (onClose) onClose();
        } catch (error) {
            toast({ title: "Error", description: "Failed to upload documents", variant: "destructive" });
        } finally {
            setUploading(false);
        }
    };

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Upload className="w-5 h-5 text-emerald-600" />
                        Upload Documents
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    <div>
                        <Label>Select Files *</Label>
                        <Input
                            type="file"
                            multiple
                            onChange={handleFileSelect}
                            disabled={uploading}
                        />
                    </div>

                    {selectedFiles.length > 0 && (
                        <div className="space-y-2">
                            <Label>Selected Files ({selectedFiles.length})</Label>
                            {selectedFiles.map((file, idx) => (
                                <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                    <div className="flex-1">
                                        <p className="text-sm font-medium">{file.name}</p>
                                        <p className="text-xs text-gray-500">
                                            {(file.size / 1024).toFixed(2)} KB
                                        </p>
                                    </div>
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        onClick={() => removeFile(idx)}
                                        disabled={uploading}
                                    >
                                        <X className="w-4 h-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}

                    <div>
                        <Label>Document Type</Label>
                        <Select value={documentType} onValueChange={setDocumentType} disabled={uploading}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="invoice">Invoice</SelectItem>
                                <SelectItem value="receipt">Receipt</SelectItem>
                                <SelectItem value="contract">Contract</SelectItem>
                                <SelectItem value="quotation">Quotation</SelectItem>
                                <SelectItem value="purchase_order">Purchase Order</SelectItem>
                                <SelectItem value="delivery_note">Delivery Note</SelectItem>
                                <SelectItem value="certificate">Certificate</SelectItem>
                                <SelectItem value="specification">Specification</SelectItem>
                                <SelectItem value="drawing">Drawing</SelectItem>
                                <SelectItem value="photo">Photo</SelectItem>
                                <SelectItem value="id_document">ID Document</SelectItem>
                                <SelectItem value="license">License</SelectItem>
                                <SelectItem value="insurance">Insurance</SelectItem>
                                <SelectItem value="tax_document">Tax Document</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <Label>Description</Label>
                        <Textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Add description or notes..."
                            rows={3}
                            disabled={uploading}
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="private"
                            checked={isPrivate}
                            onChange={(e) => setIsPrivate(e.target.checked)}
                            disabled={uploading}
                        />
                        <Label htmlFor="private" className="cursor-pointer">
                            Mark as private/confidential
                        </Label>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <Button variant="outline" onClick={onClose} disabled={uploading}>
                            Cancel
                        </Button>
                        <Button
                            onClick={uploadDocuments}
                            disabled={selectedFiles.length === 0 || uploading}
                            className="bg-emerald-600 hover:bg-emerald-700"
                        >
                            {uploading ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Uploading...
                                </>
                            ) : (
                                <>
                                    <Upload className="w-4 h-4 mr-2" />
                                    Upload {selectedFiles.length > 0 && `(${selectedFiles.length})`}
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}