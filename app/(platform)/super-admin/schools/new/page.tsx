// app/(platform)/super-admin/schools/new/page.tsx
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
import { Textarea } from '@/components/ui/textarea'; // For address or longer fields
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // For success/error messages
import { ArrowLeft } from "lucide-react";

// Define the same Zod schema as used in your API route for consistency
// This ensures client-side validation matches server-side expectations
const createSchoolSchema = z.object({
  name: z.string().min(3, "School name must be at least 3 characters"),
  schoolEmail: z.string().email("Invalid email address"),
  address: z.string().optional(),
  city: z.string().optional(),
  stateOrRegion: z.string().optional(),
  country: z.string().optional(),
  phoneNumber: z.string().optional(),
  // Add other optional fields you want on the form, matching your API's Zod schema
});

type CreateSchoolFormValues = z.infer<typeof createSchoolSchema>;

export default function CreateSchoolPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateSchoolFormValues>({
    resolver: zodResolver(createSchoolSchema),
  });

  const onSubmit: SubmitHandler<CreateSchoolFormValues> = async (data) => {
    setIsLoading(true);
    setFormError(null);
    setFormSuccess(null);

    try {
      const response = await fetch('/api/schools', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        // Handle errors from the API (e.g., validation, duplicate email)
        setFormError(result.message || `Error: ${response.status} - ${response.statusText}`);
        if (result.errors) {
          // If Zod errors are returned from API, you could map them to fields
          // For now, just showing the main message
          console.error("API Validation Errors:", result.errors);
        }
      } else {
        setFormSuccess(`School "${result.name}" created successfully!`);
        reset(); // Reset form fields
        // Optionally redirect after a short delay or keep them on the page
        setTimeout(() => {
          router.push('/super-admin/schools'); // Redirect to the schools list
        }, 2000);
      }
    } catch (err) {
      console.error("Create school error:", err);
      setFormError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Create New School</CardTitle>
          <Button variant="outline" size="sm" asChild>
            <Link href="/super-admin/schools">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Schools List
            </Link>
          </Button>
        </div>
        <CardDescription>Fill in the details below to register a new school.</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          {formError && (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}
          {formSuccess && (
            <Alert variant="default" className="bg-green-100 border-green-400 text-green-700 dark:bg-green-900 dark:border-green-700 dark:text-green-300">
              <AlertTitle>Success!</AlertTitle>
              <AlertDescription>{formSuccess}</AlertDescription>
            </Alert>
          )}

          <div>
            <Label htmlFor="name">School Name</Label>
            <Input id="name" {...register('name')} disabled={isLoading} />
            {errors.name && <p className="text-sm text-red-600 mt-1">{errors.name.message}</p>}
          </div>

          <div>
            <Label htmlFor="schoolEmail">School Email</Label>
            <Input id="schoolEmail" type="email" {...register('schoolEmail')} disabled={isLoading} />
            {errors.schoolEmail && <p className="text-sm text-red-600 mt-1">{errors.schoolEmail.message}</p>}
          </div>

          <div>
            <Label htmlFor="address">Address (Optional)</Label>
            <Textarea id="address" {...register('address')} disabled={isLoading} />
            {errors.address && <p className="text-sm text-red-600 mt-1">{errors.address.message}</p>}
          </div>

          <div>
            <Label htmlFor="city">City (Optional)</Label>
            <Input id="city" {...register('city')} disabled={isLoading} />
            {errors.city && <p className="text-sm text-red-600 mt-1">{errors.city.message}</p>}
          </div>
          
          <div>
            <Label htmlFor="stateOrRegion">State/Region (Optional)</Label>
            <Input id="stateOrRegion" {...register('stateOrRegion')} disabled={isLoading} />
            {errors.stateOrRegion && <p className="text-sm text-red-600 mt-1">{errors.stateOrRegion.message}</p>}
          </div>

          <div>
            <Label htmlFor="country">Country (Optional)</Label>
            <Input id="country" {...register('country')} disabled={isLoading} />
            {errors.country && <p className="text-sm text-red-600 mt-1">{errors.country.message}</p>}
          </div>

          <div>
            <Label htmlFor="phoneNumber">Phone Number (Optional)</Label>
            <Input id="phoneNumber" {...register('phoneNumber')} disabled={isLoading} />
            {errors.phoneNumber && <p className="text-sm text-red-600 mt-1">{errors.phoneNumber.message}</p>}
          </div>

          {/* Add more fields here as needed, matching your createSchoolSchema */}

        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Creating School...' : 'Create School'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}