// app/(platform)/school-admin/subjects/new/page.tsx
"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { z } from 'zod';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

// Import Shadcn/ui components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from '@/components/ui/textarea'; // For description
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { toast } from "sonner"; // For notifications
import { ArrowLeft } from "lucide-react";

// Zod schema for the form (client-side) - matches API's createSubjectApiSchema
const createSubjectFormSchema = z.object({
  name: z.string().min(1, "Subject name is required (e.g., Mathematics, Integrated Science)."),
  code: z.string().optional().or(z.literal('')).nullable(), // e.g., MATH101. Optional.
  description: z.string().optional().or(z.literal('')).nullable(),
});

type CreateSubjectFormValues = z.infer<typeof createSubjectFormSchema>;

export default function AddNewSubjectPage() {
  const router = useRouter();
  // No separate error/success state, relying on toasts

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateSubjectFormValues>({
    resolver: zodResolver(createSubjectFormSchema),
    defaultValues: {
      name: '',
      code: '',
      description: '',
    }
  });

  const onSubmit: SubmitHandler<CreateSubjectFormValues> = async (formData) => {
    // Prepare data for API: ensure empty optional strings are sent as null if schema expects null
    const apiData = {
      ...formData,
      code: formData.code === '' ? null : formData.code,
      description: formData.description === '' ? null : formData.description,
    };
    // console.log("Submitting Subject Data to API:", JSON.stringify(apiData, null, 2));

    try {
      const response = await fetch('/api/school-admin/subjects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiData),
      });

      const result = await response.json();

      if (!response.ok) {
        let errorMessage = result.message || `Error: ${response.status}`;
        if (result.errors) {
          // Format Zod field errors for better display in toast
          const fieldErrors = Object.entries(result.errors as Record<string, string[]>)
            .map(([field, messages]) => `${field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}: ${messages.join(', ')}`)
            .join('; ');
          errorMessage = fieldErrors ? `Validation Error: ${fieldErrors}` : errorMessage;
        }
        toast.error("Subject creation failed", { description: errorMessage });
      } else {
        toast.success(`Subject "${result.name}" created successfully!`);
        reset(); 
        setTimeout(() => {
          router.push('/school-admin/subjects'); 
        }, 1500);
      }
    } catch (err: any) {
      console.error("Create subject error (client):", err);
      toast.error('An unexpected error occurred', { description: err.message || "Please try again." });
    }
  };

  return (
    <Card className="w-full max-w-lg mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Add New Subject</CardTitle>
          <Button variant="outline" size="sm" asChild>
            <Link href="/school-admin/subjects">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Subjects List
            </Link>
          </Button>
        </div>
        <CardDescription>
          Define a new subject offered by your school.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4 pt-6">
          {/* Toasts will handle submit success/error, no inline Alert needed here */}

          <div>
            <Label htmlFor="subject-name">Subject Name <span className="text-destructive">*</span></Label>
            <Input id="subject-name" {...register('name')} placeholder="e.g., Mathematics, English" disabled={isSubmitting} />
            {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
          </div>

          <div>
            <Label htmlFor="subject-code">Subject Code (Optional)</Label>
            <Input id="subject-code" {...register('code')} placeholder="e.g., MATH101, ENG202" disabled={isSubmitting} />
            {errors.code && <p className="text-sm text-destructive mt-1">{errors.code.message}</p>}
          </div>
          
          <div>
            <Label htmlFor="subject-description">Description (Optional)</Label>
            <Textarea id="subject-description" {...register('description')} placeholder="Briefly describe the subject" disabled={isSubmitting} />
            {errors.description && <p className="text-sm text-destructive mt-1">{errors.description.message}</p>}
          </div>

        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Adding Subject...' : 'Add Subject'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}