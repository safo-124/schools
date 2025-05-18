// app/(platform)/school-admin/teachers/new/page.tsx
"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { z } from 'zod';
import { useForm, SubmitHandler, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from "date-fns";

// Import Shadcn/ui components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ArrowLeft, CheckCircle, XCircle, CalendarIcon } from "lucide-react";
// import { toast } from "sonner"; // Optional

// Zod schema for the form (client-side)
const createTeacherFormSchema = z.object({
  email: z.string().email("Invalid email address."),
  firstName: z.string().min(1, "First name is required."),
  lastName: z.string().min(1, "Last name is required."),
  password: z.string().min(6, "Password must be at least 6 characters long."),
  confirmPassword: z.string().min(6, "Please confirm your password."),
  phoneNumber: z.string().optional().or(z.literal('')), // Allow empty string
  teacherIdNumber: z.string().optional().or(z.literal('')), // Allow empty string
  dateOfJoining: z.date().optional().nullable(), // Use z.date() for DatePicker, allow null
  qualifications: z.string().optional().or(z.literal('')), // Allow empty string
  specialization: z.string().optional().or(z.literal('')), // Allow empty string
  profilePicture: z.string().url("Profile picture must be a valid URL if provided, or leave empty.").optional().or(z.literal('')), // Allow empty string
})
.refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match.",
  path: ["confirmPassword"],
});

type CreateTeacherFormValues = z.infer<typeof createTeacherFormSchema>;

export default function AddNewTeacherPage() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    control, 
    formState: { errors, isSubmitting },
  } = useForm<CreateTeacherFormValues>({
    resolver: zodResolver(createTeacherFormSchema),
    defaultValues: {
        email: '',
        firstName: '',
        lastName: '',
        password: '',
        confirmPassword: '',
        phoneNumber: '',
        teacherIdNumber: '',
        dateOfJoining: null,
        qualifications: '',
        specialization: '',
        profilePicture: '',
    }
  });

  const onSubmit: SubmitHandler<CreateTeacherFormValues> = async (formData) => {
    setSubmitError(null);
    setSubmitSuccess(null);

    const { confirmPassword, dateOfJoining, ...restOfData } = formData;
    const apiData = {
        ...restOfData,
        // Send date as ISO string or undefined. API schema expects string or null/undefined.
        dateOfJoining: dateOfJoining ? dateOfJoining.toISOString() : undefined, 
        // Ensure empty optional strings are sent as undefined or null if API schema expects that instead of ""
        // For Zod `.or(z.literal('')).nullable()` on API, sending "" is fine.
        // If API used just `.optional().nullable()`, convert "" to undefined/null
        phoneNumber: restOfData.phoneNumber === '' ? undefined : restOfData.phoneNumber,
        teacherIdNumber: restOfData.teacherIdNumber === '' ? undefined : restOfData.teacherIdNumber,
        qualifications: restOfData.qualifications === '' ? undefined : restOfData.qualifications,
        specialization: restOfData.specialization === '' ? undefined : restOfData.specialization,
        profilePicture: restOfData.profilePicture === '' ? undefined : restOfData.profilePicture,
    };

    // console.log("Submitting to API:", JSON.stringify(apiData, null, 2));

    try {
      const response = await fetch('/api/school-admin/teachers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiData),
      });

      const result = await response.json();

      if (!response.ok) {
        // console.error("API Error Response:", result);
        let errorMessage = result.message || `Error: ${response.status}`;
        if (result.errors) {
          const fieldErrors = Object.entries(result.errors as Record<string, string[]>)
            .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
            .join('; ');
          errorMessage = fieldErrors ? `Invalid fields: ${fieldErrors}` : errorMessage;
        }
        setSubmitError(errorMessage);
      } else {
        setSubmitSuccess(`Teacher "${result.user.firstName} ${result.user.lastName}" created successfully!`);
        // toast.success(`Teacher "${result.user.firstName} ${result.user.lastName}" created successfully!`);
        reset(); 
        setTimeout(() => {
          router.push('/school-admin/teachers');
        }, 2000);
      }
    } catch (err) {
      console.error("Create teacher error (client):", err);
      setSubmitError('An unexpected error occurred. Please try again.');
      // toast.error('An unexpected error occurred.');
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Add New Teacher</CardTitle>
          <Button variant="outline" size="sm" asChild>
            <Link href="/school-admin/teachers">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Teachers List
            </Link>
          </Button>
        </div>
        <CardDescription>
          Fill in the details below to add a new teacher to your school. 
          An account will be created if the email doesnt already exist.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          {submitError && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertTitle>Creation Failed</AlertTitle>
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
              <Label htmlFor="firstName-teacher">First Name</Label>
              <Input id="firstName-teacher" {...register('firstName')} disabled={isSubmitting} />
              {errors.firstName && <p className="text-sm text-destructive mt-1">{errors.firstName.message}</p>}
            </div>
            <div>
              <Label htmlFor="lastName-teacher">Last Name</Label>
              <Input id="lastName-teacher" {...register('lastName')} disabled={isSubmitting} />
              {errors.lastName && <p className="text-sm text-destructive mt-1">{errors.lastName.message}</p>}
            </div>
          </div>

          <div>
            <Label htmlFor="email-teacher">Email Address</Label>
            <Input id="email-teacher" type="email" {...register('email')} disabled={isSubmitting} />
            {errors.email && <p className="text-sm text-destructive mt-1">{errors.email.message}</p>}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="password-teacher">Password</Label>
              <Input id="password-teacher" type="password" {...register('password')} disabled={isSubmitting} />
              {errors.password && <p className="text-sm text-destructive mt-1">{errors.password.message}</p>}
            </div>
            <div>
              <Label htmlFor="confirmPassword-teacher">Confirm Password</Label>
              <Input id="confirmPassword-teacher" type="password" {...register('confirmPassword')} disabled={isSubmitting} />
              {errors.confirmPassword && <p className="text-sm text-destructive mt-1">{errors.confirmPassword.message}</p>}
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="phoneNumber-teacher">Phone Number (Optional)</Label>
              <Input id="phoneNumber-teacher" {...register('phoneNumber')} disabled={isSubmitting} />
              {errors.phoneNumber && <p className="text-sm text-destructive mt-1">{errors.phoneNumber.message}</p>}
            </div>
            <div>
              <Label htmlFor="teacherIdNumber-teacher">Teacher ID Number (Optional)</Label>
              <Input id="teacherIdNumber-teacher" {...register('teacherIdNumber')} disabled={isSubmitting} />
              {errors.teacherIdNumber && <p className="text-sm text-destructive mt-1">{errors.teacherIdNumber.message}</p>}
            </div>
          </div>

          <div>
            <Label htmlFor="dateOfJoining-teacher">Date of Joining (Optional)</Label>
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
                      {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={field.value || undefined}
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
            <Label htmlFor="qualifications-teacher">Qualifications (Optional)</Label>
            <Textarea id="qualifications-teacher" {...register('qualifications')} disabled={isSubmitting} />
            {errors.qualifications && <p className="text-sm text-destructive mt-1">{errors.qualifications.message}</p>}
          </div>

          <div>
            <Label htmlFor="specialization-teacher">Specialization (e.g., Mathematics, English) (Optional)</Label>
            <Input id="specialization-teacher" {...register('specialization')} disabled={isSubmitting} />
            {errors.specialization && <p className="text-sm text-destructive mt-1">{errors.specialization.message}</p>}
          </div>

           <div>
            <Label htmlFor="profilePicture-teacher">Profile Picture URL (Optional)</Label>
            <Input id="profilePicture-teacher" type="url" {...register('profilePicture')} disabled={isSubmitting} placeholder="https://example.com/image.png"/>
            {errors.profilePicture && <p className="text-sm text-destructive mt-1">{errors.profilePicture.message}</p>}
          </div>

        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Adding Teacher...' : 'Add Teacher'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}