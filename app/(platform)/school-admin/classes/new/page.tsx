// app/(platform)/school-admin/classes/new/page.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { z } from 'zod';
import { useForm, SubmitHandler, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';


// Import Shadcn/ui components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton"; // For loading state
import { toast } from "sonner"; // For notifications
import { ArrowLeft} from "lucide-react";

// Zod schema for the form (client-side)
const createClassFormSchema = z.object({
  name: z.string().min(1, "Class name/level is required (e.g., Grade 1, JHS 2)."),
  section: z.string().optional().or(z.literal('')), // e.g., A, Blue, Gold.
  academicYear: z.string()
    .regex(/^\d{4}-\d{4}$/, "Academic year must be in YYYY-YYYY format (e.g., 2024-2025).")
    .refine(year => {
        const years = year.split('-');
        return parseInt(years[0]) + 1 === parseInt(years[1]);
    }, "Academic year range must be consecutive (e.g., 2024-2025)."),
  homeroomTeacherId: z.string().cuid("Please select a valid teacher.").optional().nullable(),
});

type CreateClassFormValues = z.infer<typeof createClassFormSchema>;

// Simplified type for teacher dropdown (assuming API returns this structure)
interface SimpleTeacher {
  id: string;
  user: {
    firstName: string | null;
    lastName: string | null;
  };
}

export default function AddNewClassPage() {
  const router = useRouter();
  // Removed submitError and submitSuccess state, will use toasts directly
  const [availableTeachers, setAvailableTeachers] = useState<SimpleTeacher[]>([]);
  const [isTeachersLoading, setIsTeachersLoading] = useState(true);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CreateClassFormValues>({
    resolver: zodResolver(createClassFormSchema),
    defaultValues: {
      name: '',
      section: '',
      academicYear: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`, // Default to current/next academic year
      homeroomTeacherId: null,
    }
  });

  // Fetch available teachers for the dropdown
  useEffect(() => {
    const fetchTeachers = async () => {
      setIsTeachersLoading(true);
      try {
        const response = await fetch('/api/school-admin/teachers'); // Uses existing teachers list API
        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.message || 'Failed to fetch teachers for selection.');
        }
        const data: SimpleTeacher[] = await response.json(); // Assuming API returns teachers with nested user: {firstName, lastName}
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

  const onSubmit: SubmitHandler<CreateClassFormValues> = async (formData) => {
    const apiData = {
      ...formData,
      section: formData.section === '' ? null : formData.section,
      homeroomTeacherId: formData.homeroomTeacherId === '' || formData.homeroomTeacherId === 'none' ? null : formData.homeroomTeacherId,
    };
    // console.log("Submitting Class Data to API:", JSON.stringify(apiData, null, 2));

    try {
      const response = await fetch('/api/school-admin/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiData),
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
        toast.error("Class creation failed: " + errorMessage);
      } else {
        toast.success(`Class "${result.name} ${result.section || ''}" created successfully!`);
        reset(); 
        setTimeout(() => {
          router.push('/school-admin/classes'); 
        }, 1500);
      }
    } catch (err: any) {
      console.error("Create class error (client):", err);
      toast.error('An unexpected error occurred: ' + err.message);
    }
  };

  return (
    <Card className="w-full max-w-lg mx-auto"> {/* Adjusted max-width */}
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Add New Class/Section</CardTitle>
          <Button variant="outline" size="sm" asChild>
            <Link href="/school-admin/classes">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Classes List
            </Link>
          </Button>
        </div>
        <CardDescription>
          Define a new class or section within an academic year.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4 pt-6">
          {/* No more Alert components for success/error, relying on toasts */}

          <div>
            <Label htmlFor="name-class">Class Name/Level <span className="text-destructive">*</span></Label>
            <Input id="name-class" {...register('name')} placeholder="e.g., Grade 1, JHS 2, Form 1" disabled={isSubmitting} />
            {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
          </div>

          <div>
            <Label htmlFor="section-class">Section (Optional)</Label>
            <Input id="section-class" {...register('section')} placeholder="e.g., A, B, Blue, Gold" disabled={isSubmitting} />
            {errors.section && <p className="text-sm text-destructive mt-1">{errors.section.message}</p>}
          </div>
          
          <div>
            <Label htmlFor="academicYear-class">Academic Year <span className="text-destructive">*</span></Label>
            <Input id="academicYear-class" {...register('academicYear')} placeholder="e.g., 2024-2025" disabled={isSubmitting} />
            {errors.academicYear && <p className="text-sm text-destructive mt-1">{errors.academicYear.message}</p>}
          </div>

          <div>
            <Label htmlFor="homeroomTeacherId-class">Homeroom Teacher (Optional)</Label>
            {isTeachersLoading ? (
                <Skeleton className="h-10 w-full" />
            ) : (
                <Controller
                name="homeroomTeacherId"
                control={control}
                render={({ field }) => (
                    <Select
                        onValueChange={(value) => field.onChange(value === "none" ? null : value)}
                        value={field.value || "none"} // Handle null value for placeholder
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
          <Button type="submit" disabled={isSubmitting || isTeachersLoading}>
            {isSubmitting ? 'Adding Class...' : 'Add Class'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}