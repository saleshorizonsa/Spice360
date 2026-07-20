import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Waypoints } from "lucide-react";
import DocumentFlow from "./DocumentFlow";

/**
 * Popup wrapper around DocumentFlow — opened from the Flow action icon on a list
 * row, so the whole document chain (QT → SO → DN → INV → AR, or the purchasing
 * equivalent) can be seen without leaving the list.
 */
export default function DocumentFlowDialog({ seedType, seedNumber, onClose }) {
  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Waypoints className="w-5 h-5 text-indigo-600" />
            Document Flow — {seedNumber}
          </DialogTitle>
        </DialogHeader>
        <DocumentFlow seedType={seedType} seedNumber={seedNumber} highlightNumber={seedNumber} />
      </DialogContent>
    </Dialog>
  );
}
