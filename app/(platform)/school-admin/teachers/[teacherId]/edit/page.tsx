// app/(platform)/school-admin/teachers/[teacherId]/edit/page.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { z } from 'zod';
import { useForm, SubmitHandler, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from "date-fns";
import { User as PrismaUser, Teacher as PrismaTeacher } from '@prisma/client';

// Import Shadcn/ui components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch'; // For isActive status
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ArrowLeft, CheckCircle, XCircle, CalendarIcon } from "lucide-react";
// import { toast } from "sonner"; // Optional

// Zod schema for the form (must match the API's PATCH schema structure)
// All fields are optional for PATCH
const editTeacherFormSchema = z.object({
  firstName: z.string().min(1, "First name is required.").optional(),
  lastName: z.string().min(1, "Last name is required.").optional(),
  email: z.string().email("Invalid email address.").optional(),
  phoneNumber: z.string().optional().or(z.literal('')).nullable(),
  profilePicture: z.string().url("Profile picture must be a valid URL if provided.").optional().or(z.literal('')).nullable(),
  isActive: z.boolean().optional(), // For User model's active status

  teacherIdNumber: z.string().optional().or(z.literal('')).nullable(),
  dateOfJoining: z.date().optional().nullable(), // Use z.date() for DatePicker
  qualifications: z.string().optional().or(z.literal('')).nullable(),
  specialization: z.string().optional().or(z.literal('')).nullable(),
});

type EditTeacherFormValues = z.infer<typeof editTeacherFormSchema>;

// Combined type for data fetched from API (includes nested user)
interface TeacherData extends PrismaTeacher {
  user: Pick<PrismaUser, 'id' | 'firstName' | 'lastName' | 'email' | 'phoneNumber' | 'profilePicture' | 'isActive'>;
}

export default function EditTeacherPage() {
  const router = useRouter();
  const params = useParams();
  const teacherId = params.teacherId as string; // From the dynamic route segment

  const [initialLoading, setInitialLoading] = useState(true); // For fetching initial data
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    control, // For Controller component (DatePicker, Switch)
    formState: { errors, isSubmitting },
  } = useForm<EditTeacherFormValues>({
    resolver: zodResolver(editTeacherFormSchema),
    defaultValues: { // Initialize all fields to prevent uncontrolled warnings
        firstName: '',
        lastName: '',
        email: '',
        phoneNumber: '',
        profilePicture: '',
        isActive: true,
        teacherIdNumber: '',
        dateOfJoining: null,
        qualifications: '',
        specialization: '',
    }
  });

  useEffect(() => {
    if (!teacherId) {
        setFetchError("Teacher ID not found in URL.");
        setInitialLoading(false);
        return;
    };

    const fetchTeacherData = async () => {
      setInitialLoading(true);
      setFetchError(null);
      try {
        const response = await fetch(`/api/school-admin/teachers/${teacherId}`);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || `Failed to fetch teacher data: ${response.statusText}`);
        }
        const teacherData: TeacherData = await response.json();
        
        // Pre-fill the form with fetched data
        reset({
            firstName: teacherData.user.firstName || '',
            lastName: teacherData.user.lastName || '',
            email: teacherData.user.email || '',
            phoneNumber: teacherData.user.phoneNumber || '',
            profilePicture: teacherData.user.profilePicture || '',
            isActive: teacherData.user.isActive,
            teacherIdNumber: teacherData.teacherIdNumber || '',
            dateOfJoining: teacherData.dateOfJoining ? new Date(teacherData.dateOfJoining) : null,
            qualifications: teacherData.qualifications || '',
            specialization: teacherData.specialization || '',
        });
      } catch (err: any) {
        setFetchError(err.message);
        console.error("Fetch teacher data error:", err);
      } finally {
        setInitialLoading(false);
      }
    };
    fetchTeacherData();
  }, [teacherId, reset]);

  const onSubmit: SubmitHandler<EditTeacherFormValues> = async (formData) => {
    setSubmitError(null);
    setSubmitSuccess(null);

    // Prepare data for API: only send changed fields, format date
    const apiData: Partial<EditTeacherFormValues & {dateOfJoining?: string}> = {};

    // Compare with initial values (from reset) or keep track of dirty fields
    // For simplicity, we send all fields from the form that are part of the schema
    // The API's PATCH should handle partial updates correctly.
    // Ensure empty strings are handled to become null or undefined if desired by API schema.
    for (const key in formData) {
        const typedKey = key as keyof EditTeacherFormValues;
        if (formData[typedKey] !== undefined) { // Only include fields that were part of the form's values
            if (typedKey === 'dateOfJoining') {
                apiData[typedKey] = formData.dateOfJoining ? formData.dateOfJoining.toISOString() : null;
            } else if (formData[typedKey] === '') { // Convert empty strings for optional text fields to null or undefined
                apiData[typedKey] = null; // Or undefined, depending on API expectation
            }
             else {
                (apiData as any)[typedKey] = formData[typedKey];
            }
        }
    }


    if (Object.keys(apiData).length === 0) {
        setSubmitError("No changes to submit.");
        return;
    }
    // console.log("Submitting to API:", JSON.stringify(apiData, null, 2));

    try {
      const response = await fetch(`/api/school-admin/teachers/${teacherId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiData),
      });

      const result = await response.json();

      if (!response.ok) {
        setSubmitError(result.message || `Error: ${response.status} - ${result.errors ? JSON.stringify(result.errors) : response.statusText}`);
      } else {
        setSubmitSuccess(`Teacher "${result.user.firstName} ${result.user.lastName}" updated successfully!`);
        // toast.success("Teacher details updated!");
        setTimeout(() => {
          // router.push(`/school-admin/teachers`); // Or a teacher details page if you create one
          router.refresh(); // Refresh current page to show updated data if staying
          setSubmitSuccess(null); // Clear success message
        }, 2000);
      }
    } catch (err) {
      console.error("Update teacher error (client):", err);
      setSubmitError('An unexpected error occurred. Please try again.');
      // toast.error('An unexpected error occurred.');
    }
  };

  if (initialLoading) return (
    <Card className="w-full max-w-2xl mx-auto"><CardHeader><CardTitle>Edit Teacher</CardTitle></CardHeader><CardContent><p>Loading teacher data...</p></CardContent></Card>
  );
  if (fetchError) return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader><CardTitle>Error</CardTitle></CardHeader>
      <CardContent>
        <Alert variant="destructive"><AlertTitle>Failed to Load Data</AlertTitle><AlertDescription>{fetchError}</AlertDescription></Alert>
        <Button variant="outline" asChild className="mt-4"><Link href="/school-admin/teachers"><ArrowLeft className="mr-2 h-4 w-4"/>Back to Teachers List</Link></Button>
      </CardContent>
    </Card>
  );

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Edit Teacher Details</CardTitle>
          <Button variant="outline" size="sm" asChild>
            <Link href="/school-admin/teachers">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Teachers List
            </Link>
          </Button>
        </div>
        <CardDescription>
          Update the details for the teacher. Fields left blank will not be changed unless they are cleared.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          {submitError && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertTitle>Update Failed</AlertTitle>
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="edit-teacher-firstName">First Name</Label>
              <Input id="edit-teacher-firstName" {...register('firstName')} disabled={isSubmitting} />
              {errors.firstName && <p className="text-sm text-destructive mt-1">{errors.firstName.message}</p>}
            </div>
            <div>
              <Label htmlFor="edit-teacher-lastName">Last Name</Label>
              <Input id="edit-teacher-lastName" {...register('lastName')} disabled={isSubmitting} />
              {errors.lastName && <p className="text-sm text-destructive mt-1">{errors.lastName.message}</p>}
            </div>
          </div>

          <div>
            <Label htmlFor="edit-teacher-email">Email Address</Label>
            <Input id="edit-teacher-email" type="email" {...register('email')} disabled={isSubmitting} />
            {errors.email && <p className="text-sm text-destructive mt-1">{errors.email.message}</p>}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="edit-teacher-phoneNumber">Phone Number</Label>
              <Input id="edit-teacher-phoneNumber" {...register('phoneNumber')} disabled={isSubmitting} />
              {errors.phoneNumber && <p className="text-sm text-destructive mt-1">{errors.phoneNumber.message}</p>}
            </div>
            <div>
              <Label htmlFor="edit-teacher-teacherIdNumber">Teacher ID Number</Label>
              <Input id="edit-teacher-teacherIdNumber" {...register('teacherIdNumber')} disabled={isSubmitting} />
              {errors.teacherIdNumber && <p className="text-sm text-destructive mt-1">{errors.teacherIdNumber.message}</p>}
            </div>
          </div>

          <div>
            <Label htmlFor="edit-teacher-dateOfJoining">Date of Joining</Label>
            <Controller
              name="dateOfJoining"
              control={control}
              render={({ field }) => (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={`w-full justify-start text-left font-normal ${!field.value && "text-muted-foreground"}`}
                      disabled={isSubmitting}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {field.value ? format(new Date(field.value), "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={field.value ? new Date(field.value) : undefined}
                      onSelect={(date) => field.onChange(date || null)}
                      initialFocus
                      disabled={isSubmitting}
                    />
                  </PopoverContent>
                </Popover>
              )}
            />
            {errors.dateOfJoining && <p className="text-sm text-destructive mt-1">{errors.dateOfJoining.message}</p>}
          </div>

          <div>
            <Label htmlFor="edit-teacher-qualifications">Qualifications</Label>
            <Textarea id="edit-teacher-qualifications" {...register('qualifications')} disabled={isSubmitting} />
            {errors.qualifications && <p className="text-sm text-destructive mt-1">{errors.qualifications.message}</p>}
          </div>

          <div>
            <Label htmlFor="edit-teacher-specialization">Specialization</Label>
            <Input id="edit-teacher-specialization" {...register('specialization')} disabled={isSubmitting} />
            {errors.specialization && <p className="text-sm text-destructive mt-1">{errors.specialization.message}</p>}
          </div>

           <div>
            <Label htmlFor="edit-teacher-profilePicture">Profile Picture URL</Label>
            <Input id="edit-teacher-profilePicture" type="url" {...register('profilePicture')} disabled={isSubmitting} placeholder="https://example.com/image.png"/>
            {errors.profilePicture && <p className="text-sm text-destructive mt-1">{errors.profilePicture.message}</p>}
          </div>

          <div className="flex items-center space-x-2 pt-2">
            <Controller
                name="isActive"
                control={control}
                render={({ field }) => (
                    <Switch
                        id="edit-teacher-isActive"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={isSubmitting}
                    />
                )}
            />
            <Label htmlFor="edit-teacher-isActive" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              User Account Active
            </Label>
            {errors.isActive && <p className="text-sm text-destructive mt-1">{errors.isActive.message}</p>}
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