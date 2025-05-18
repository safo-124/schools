// app/(platform)/school-admin/subjects/[subjectId]/edit/page.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { z } from 'zod';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Subject as PrismaSubject } from '@prisma/client';

// Import Shadcn/ui components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

// Zod schema for the form (should align with API's PATCH schema - all optional)
const editSubjectFormSchema = z.object({
  name: z.string().min(1, "Subject name is required.").optional(),
  code: z.string().optional().or(z.literal('')).nullable(),
  description: z.string().optional().or(z.literal('')).nullable(),
});

type EditSubjectFormValues = z.infer<typeof editSubjectFormSchema>;
type SubjectDataToEdit = PrismaSubject; // Using Prisma type directly

export default function EditSubjectPage() {
  const router = useRouter();
  const params = useParams();
  const subjectId = params.subjectId as string;

  const [initialLoading, setInitialLoading] = useState(true);
  // Fetch error state is not strictly needed if toasts handle all error displays
  // const [fetchError, setFetchError] = useState<string | null>(null); 

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, dirtyFields }, // Use dirtyFields to send only changed data
  } = useForm<EditSubjectFormValues>({
    resolver: zodResolver(editSubjectFormSchema),
    defaultValues: { // Initialize to prevent uncontrolled component warnings
        name: '',
        code: '',
        description: '',
    }
  });

  // Fetch subject data for pre-filling the form
  useEffect(() => {
    if (!subjectId) {
      toast.error("Error: Subject ID not found in URL.");
      setInitialLoading(false);
      return;
    }

    const fetchSubjectData = async () => {
      setInitialLoading(true);
      // setFetchError(null);
      try {
        const response = await fetch(`/api/school-admin/subjects/${subjectId}`);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || `Failed to fetch subject data: ${response.statusText}`);
        }
        const subjectData: SubjectDataToEdit = await response.json();
        
        reset({ // Pre-fill the form with fetched data
            name: subjectData.name || '',
            code: subjectData.code || '',
            description: subjectData.description || '',
        });
      } catch (err: any) {
        // setFetchError(err.message);
        toast.error("Failed to load subject data", { description: err.message });
        console.error("Fetch subject data error:", err);
      } finally {
        setInitialLoading(false);
      }
    };
    fetchSubjectData();
  }, [subjectId, reset]);

  const onSubmit: SubmitHandler<EditSubjectFormValues> = async (formData) => {
    const changedData: Partial<EditSubjectFormValues> = {};
    let hasChanges = false;

    // Populate changedData only with fields that were actually modified by the user
    for (const key in dirtyFields) {
        if (dirtyFields[key as keyof EditSubjectFormValues]) {
            hasChanges = true;
            const typedKey = key as keyof EditSubjectFormValues;
            // Handle empty strings for optional fields to be sent as null, if desired by API
            if (formData[typedKey] === '') {
                if (typedKey === 'code' || typedKey === 'description') {
                    changedData[typedKey] = null; 
                } else {
                    changedData[typedKey] = formData[typedKey]; // For 'name', empty string is not allowed by min(1)
                }
            } else {
                (changedData as any)[typedKey] = formData[typedKey];
            }
        }
    }

    if (!hasChanges) {
        toast.info("No changes were made to submit.");
        return;
    }
    
    // console.log("Submitting Updated Subject Data to API:", JSON.stringify(changedData, null, 2));

    try {
      const response = await fetch(`/api/school-admin/subjects/${subjectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changedData), // Send only changed data
      });

      const result = await response.json();

      if (!response.ok) {
        let errorMessage = result.message || `Error: ${response.status}`;
        if (result.errors) {
          const fieldErrors = Object.entries(result.errors as Record<string, string[]>)
            .map(([field, messages]) => `${field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}: ${messages.join(', ')}`)
            .join('; ');
          errorMessage = fieldErrors ? `Validation Error: ${fieldErrors}` : errorMessage;
        }
        toast.error("Subject update failed", { description: errorMessage });
      } else {
        toast.success(`Subject "${result.name}" updated successfully!`);
        reset(result); // Reset form with newly saved data to clear dirty state
        setTimeout(() => {
          router.push('/school-admin/subjects'); 
          // router.refresh(); // if staying on this page and want to ensure data consistency with server
        }, 1500);
      }
    } catch (err: any) {
      console.error("Update subject error (client):", err);
      toast.error('An unexpected error occurred', { description: err.message || "Please try again."});
    }
  };
  
  if (initialLoading) {
    return (
      <Card className="w-full max-w-lg mx-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Edit Subject</CardTitle>
            <Button variant="outline" size="sm" asChild disabled>
              <Link href="/school-admin/subjects">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Subjects List
              </Link>
            </Button>
          </div>
          <CardDescription><Skeleton className="h-4 w-3/4" /></CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
        <CardFooter>
          <Skeleton className="h-10 w-28" />
        </CardFooter>
      </Card>
    );
  }

  // If fetchError occurred after initialLoading is false (e.g. subjectId was invalid from start)
  // This assumes initialLoading will become false even if fetch fails.
  // A more robust way is if fetchSchoolData returns a value indicating data couldn't be loaded.
  // For now, if !initialLoading and no subject data in form (e.g. name is empty after reset with potentially null data),
  // it means fetch failed, and toast should have appeared.
  // The form will be rendered with empty or last known values.

  return (
    <Card className="w-full max-w-lg mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Edit Subject</CardTitle>
          <Button variant="outline" size="sm" asChild>
            <Link href="/school-admin/subjects">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Subjects List
            </Link>
          </Button>
        </div>
        <CardDescription>
          Update the details for this subject.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4 pt-6">
          {/* Toasts handle submit success/error */}

          <div>
            <Label htmlFor="edit-subject-name">Subject Name <span className="text-destructive">*</span></Label>
            <Input id="edit-subject-name" {...register('name')} placeholder="e.g., Mathematics, English" disabled={isSubmitting} />
            {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
          </div>

          <div>
            <Label htmlFor="edit-subject-code">Subject Code (Optional)</Label>
            <Input id="edit-subject-code" {...register('code')} placeholder="e.g., MATH101, ENG202" disabled={isSubmitting} />
            {errors.code && <p className="text-sm text-destructive mt-1">{errors.code.message}</p>}
          </div>
          
          <div>
            <Label htmlFor="edit-subject-description">Description (Optional)</Label>
            <Textarea id="edit-subject-description" {...register('description')} placeholder="Briefly describe the subject" disabled={isSubmitting} />
            {errors.description && <p className="text-sm text-destructive mt-1">{errors.description.message}</p>}
          </div>

        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={isSubmitting || initialLoading}>
            {isSubmitting ? 'Saving Changes...' : 'Save Changes'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}