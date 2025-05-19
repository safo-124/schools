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
// Alert component is not used directly if relying on toasts for feedback
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
// Skeleton not used on this specific page as it doesn't fetch dropdown data currently
import { toast } from "sonner";
import { ArrowLeft, PlusCircle, CalendarIcon } from "lucide-react";

// Zod schema for the form (client-side)
const createTeacherFormSchema = z.object({
  email: z.string().email("Invalid email address."),
  firstName: z.string().min(1, "First name is required."),
  lastName: z.string().min(1, "Last name is required."),
  password: z.string().min(6, "Password must be at least 6 characters long."),
  confirmPassword: z.string().min(6, "Please confirm your password."),
  phoneNumber: z.string().optional().or(z.literal('')), 
  teacherIdNumber: z.string().optional().or(z.literal('')), 
  dateOfJoining: z.date().optional().nullable(), 
  qualifications: z.string().optional().or(z.literal('')), 
  specialization: z.string().optional().or(z.literal('')), 
  profilePicture: z.string().url("Profile picture must be a valid URL if provided, or leave empty.").optional().or(z.literal('')),
})
.refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match.",
  path: ["confirmPassword"],
});

type CreateTeacherFormValues = z.infer<typeof createTeacherFormSchema>;

export default function AddNewTeacherPage() {
  const router = useRouter();
  // submitError and submitSuccess state are handled by toasts

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
        dateOfJoining: null, // Default to null for optional date
        qualifications: '',
        specialization: '',
        profilePicture: '',
    }
  });

  const onSubmit: SubmitHandler<CreateTeacherFormValues> = async (formData) => {
    const submittingToastId = toast.loading("Adding new teacher...");
    
    const { confirmPassword, dateOfJoining, ...restOfData } = formData;
    const apiData = {
        ...restOfData,
        dateOfJoining: dateOfJoining ? dateOfJoining.toISOString() : undefined,
        // Ensure empty optional strings are handled as per API expectation (e.g., convert to null if API doesn't like "")
        // The API schema for teachers used .or(z.literal('')).nullable() for these, so "" or null should be fine.
        // For robustness, if API expects null for empty fields, convert them:
        phoneNumber: restOfData.phoneNumber === '' ? null : restOfData.phoneNumber,
        teacherIdNumber: restOfData.teacherIdNumber === '' ? null : restOfData.teacherIdNumber,
        qualifications: restOfData.qualifications === '' ? null : restOfData.qualifications,
        specialization: restOfData.specialization === '' ? null : restOfData.specialization,
        profilePicture: restOfData.profilePicture === '' ? null : restOfData.profilePicture,
    };
    console.log("[ADD_TEACHER_PAGE] Submitting to API:", JSON.stringify(apiData, null, 2));

    try {
      const response = await fetch('/api/school-admin/teachers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiData),
      });

      if (!response.ok) {
        const responseText = await response.text(); // Get response text for non-OK responses
        console.error(`[ADD_TEACHER_PAGE] API Error: Status ${response.status}. Response text:`, responseText);
        let errorMessage = `Failed to create teacher. Status: ${response.status}.`;
        try {
            // Try to parse if it might be JSON error from our API
            const errorResult = JSON.parse(responseText); 
            errorMessage = errorResult.message || (errorResult.errors ? JSON.stringify(errorResult.errors) : errorMessage);
        } catch (e) {
            // Response was not JSON (e.g., HTML error page from server crash)
            const previewText = responseText.length > 150 ? responseText.substring(0, 150) + "..." : responseText;
            errorMessage = `${errorMessage} Server response: ${previewText}`;
        }
        throw new Error(errorMessage);
      }

      // Only attempt to parse JSON if response.ok is true and content is expected
      const result = await response.json(); 
      
      toast.success(`Teacher "${result.user.firstName} ${result.user.lastName}" created successfully!`, { id: submittingToastId });
      reset(); 
      setTimeout(() => {
        router.push('/school-admin/teachers'); 
      }, 1500);

    } catch (error: any) {
      toast.error("Failed to create teacher", { id: submittingToastId, description: error.message });
      console.error("[ADD_TEACHER_PAGE] Create teacher submission/catch error:", error);
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
          An account will be created if the email doesn't already exist.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4 pt-6">
          {/* Toasts handle submit success/error messages */}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="firstName-teacher-add">First Name <span className="text-destructive">*</span></Label>
              <Input id="firstName-teacher-add" {...register('firstName')} disabled={isSubmitting} />
              {errors.firstName && <p className="text-sm text-destructive mt-1">{errors.firstName.message}</p>}
            </div>
            <div>
              <Label htmlFor="lastName-teacher-add">Last Name <span className="text-destructive">*</span></Label>
              <Input id="lastName-teacher-add" {...register('lastName')} disabled={isSubmitting} />
              {errors.lastName && <p className="text-sm text-destructive mt-1">{errors.lastName.message}</p>}
            </div>
          </div>

          <div>
            <Label htmlFor="email-teacher-add">Email Address <span className="text-destructive">*</span></Label>
            <Input id="email-teacher-add" type="email" {...register('email')} disabled={isSubmitting} />
            {errors.email && <p className="text-sm text-destructive mt-1">{errors.email.message}</p>}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="password-teacher-add">Password <span className="text-destructive">*</span></Label>
              <Input id="password-teacher-add" type="password" {...register('password')} disabled={isSubmitting} />
              {errors.password && <p className="text-sm text-destructive mt-1">{errors.password.message}</p>}
            </div>
            <div>
              <Label htmlFor="confirmPassword-teacher-add">Confirm Password <span className="text-destructive">*</span></Label>
              <Input id="confirmPassword-teacher-add" type="password" {...register('confirmPassword')} disabled={isSubmitting} />
              {errors.confirmPassword && <p className="text-sm text-destructive mt-1">{errors.confirmPassword.message}</p>}
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="phoneNumber-teacher-add">Phone Number (Optional)</Label>
              <Input id="phoneNumber-teacher-add" {...register('phoneNumber')} disabled={isSubmitting} />
              {errors.phoneNumber && <p className="text-sm text-destructive mt-1">{errors.phoneNumber.message}</p>}
            </div>
            <div>
              <Label htmlFor="teacherIdNumber-teacher-add">Teacher ID Number (Optional)</Label>
              <Input id="teacherIdNumber-teacher-add" {...register('teacherIdNumber')} disabled={isSubmitting} />
              {errors.teacherIdNumber && <p className="text-sm text-destructive mt-1">{errors.teacherIdNumber.message}</p>}
            </div>
          </div>

          <div>
            <Label htmlFor="dateOfJoining-teacher-add">Date of Joining (Optional)</Label>
            <Controller
              name="dateOfJoining"
              control={control}
              render={({ field }) => (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      id="dateOfJoining-teacher-add"
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
            <Label htmlFor="qualifications-teacher-add">Qualifications (Optional)</Label>
            <Textarea id="qualifications-teacher-add" {...register('qualifications')} disabled={isSubmitting} />
            {errors.qualifications && <p className="text-sm text-destructive mt-1">{errors.qualifications.message}</p>}
          </div>

          <div>
            <Label htmlFor="specialization-teacher-add">Specialization (e.g., Mathematics, English) (Optional)</Label>
            <Input id="specialization-teacher-add" {...register('specialization')} disabled={isSubmitting} />
            {errors.specialization && <p className="text-sm text-destructive mt-1">{errors.specialization.message}</p>}
          </div>

           <div>
            <Label htmlFor="profilePicture-teacher-add">Profile Picture URL (Optional)</Label>
            <Input id="profilePicture-teacher-add" type="url" {...register('profilePicture')} disabled={isSubmitting} placeholder="https://example.com/image.png"/>
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