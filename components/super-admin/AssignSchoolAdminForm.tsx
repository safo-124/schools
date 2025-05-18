// components/super-admin/AssignSchoolAdminForm.tsx
"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation'; // useRouter for router.refresh()
import { z } from 'zod';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { UserPlus, CheckCircle, XCircle } from 'lucide-react';
// import { toast } from "sonner"; // Optional

// Updated Zod schema with password confirmation
const createSchoolAdminFormSchema = z.object({
  email: z.string().email("Invalid email address."),
  firstName: z.string().min(1, "First name is required."),
  lastName: z.string().min(1, "Last name is required."),
  password: z.string().min(6, "Password must be at least 6 characters long."),
  confirmPassword: z.string().min(6, "Please confirm your password."),
})
.refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match.",
  path: ["confirmPassword"], // Error will be shown on the confirmPassword field
});

type CreateSchoolAdminFormValues = z.infer<typeof createSchoolAdminFormSchema>;

interface AssignSchoolAdminFormProps {
  schoolId: string;
  schoolName: string;
  // onAdminAssigned?: () => void; // Kept if direct parent notification needed, though router.refresh is primary
}

export function AssignSchoolAdminForm({ schoolId, schoolName }: AssignSchoolAdminFormProps) {
  const router = useRouter(); // For router.refresh()
  const [isOpen, setIsOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateSchoolAdminFormValues>({
    resolver: zodResolver(createSchoolAdminFormSchema),
    defaultValues: { // Initialize all fields
        email: '',
        firstName: '',
        lastName: '',
        password: '',
        confirmPassword: '',
    }
  });

  const onSubmit: SubmitHandler<CreateSchoolAdminFormValues> = async (formData) => {
    setSubmitError(null);
    setSubmitSuccess(null);

    // Exclude confirmPassword from the data sent to the API
    const { confirmPassword, ...apiData } = formData;

    try {
      const response = await fetch(`/api/schools/${schoolId}/admins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiData), // Send data without confirmPassword
      });

      const result = await response.json();

      if (!response.ok) {
        setSubmitError(result.message || `Error: ${response.status}`);
      } else {
        setSubmitSuccess(result.message || `Successfully assigned admin to ${schoolName}.`);
        // toast.success(result.message || `Successfully assigned admin to ${schoolName}.`);
        reset(); 
        router.refresh(); // Refresh server components on the current page to show new admin
        setTimeout(() => {
          setIsOpen(false);
          setSubmitSuccess(null);
        }, 2000);
      }
    } catch (err) {
      console.error("Assign school admin error:", err);
      setSubmitError('An unexpected error occurred. Please try again.');
      // toast.error('An unexpected error occurred.');
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      reset();
      setSubmitError(null);
      setSubmitSuccess(null);
    }
    setIsOpen(open);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <UserPlus className="mr-2 h-4 w-4" /> Assign School Admin
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Assign New Administrator</DialogTitle>
          <DialogDescription>
            For school: <strong>{schoolName}</strong>. Enter the details for the new school administrator.
            An account will be created if the email doesn't exist.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-4">
          {submitError && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertTitle>Assignment Failed</AlertTitle>
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          )}
          {submitSuccess && (
            <Alert variant="default" className="bg-green-100 dark:bg-green-900 border-green-300 dark:border-green-700">
              <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertTitle>Success!</AlertTitle>
              <AlertDescription>{submitSuccess}</AlertDescription>
            </Alert>
          )}

          <div>
            <Label htmlFor="assign-admin-firstName">First Name</Label>
            <Input id="assign-admin-firstName" {...register('firstName')} disabled={isSubmitting} />
            {errors.firstName && <p className="text-sm text-destructive mt-1">{errors.firstName.message}</p>}
          </div>
          <div>
            <Label htmlFor="assign-admin-lastName">Last Name</Label>
            <Input id="assign-admin-lastName" {...register('lastName')} disabled={isSubmitting} />
            {errors.lastName && <p className="text-sm text-destructive mt-1">{errors.lastName.message}</p>}
          </div>
          <div>
            <Label htmlFor="assign-admin-email">Email Address</Label>
            <Input id="assign-admin-email" type="email" {...register('email')} disabled={isSubmitting} />
            {errors.email && <p className="text-sm text-destructive mt-1">{errors.email.message}</p>}
          </div>
          <div>
            <Label htmlFor="assign-admin-password">Password</Label>
            <Input id="assign-admin-password" type="password" {...register('password')} disabled={isSubmitting} />
            {errors.password && <p className="text-sm text-destructive mt-1">{errors.password.message}</p>}
            <p className="text-xs text-muted-foreground mt-1">Min. 6 characters. This will be the initial password.</p>
          </div>
          <div>
            <Label htmlFor="assign-admin-confirmPassword">Confirm Password</Label>
            <Input id="assign-admin-confirmPassword" type="password" {...register('confirmPassword')} disabled={isSubmitting} />
            {errors.confirmPassword && <p className="text-sm text-destructive mt-1">{errors.confirmPassword.message}</p>}
          </div>
          <DialogFooter className="pt-4">
            <DialogClose asChild>
                <Button type="button" variant="outline" disabled={isSubmitting} onClick={() => handleOpenChange(false)}>Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Assigning...' : 'Assign Admin'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}