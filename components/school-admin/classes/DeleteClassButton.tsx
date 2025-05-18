// components/school-admin/classes/DeleteClassButton.tsx
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

interface DeleteClassButtonProps {
  classId: string;
  classNameWithSection: string;
  onDeleteSuccess?: () => void; // This callback is key
}

export function DeleteClassButton({ classId, classNameWithSection, onDeleteSuccess }: DeleteClassButtonProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);
    try {
      const response = await fetch(`/api/school-admin/classes/${classId}`, {
        method: 'DELETE',
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to delete class.');
      }

      toast.success(`Class "${classNameWithSection}" deleted successfully.`);
      
      // Call the onDeleteSuccess callback to trigger re-fetch in the parent
      if (onDeleteSuccess) {
        onDeleteSuccess();
      }
      
      // router.refresh() is still good for any server-side data revalidation on the route
      startTransition(() => {
        router.refresh();
      });

      setIsOpen(false); // Close the dialog

    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
      toast.error(err.message || 'Failed to delete class.');
      console.error("Delete class error:", err);
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
        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive/80" title="Delete Class">
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the class/section: 
            <strong> {classNameWithSection}</strong>. 
            <br />
            Students in this class will be unassigned. 
            Associated timetable slots, assignments, and class announcements might also be affected.
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
            {isDeleting || isPending ? 'Deleting...' : 'Yes, Delete Class'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}