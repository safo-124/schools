// components/school-admin/students/ToggleStudentStatusButton.tsx
"use client";

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Student as PrismaStudent, User as PrismaUser } from '@prisma/client';

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
import { UserX, UserCheck } from 'lucide-react'; // Icons for deactivate/reactivate
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from "sonner";

interface ToggleStudentStatusButtonProps {
  student: Pick<PrismaStudent, 'id' | 'firstName' | 'lastName' | 'isActive'> & {
    // Include user if you want to display user-specific info or handle user deactivation differently in UI text
    // user?: Pick<PrismaUser, 'id' | 'isActive'> | null; 
  };
  onActionSuccess?: () => void; // Callback for parent component to refresh data or show messages
}

export function ToggleStudentStatusButton({ student, onActionSuccess }: ToggleStudentStatusButtonProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition(); // For router.refresh pending state

  const targetIsActiveStatus = !student.isActive;
  const actionText = student.isActive ? "Deactivate" : "Reactivate";
  const processingText = student.isActive ? "Deactivating..." : "Reactivating...";

  const handleSubmitStatusChange = async () => {
    setIsProcessing(true);
    setError(null);
    const toastId = toast.loading(`${processingText} student: "${student.firstName} ${student.lastName}"...`);

    try {
      const response = await fetch(`/api/school-admin/students/${student.id}`, {
        method: 'PATCH', // Use PATCH to update the isActive status
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isActive: targetIsActiveStatus }), // Send the new desired status
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || `Failed to ${actionText.toLowerCase()} student.`);
      }

      toast.success(`Student "${student.firstName} ${student.lastName}" ${actionText.toLowerCase()}d successfully.`, { id: toastId });
      
      if (onActionSuccess) {
        onActionSuccess(); 
      }
      
      // Refresh server-side data for the current route to reflect changes
      startTransition(() => {
        router.refresh();
      });

      setIsOpen(false); // Close the dialog on success

    } catch (err: any) {
      setError(err.message || `An unexpected error occurred during ${actionText.toLowerCase()}.`);
      toast.error(`Failed to ${actionText.toLowerCase()} "${student.firstName} ${student.lastName}"`, { id: toastId, description: err.message });
      console.error(`${actionText} student error:`, err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Reset error when dialog is closed without action
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
          className={student.isActive 
            ? "text-destructive hover:text-destructive/80" 
            : "text-green-600 hover:text-green-700/80 dark:text-green-500 dark:hover:text-green-600/80"}
          title={`${actionText} Student`}
        >
          {student.isActive ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirm {actionText}</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to {actionText.toLowerCase()} the student <strong>{student.firstName} {student.lastName}</strong>?
            {student.isActive && " This will mark the student and their linked user account (if any) as inactive. All existing records will be preserved."}
            {!student.isActive && " This will mark the student and their linked user account (if any) as active."}
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
            onClick={handleSubmitStatusChange}
            disabled={isProcessing || isPending}
            className={student.isActive ? "bg-destructive hover:bg-destructive/90" : "bg-green-600 hover:bg-green-700/90 text-white"}
          >
            {isProcessing || isPending ? processingText : `Yes, ${actionText}`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}