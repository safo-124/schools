// components/super-admin/SchoolStatusToggleButton.tsx
"use client";

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { School } from '@prisma/client'; // Assuming School type is from Prisma

import { Button } from '@/components/ui/button';
import { Power } from 'lucide-react';
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
// To use toast notifications, uncomment the import and calls below.
// Ensure you have installed and set up a toast library like Sonner.
// import { toast } from "sonner";

interface SchoolStatusToggleButtonProps {
  school: Pick<School, 'id' | 'isActive' | 'name'>; // Pass only necessary fields from School
}

export function SchoolStatusToggleButton({ school }: SchoolStatusToggleButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition(); // For smoother UI updates with router.refresh
  const [isLoading, setIsLoading] = useState(false);   // For the API call itself
  const [error, setError] = useState<string | null>(null);

  const currentStatusIsActive = school.isActive;
  const newStatus = !currentStatusIsActive;
  const actionText = currentStatusIsActive ? 'Deactivate' : 'Activate';

  const handleSubmitStatusChange = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/schools/${school.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isActive: newStatus }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to ${actionText.toLowerCase()} school.`);
      }

      // Success
      // toast.success(`School "${school.name}" has been ${actionText.toLowerCase()}d successfully!`);

      // Refresh the current route. router.refresh() re-fetches data for Server Components.
      // startTransition helps manage pending states for this refresh.
      startTransition(() => {
        router.refresh();
      });

    } catch (err: any) {
      setError(err.message);
      console.error(`Error ${actionText.toLowerCase()}ing school:`, err);
      // toast.error(err.message || `Failed to ${actionText.toLowerCase()} school.`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          disabled={isLoading || isPending} // Disable if API call is loading or page is transitioning
          className={currentStatusIsActive 
            ? "hover:bg-red-100 hover:text-red-700 dark:hover:bg-red-900/50 dark:hover:text-red-400 border-red-300 dark:border-red-700 text-red-600 dark:text-red-400" 
            : "hover:bg-green-100 hover:text-green-700 dark:hover:bg-green-900/50 dark:hover:text-green-400 border-green-300 dark:border-green-700 text-green-600 dark:text-green-400"
          }
        >
          <Power className="mr-2 h-4 w-4" />
          {isLoading || isPending ? `${actionText}ing...` : `${actionText} School`}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirm {actionText}</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to {actionText.toLowerCase()} the school "{school.name}"?
            {currentStatusIsActive && " Deactivating will prevent admins and users of this school from accessing their portals if your system enforces this."}
            {!currentStatusIsActive && " Activating will allow admins and users of this school to access their portals again if previously restricted."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p className="text-sm text-red-600 mt-2 py-2 px-3 bg-red-50 dark:bg-red-900/30 rounded-md">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading || isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleSubmitStatusChange}
            disabled={isLoading || isPending}
            className={currentStatusIsActive ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground" : "bg-primary hover:bg-primary/90"}
          >
            {isLoading || isPending ? `${actionText}ing...` : `Yes, ${actionText}`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}