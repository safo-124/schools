// components/school-admin/finances/DeleteFeeStructureButton.tsx
"use client";

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
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
} from "@/components/ui/alert-dialog";
import { Trash2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from "sonner";

interface DeleteFeeStructureButtonProps {
  feeStructureId: string;
  feeStructureName: string; // For the confirmation message
  onDeleteSuccess?: () => void; 
}

export function DeleteFeeStructureButton({ feeStructureId, feeStructureName, onDeleteSuccess }: DeleteFeeStructureButtonProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);
    try {
      const response = await fetch(`/api/school-admin/finances/fee-structures/${feeStructureId}`, {
        method: 'DELETE',
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to delete fee structure.');
      }

      toast.success(`Fee structure "${feeStructureName}" deleted successfully.`);
      
      if (onDeleteSuccess) {
        onDeleteSuccess();
      }
      
      startTransition(() => {
        router.refresh(); 
      });
      setIsOpen(false);

    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
      toast.error(err.message || `Failed to delete "${feeStructureName}".`);
      console.error("Delete fee structure error:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setError(null); 
    }
    setIsOpen(open);
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive/80" title="Delete Fee Structure">
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the fee structure: 
            <strong> {feeStructureName}</strong>. 
            <br />
            Invoice line items linked to this fee structure will have their link removed (set to null), but the invoice lines themselves will not be deleted.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <Alert variant="destructive" className="mt-2">
            <AlertTitle>Deletion Failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting || isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting || isPending}
            className="bg-destructive hover:bg-destructive/90"
          >
            {isDeleting || isPending ? 'Deleting...' : 'Yes, Delete Fee Structure'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}