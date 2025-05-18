// components/school-admin/students/DeleteStudentButton.tsx
"use client";

import React, { useState, useTransition } from 'react'; // Ensure useTransition is imported
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
// import { toast } from "sonner";

interface DeleteStudentButtonProps {
  studentId: string;
  studentName: string;
  onDeleteSuccess?: () => void; // Callback to trigger re-fetch in parent
}

export function DeleteStudentButton({ studentId, studentName, onDeleteSuccess }: DeleteStudentButtonProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition(); // For router.refresh

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);
    try {
      const response = await fetch(`/api/school-admin/students/${studentId}`, {
        method: 'DELETE',
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to delete student.');
      }

      // toast.success(`Student "${studentName}" deleted successfully.`);
      
      // Call the onDeleteSuccess callback passed from the parent page
      // This will typically trigger fetchStudents() in ManageStudentsPage
      if (onDeleteSuccess) {
        onDeleteSuccess();
      }
      
      // You can also call router.refresh() if parts of your page depend on server data
      // that isn't re-fetched by the onDeleteSuccess callback's logic.
      // For a client component managing its own list state via fetch,
      // explicitly calling the fetch function via callback is more direct.
      startTransition(() => {
        router.refresh(); // Good for re-validating any server-side aspects of the route
      });

      setIsOpen(false);

    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
      // toast.error(err.message || 'Failed to delete student.');
      console.error("Delete student error:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  // Reset error when dialog is closed manually
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setError(null);
    }
    setIsOpen(open);
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive/80" title="Delete Student">
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the student profile for 
            <strong> {studentName}</strong>. 
            Any associated grades, attendance records, and enrollment information might also be affected based on database cascade rules.
            The linked user account (if any) will NOT be deleted by this action.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <Alert variant="destructive" className="mt-2">
            <AlertTitle>Deletion Failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting || isPending} // Disable if deleting or page transition is pending
            className="bg-destructive hover:bg-destructive/90"
          >
            {isDeleting || isPending ? 'Deleting...' : 'Yes, Delete Student'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}