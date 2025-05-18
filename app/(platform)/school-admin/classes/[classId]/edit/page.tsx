// app/(platform)/school-admin/classes/[classId]/edit/page.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { z } from 'zod';
import { useForm, SubmitHandler, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Class as PrismaClass, Teacher as PrismaTeacher, User as PrismaUser } from '@prisma/client';

// Import Shadcn/ui components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// Zod schema for the form (should align with API's PATCH schema)
const editClassFormSchema = z.object({
  name: z.string().min(1, "Class name/level is required.").optional(),
  section: z.string().optional().or(z.literal('')).nullable(),
  academicYear: z.string()
    .regex(/^\d{4}-\d{4}$/, "Academic year must be in YYYY-YYYY format.")
    .refine(year => {
        if(!year) return true;
        const years = year.split('-');
        return parseInt(years[0]) + 1 === parseInt(years[1]);
    }, "Academic year range must be consecutive (e.g., 2024-2025).")
    .optional(),
  homeroomTeacherId: z.string().cuid("Invalid Homeroom Teacher ID.").optional().nullable(),
});

type EditClassFormValues = z.infer<typeof editClassFormSchema>;

// Type for data fetched for a single class to edit
interface ClassDataToEdit extends PrismaClass {
  homeroomTeacher?: {
    id: string;
    user: Pick<PrismaUser, 'firstName' | 'lastName'>;
  } | null;
}

// Simplified type for teacher dropdown
interface SimpleTeacher {
  id: string;
  user: {
    firstName: string | null;
    lastName: string | null;
  };
}

export default function EditClassPage() {
  const router = useRouter();
  const params = useParams();
  const classId = params.classId as string;

  const [initialLoading, setInitialLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [availableTeachers, setAvailableTeachers] = useState<SimpleTeacher[]>([]);
  const [isTeachersLoading, setIsTeachersLoading] = useState(true);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting, dirtyFields },
  } = useForm<EditClassFormValues>({
    resolver: zodResolver(editClassFormSchema),
    defaultValues: {}, // Will be populated by useEffect
  });

  // Fetch class data for pre-filling the form
  useEffect(() => {
    if (!classId) {
      setFetchError("Class ID not found in URL.");
      setInitialLoading(false);
      return;
    }

    const fetchClassData = async () => {
      setInitialLoading(true);
      setFetchError(null);
      try {
        const response = await fetch(`/api/school-admin/classes/${classId}`);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || `Failed to fetch class data: ${response.statusText}`);
        }
        const classData: ClassDataToEdit = await response.json();
        
        reset({
            name: classData.name || '',
            section: classData.section || '',
            academicYear: classData.academicYear || '',
            homeroomTeacherId: classData.homeroomTeacherId || null,
        });
      } catch (err: any) {
        setFetchError(err.message);
        toast.error("Failed to load class data: " + err.message);
        console.error("Fetch class data error:", err);
      } finally {
        setInitialLoading(false);
      }
    };
    fetchClassData();
  }, [classId, reset]);

  // Fetch available teachers for the dropdown
  useEffect(() => {
    const fetchTeachers = async () => {
      setIsTeachersLoading(true);
      try {
        const response = await fetch('/api/school-admin/teachers');
        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.message || 'Failed to fetch teachers.');
        }
        const data: SimpleTeacher[] = await response.json();
        setAvailableTeachers(data);
      } catch (error: any) {
        console.error("Failed to fetch teachers for dropdown:", error);
        toast.error("Could not load teacher list: " + error.message);
      } finally {
        setIsTeachersLoading(false);
      }
    };
    fetchTeachers();
  }, []);

  const onSubmit: SubmitHandler<EditClassFormValues> = async (formData) => {
    const changedData: Partial<EditClassFormValues> = {};
    let hasChanges = false;

    for (const key in dirtyFields) {
        if (dirtyFields[key as keyof EditClassFormValues]) {
            hasChanges = true;
            const typedKey = key as keyof EditClassFormValues;
            if (formData[typedKey] === '') { // Handle empty strings for optional fields meant to be cleared
                if (typedKey === 'section' || typedKey === 'homeroomTeacherId') {
                    changedData[typedKey] = null;
                } else {
                     // For other string fields, if API expects null for empty, send null.
                     // Otherwise, if API handles "", send formData[typedKey]
                    changedData[typedKey] = formData[typedKey];
                }
            } else {
                (changedData as any)[typedKey] = formData[typedKey];
            }
        }
    }
    
    // Ensure homeroomTeacherId: "none" from select is converted to null
    if (changedData.homeroomTeacherId === "none") {
        changedData.homeroomTeacherId = null;
    }


    if (!hasChanges) {
        toast.info("No changes were made to submit.");
        return;
    }
    
    // console.log("Submitting Updated Class Data to API:", JSON.stringify(changedData, null, 2));

    try {
      const response = await fetch(`/api/school-admin/classes/${classId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changedData),
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
        toast.error("Class update failed: " + errorMessage);
      } else {
        toast.success(`Class "${result.name} ${result.section || ''}" updated successfully!`);
        setTimeout(() => {
          router.push('/school-admin/classes'); 
          // router.refresh(); // if staying on page to reflect changes (less common for edit submission)
        }, 1500);
      }
    } catch (err: any) {
      console.error("Update class error (client):", err);
      toast.error('An unexpected error occurred: ' + err.message);
    }
  };
  
  if (initialLoading) return (
    <Card className="w-full max-w-lg mx-auto">
      <CardHeader><CardTitle>Edit Class/Section</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-10 w-24 mt-4" />
      </CardContent>
    </Card>
  );

  if (fetchError && !initialLoading) return (
    <Card className="w-full max-w-lg mx-auto">
      <CardHeader><CardTitle>Error</CardTitle></CardHeader>
      <CardContent>
        <Alert variant="destructive"><AlertTitle>Failed to Load Class Data</AlertTitle><AlertDescription>{fetchError}</AlertDescription></Alert>
        <Button variant="outline" asChild className="mt-4"><Link href="/school-admin/classes"><ArrowLeft className="mr-2 h-4 w-4"/>Back to Classes List</Link></Button>
      </CardContent>
    </Card>
  );

  return (
    <Card className="w-full max-w-lg mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Edit Class/Section</CardTitle>
          <Button variant="outline" size="sm" asChild>
            <Link href="/school-admin/classes">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Classes List
            </Link>
          </Button>
        </div>
        <CardDescription>
          Update the details for this class or section.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4 pt-6">
          {/* Toasts will handle submit success/error, no inline Alert needed here usually */}

          <div>
            <Label htmlFor="edit-class-name">Class Name/Level <span className="text-destructive">*</span></Label>
            <Input id="edit-class-name" {...register('name')} placeholder="e.g., Grade 1, JHS 2" disabled={isSubmitting} />
            {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
          </div>

          <div>
            <Label htmlFor="edit-class-section">Section (Optional)</Label>
            <Input id="edit-class-section" {...register('section')} placeholder="e.g., A, B, Blue, Gold" disabled={isSubmitting} />
            {errors.section && <p className="text-sm text-destructive mt-1">{errors.section.message}</p>}
          </div>
          
          <div>
            <Label htmlFor="edit-class-academicYear">Academic Year <span className="text-destructive">*</span></Label>
            <Input id="edit-class-academicYear" {...register('academicYear')} placeholder="e.g., 2024-2025" disabled={isSubmitting} />
            {errors.academicYear && <p className="text-sm text-destructive mt-1">{errors.academicYear.message}</p>}
          </div>

          <div>
            <Label htmlFor="edit-class-homeroomTeacherId">Homeroom Teacher (Optional)</Label>
            {isTeachersLoading ? (
                <Skeleton className="h-10 w-full" />
            ) : (
                <Controller
                name="homeroomTeacherId"
                control={control}
                render={({ field }) => (
                    <Select
                        onValueChange={(value) => field.onChange(value === "none" ? null : value)}
                        value={field.value || "none"} // Handle null for placeholder
                        disabled={isSubmitting || availableTeachers.length === 0}
                    >
                    <SelectTrigger>
                        <SelectValue placeholder={availableTeachers.length === 0 ? "No teachers available" : "Select a homeroom teacher"} />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="none">-- None --</SelectItem>
                        {availableTeachers.map((teacher) => (
                        <SelectItem key={teacher.id} value={teacher.id}>
                            {teacher.user.firstName} {teacher.user.lastName}
                        </SelectItem>
                        ))}
                    </SelectContent>
                    </Select>
                )}
                />
            )}
            {errors.homeroomTeacherId && <p className="text-sm text-destructive mt-1">{errors.homeroomTeacherId.message}</p>}
          </div>

        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={isSubmitting || initialLoading || isTeachersLoading}>
            {isSubmitting ? 'Saving Changes...' : 'Save Changes'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}