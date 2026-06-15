import React, { useState } from 'react';
import { matrixSales } from '@/api/matrixSalesClient';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const lockedStatuses = new Set([
    'posted', 'closed', 'cleared', 'reported', 'paid',
    'completed', 'locked', 'fully_received'
]);

/**
 * Generic Reverse button for any locked document.
 * Shows only when item.status is in the locked set.
 *
 * Props:
 *   item        – the current record (needs .id and .status)
 *   entityName  – matrixSales.entities key, e.g. "VendorInvoice"
 *   queryKeys   – array of TanStack Query keys to invalidate on success
 *   onSuccess   – callback after successful reversal (usually onClose)
 *   preAction   – optional async fn to run before status update (e.g. stock reversal)
 *   label       – button label override (default "Reverse")
 */
export default function ReverseButton({
    item,
    entityName,
    queryKeys = [],
    onSuccess,
    preAction,
    label = 'Reverse',
}) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [isReversing, setIsReversing] = useState(false);

    if (!item?.id || !lockedStatuses.has(String(item.status || '').toLowerCase())) {
        return null;
    }

    const handleReverse = async () => {
        setIsReversing(true);
        try {
            if (preAction) await preAction();
            await matrixSales.entities[entityName].update(item.id, { status: 'reversed' });
            queryKeys.forEach(key =>
                queryClient.invalidateQueries({ queryKey: Array.isArray(key) ? key : [key] })
            );
            if (!queryKeys.length) queryClient.invalidateQueries();
            toast({ title: 'Reversed', description: 'Document has been reversed successfully.' });
            onSuccess?.();
        } catch (error) {
            console.error('Reversal failed:', error);
            toast({
                title: 'Reversal Failed',
                description: error?.message || 'Could not reverse. Please try again.',
                variant: 'destructive',
            });
        } finally {
            setIsReversing(false);
        }
    };

    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    className="border-red-300 text-red-600 hover:bg-red-50"
                    disabled={isReversing}
                >
                    {isReversing ? 'Reversing...' : label}
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Confirm Reversal</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will reverse the document and mark it as cancelled. Any related
                        stock or financial postings should be manually adjusted if needed.
                        This action cannot be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleReverse}
                        className="bg-red-600 hover:bg-red-700"
                    >
                        Yes, Reverse
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
