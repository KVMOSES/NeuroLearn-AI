"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, Loader2, CheckCircle2, AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

type DeletePhase = "confirm" | "loading" | "success" | "error";

interface DeleteDialogProps {
  /** Controls the open state */
  open: boolean;
  /** Called when the dialog should close */
  onOpenChange: (open: boolean) => void;
  /** Name of the item being deleted (shown in the confirmation) */
  itemName: string;
  /** Description of what gets removed (shown below the item name) */
  itemDetail?: string;
  /** Async function that performs the deletion */
  onDelete: () => Promise<void>;
  /** Optional: called after successful delete (for optimistic list update) */
  onSuccess?: () => void;
}

export function DeleteDialog({
  open,
  onOpenChange,
  itemName,
  itemDetail,
  onDelete,
  onSuccess,
}: DeleteDialogProps) {
  const [phase, setPhase] = useState<DeletePhase>("confirm");

  const handleClose = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) {
        setPhase("confirm");
      }
      onOpenChange(isOpen);
    },
    [onOpenChange]
  );

  async function handleDelete() {
    setPhase("loading");
    try {
      await onDelete();
      setPhase("success");
      onSuccess?.();
      // Auto-dismiss after success animation
      setTimeout(() => handleClose(false), 1200);
    } catch {
      setPhase("error");
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm">
        <AnimatePresence mode="wait">
          {/* Confirm phase */}
          {phase === "confirm" && (
            <motion.div
              key="confirm"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.15 }}
            >
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-destructive">
                  <Trash2 className="w-4 h-4" />
                  Delete "{itemName}"?
                </DialogTitle>
                <DialogDescription>
                  {itemDetail || "This action cannot be undone."}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="mt-4">
                <Button variant="outline" onClick={() => handleClose(false)}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleDelete}>
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                  Delete
                </Button>
              </DialogFooter>
            </motion.div>
          )}

          {/* Loading phase */}
          {phase === "loading" && (
            <motion.div
              key="loading"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              className="flex flex-col items-center justify-center py-6 gap-3"
            >
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-destructive/20 animate-ping" />
                <Loader2 className="relative w-8 h-8 text-destructive animate-spin" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">Deleting "{itemName}"…</p>
            </motion.div>
          )}

          {/* Success phase */}
          {phase === "success" && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
              className="flex flex-col items-center justify-center py-6 gap-3"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 250, damping: 12, delay: 0.05 }}
              >
                <CheckCircle2 className="w-10 h-10 text-emerald-500" />
              </motion.div>
              <p className="text-sm font-semibold">Deleted successfully</p>
            </motion.div>
          )}

          {/* Error phase */}
          {phase === "error" && (
            <motion.div
              key="error"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              className="flex flex-col items-center justify-center py-6 gap-3"
            >
              <AlertTriangle className="w-8 h-8 text-amber-500" />
              <p className="text-sm font-medium">Deletion failed</p>
              <p className="text-xs text-muted-foreground text-center max-w-[240px]">
                Something went wrong. Please try again.
              </p>
              <Button size="sm" variant="outline" onClick={handleDelete} className="mt-2">
                <RotateCcw className="w-3 h-3 mr-1" />
                Retry
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
