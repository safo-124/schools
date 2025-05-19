// components/school-admin/communications/DeleteAnnouncementButton.tsx
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
import { toast } from "sonner"; // For notifications

interface DeleteAnnouncementButtonProps {
  announcementId: string;
  announcementTitle: string; // For the confirmation message
  onDeleteSuccess?: () => void; // Optional callback for parent component
}

export function DeleteAnnouncementButton({ 
  announcementId, 
  announcementTitle, 
  onDeleteSuccess 
}: DeleteAnnouncementButtonProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition(); // For router.refresh pending state

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);
    const deletingToastId = toast.loading(`Deleting announcement: "${announcementTitle}"...`);

    try {
      const response = await fetch(`/api/school-admin/communications/announcements/${announcementId}`, {
        method: 'DELETE',
      });
      const result = await response.json(); // Attempt to parse JSON regardless of status for error messages

      if (!response.ok) {
        throw new Error(result.message || 'Failed to delete the announcement.');
      }

      toast.success(`Announcement "${announcementTitle}" deleted successfully.`, { id: deletingToastId });
      
      if (onDeleteSuccess) {
        onDeleteSuccess(); // Call parent's success handler (e.g., to re-fetch list)
      }
      
      // Refresh server-side data for the current route
      startTransition(() => {
        router.refresh();
      });

      setIsOpen(false); // Close the dialog

    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred during deletion.');
      toast.error(`Failed to delete "${announcementTitle}"`, { id: deletingToastId, description: err.message });
      console.error("Delete announcement error:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  // Reset error when dialog is closed manually without action
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
          variant="outline" 
          size="sm" 
          className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/50"
          title="Delete Announcement"
        >
          <Trash2 className="mr-0 sm:mr-2 h-4 w-4" /> <span className="hidden sm:inline">Delete</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the announcement: 
            <br />
            <strong>{announcementTitle}</strong>.
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
            {isDeleting || isPending ? 'Deleting...' : 'Yes, Delete Announcement'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}