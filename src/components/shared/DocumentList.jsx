import React, { useState } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
    FileText, 
    Trash2, 
    Eye, 
    Upload,
    File,
    Image,
    FileSpreadsheet,
    Lock
} from "lucide-react";
import { format } from "date-fns";
import DocumentUpload from "./DocumentUpload";
import { useToast } from "@/components/ui/use-toast";

export default function DocumentList({ relatedEntity, relatedEntityId, relatedDocumentNumber }) {
    const [showUpload, setShowUpload] = useState(false);
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const { data: documents = [], isLoading } = useQuery({
        queryKey: ['documents', relatedEntity, relatedEntityId],
        queryFn: async () => {
            const docs = await matrixSales.entities.Document.filter({
                related_entity: relatedEntity,
                related_entity_id: relatedEntityId,
                status: 'active'
            });
            return docs || [];
        },
        initialData: []
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => matrixSales.entities.Document.update(id, { status: 'deleted' }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['documents'] });
            toast({ title: "Success", description: "Document deleted successfully" });
        }
    });

    const getFileIcon = (fileType) => {
        if (fileType?.startsWith('image/')) return Image;
        if (fileType?.includes('spreadsheet') || fileType?.includes('excel')) return FileSpreadsheet;
        if (fileType?.includes('pdf')) return FileText;
        return File;
    };

    const handleDownload = (doc) => {
        window.open(doc.file_url, '_blank');
    };

    const handleDelete = (doc) => {
        if (confirm(`Delete ${doc.file_name}?`)) {
            deleteMutation.mutate(doc.id);
        }
    };

    if (isLoading) {
        return (
            <Card>
                <CardContent className="py-8 text-center">
                    <p className="text-gray-500">Loading documents...</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-base">
                        Attached Documents ({documents.length})
                    </CardTitle>
                    <Button
                        size="sm"
                        onClick={() => setShowUpload(true)}
                        className="bg-emerald-600 hover:bg-emerald-700"
                    >
                        <Upload className="w-4 h-4 mr-2" />
                        Upload
                    </Button>
                </CardHeader>
                <CardContent>
                    {documents.length === 0 ? (
                        <div className="text-center py-8">
                            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                            <p className="text-gray-600 mb-4">No documents attached</p>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setShowUpload(true)}
                            >
                                <Upload className="w-4 h-4 mr-2" />
                                Upload First Document
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {documents.map((doc) => {
                                const Icon = getFileIcon(doc.file_type);
                                return (
                                    <div
                                        key={doc.id}
                                        className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                                    >
                                        <Icon className="w-8 h-8 text-gray-600" />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="font-medium text-sm truncate">{doc.file_name}</p>
                                                {doc.is_private && (
                                                    <Badge variant="outline" className="text-xs">
                                                        <Lock className="w-3 h-3 mr-1" />
                                                        Private
                                                    </Badge>
                                                )}
                                                <Badge variant="outline" className="text-xs">
                                                    {doc.document_type}
                                                </Badge>
                                            </div>
                                            <p className="text-xs text-gray-500">
                                                Uploaded by {doc.uploaded_by_name} on{' '}
                                                {format(new Date(doc.upload_date), 'MMM dd, yyyy HH:mm')}
                                            </p>
                                            {doc.description && (
                                                <p className="text-xs text-gray-600 mt-1">{doc.description}</p>
                                            )}
                                        </div>
                                        <div className="flex gap-1">
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                onClick={() => handleDownload(doc)}
                                                title="View/Download"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                onClick={() => handleDelete(doc)}
                                                className="text-red-600 hover:text-red-700"
                                                title="Delete"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {showUpload && (
                <DocumentUpload
                    relatedEntity={relatedEntity}
                    relatedEntityId={relatedEntityId}
                    relatedDocumentNumber={relatedDocumentNumber}
                    onClose={() => setShowUpload(false)}
                    onUploadComplete={() => {
                        queryClient.invalidateQueries({ queryKey: ['documents'] });
                    }}
                />
            )}
        </>
    );
}