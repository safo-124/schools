// components/school-admin/subjects/DeleteSubjectButton.tsx
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

interface DeleteSubjectButtonProps {
  subjectId: string;
  subjectName: string;
  onDeleteSuccess?: () => void; 
}

export function DeleteSubjectButton({ subjectId, subjectName, onDeleteSuccess }: DeleteSubjectButtonProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);
    try {
      const response = await fetch(`/api/school-admin/subjects/${subjectId}`, {
        method: 'DELETE',
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to delete subject.');
      }

      toast.success(`Subject "${subjectName}" deleted successfully.`);
      
      if (onDeleteSuccess) {
        onDeleteSuccess();
      }
      
      startTransition(() => {
        router.refresh(); 
      });
      setIsOpen(false);

    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
      toast.error(err.message || `Failed to delete subject "${subjectName}".`);
      console.error("Delete subject error:", err);
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
        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive/80" title="Delete Subject">
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the subject: 
            <strong> {subjectName}</strong>. 
            <br />
            All related timetable slots, assignments, and student grades for this subject will also be deleted due to cascading rules. 
            Please ensure this is the desired outcome.
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
            {isDeleting || isPending ? 'Deleting...' : 'Yes, Delete Subject'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}