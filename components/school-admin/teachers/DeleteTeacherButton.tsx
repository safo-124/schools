// components/school-admin/teachers/DeleteTeacherButton.tsx
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'; // For showing errors in dialog
// import { toast } from "sonner"; // Optional

interface DeleteTeacherButtonProps {
  teacherId: string;
  teacherName: string; // For the confirmation message
  onDeleteSuccess?: () => void; // Optional callback
}

export function DeleteTeacherButton({ teacherId, teacherName, onDeleteSuccess }: DeleteTeacherButtonProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);
    try {
      const response = await fetch(`/api/school-admin/teachers/${teacherId}`, {
        method: 'DELETE',
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to delete teacher.');
      }

      // toast.success(`Teacher "${teacherName}" deleted successfully.`);
      onDeleteSuccess?.(); // Call optional callback
      
      // Refresh the current route to reflect the change in the list.
      startTransition(() => {
        router.refresh();
      });
      setIsOpen(false); // Close the dialog on success

    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
      // toast.error(err.message || 'Failed to delete teacher.');
      console.error("Delete teacher error:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive/80">
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the teacher profile for 
            <strong> {teacherName}</strong>. 
            The associated user account will remain, but their teacher role for this school will be removed.
            If the teacher is assigned to any classes or timetables, you might need to unassign them first, or this action could fail.
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
            disabled={isDeleting}
            className="bg-destructive hover:bg-destructive/90"
          >
            {isDeleting ? 'Deleting...' : 'Yes, Delete Teacher'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}