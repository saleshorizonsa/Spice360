import React, { useState } from 'react';
import { matrixSales } from '@/api/matrixSalesClient';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { reverseJournalEntriesForDocument } from '@/components/utils/journalService';
import { useOrganization } from '@/components/utils/OrganizationContext';
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
 *   preflight   – optional async fn run BEFORE anything is written. Throw from here
 *                 to abort the whole reversal with nothing changed (e.g. the stock
 *                 has already been issued, so the receipt cannot be taken back).
 *   preAction   – optional async fn to run before status update (e.g. stock reversal)
 *   label       – button label override (default "Reverse")
 */
export default function ReverseButton({
    item,
    entityName,
    queryKeys = [],
    onSuccess,
    preflight,
    preAction,
    label = 'Reverse',
    journalReferenceType,   // string | string[] — the reference_type(s) this doc posts under
    journalReferenceId,     // the reference_id used on those journal entries
}) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const { currentOrg } = useOrganization();
    const [isReversing, setIsReversing] = useState(false);

    if (!item?.id || !lockedStatuses.has(String(item.status || '').toLowerCase())) {
        return null;
    }

    const handleReverse = async () => {
        setIsReversing(true);
        try {
            // 0. Check the reversal is actually possible BEFORE touching anything.
            //    The GL is reversed first (below), so a failure discovered later
            //    would leave the ledger reversed while the physical effect stands.
            //    Anything that can make a reversal impossible must fail here.
            if (preflight) await preflight();

            // 1. Reverse the GL FIRST. This is idempotent (only `posted` entries are
            //    reversed), so if a later step fails the whole action can be retried
            //    safely. Doing it after the stock move would risk double-reversing
            //    stock on retry. Fatal on failure: a document must never be marked
            //    reversed while its journal entry still stands.
            await reverseJournalEntriesForDocument({
                referenceType: journalReferenceType,
                referenceId: journalReferenceId,
                orgId: currentOrg?.id,
            });

            // 2. Undo the physical effect (e.g. put the stock back).
            if (preAction) await preAction();

            // 3. Only now mark the document reversed.
            await matrixSales.entities[entityName].update(item.id, { status: 'reversed' });

            queryKeys.forEach(key =>
                queryClient.invalidateQueries({ queryKey: Array.isArray(key) ? key : [key] })
            );
            if (!queryKeys.length) queryClient.invalidateQueries();
            queryClient.invalidateQueries({ queryKey: ['journalEntries'] });
            toast({ title: 'Reversed', description: 'Document reversed and its journal entry reversed.' });
            onSuccess?.();
        } catch (error) {
            console.error('Reversal failed:', error);
            toast({
                title: 'Reversal Failed',
                description: error?.message || 'Could not reverse. Nothing was changed — please try again.',
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
