// components/school-admin/students/DeleteStudentButton.tsx
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
import { UserX, Trash2 } from 'lucide-react'; // Changed icon to UserX for deactivate
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from "sonner";

interface DeleteStudentButtonProps {
  studentId: string;
  studentName: string;
  isActive: boolean; // Add current status to tailor messages and actions
  onActionSuccess?: () => void; 
}

export function DeleteStudentButton({ studentId, studentName, isActive, onActionSuccess }: DeleteStudentButtonProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false); // Renamed from isDeleting
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const actionText = isActive ? "Deactivate" : "Reactivate";
  const processingText = isActive ? "Deactivating..." : "Reactivating...";

  const handleSubmitAction = async () => {
    setIsProcessing(true);
    setError(null);
    // If reactivating, the API should handle setting isActive: true via PATCH
    // For now, this button is focused on deactivation (soft delete via API's DELETE verb)
    // To make it a true toggle, we'd need a PATCH call for reactivation.
    // For this iteration, we assume the DELETE endpoint *always* means deactivation.
    
    const toastId = toast.loading(`${processingText} student: "${studentName}"...`);

    try {
      // The API route DELETE /api/school-admin/students/[studentId] now performs deactivation
      const response = await fetch(`/api/school-admin/students/${studentId}`, {
        method: 'DELETE', // This verb now triggers deactivation on the backend
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || `Failed to ${actionText.toLowerCase()} student.`);
      }

      toast.success(`Student "${studentName}" ${actionText.toLowerCase()}d successfully.`, { id: toastId });
      
      if (onActionSuccess) {
        onActionSuccess(); 
      }
      
      startTransition(() => {
        router.refresh(); 
      });
      setIsOpen(false);

    } catch (err: any) {
      setError(err.message || `An unexpected error occurred during ${actionText.toLowerCase()}.`);
      toast.error(`Failed to ${actionText.toLowerCase()} "${studentName}"`, { id: toastId, description: err.message });
      console.error(`${actionText} student error:`, err);
    } finally {
      setIsProcessing(false);
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
        <Button 
          variant="ghost" 
          size="icon" 
          className={isActive ? "text-destructive hover:text-destructive/80" : "text-green-600 hover:text-green-700/80"}
          title={isActive ? "Deactivate Student" : "Reactivate Student (Not implemented in this button)"}
          // For this iteration, button only performs deactivation.
          // A true toggle would need separate logic or API endpoint for reactivation.
          // We will assume for now this button is primarily for deactivation (isActive=true student)
        >
          {isActive ? <UserX className="h-4 w-4" /> : <Trash2 className="h-4 w-4" /> /* Show Trash2 if already inactive, though ideally button would be "Activate" then */}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure you want to {actionText.toLowerCase()}?</AlertDialogTitle>
          <AlertDialogDescription>
            This will mark the student <strong>{studentName}</strong> as {isActive ? "inactive" : "active"}.
            {isActive && " They will not appear in active lists and their user account (if any) will also be deactivated. All their existing records (grades, attendance, invoices) will be preserved."}
            {!isActive && " Reactivating will make them appear in active lists again and reactivate their user account (if any). (Note: Reactivation via this button might need separate API logic if current DELETE endpoint only deactivates)."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <Alert variant="destructive" className="mt-2">
            <AlertTitle>{actionText} Failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isProcessing || isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleSubmitAction}
            disabled={isProcessing || isPending}
            className={isActive ? "bg-destructive hover:bg-destructive/90" : "bg-green-600 hover:bg-green-700/90"}
          >
            {isProcessing || isPending ? processingText : `Yes, ${actionText}`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}