// app/(platform)/super-admin/schools/[schoolId]/edit/page.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { z } from 'zod';
import { useForm, SubmitHandler, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { School as PrismaSchool, TermPeriod } from '@prisma/client';

// Import Shadcn/ui components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ArrowLeft, CheckCircle, XCircle } from "lucide-react";

const editSchoolSchema = z.object({
  name: z.string().min(3, "School name must be at least 3 characters").optional(),
  schoolEmail: z.string().email("Invalid email address").optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  stateOrRegion: z.string().optional(),
  country: z.string().optional(),
  phoneNumber: z.string().optional(),
  website: z.string().url("Invalid URL").optional().or(z.literal('')),
  currentAcademicYear: z.string().optional(),
  currentTerm: z.nativeEnum(TermPeriod).optional().nullable(), // Allow null to represent "no selection" more explicitly
  currency: z.string().min(3).max(3).optional(),
  timezone: z.string().optional(),
});

type EditSchoolFormValues = z.infer<typeof editSchoolSchema>;
type School = PrismaSchool;

export default function EditSchoolPage() {
  const router = useRouter();
  const params = useParams();
  const schoolId = params.schoolId as string;

  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<EditSchoolFormValues>({
    resolver: zodResolver(editSchoolSchema),
    defaultValues: { // Initialize optional fields to avoid uncontrolled component warnings if needed
        name: '',
        schoolEmail: '',
        address: '',
        city: '',
        stateOrRegion: '',
        country: '',
        phoneNumber: '',
        website: '',
        currentAcademicYear: '',
        currentTerm: null, // Initialize as null
        currency: '',
        timezone: '',
    }
  });

  useEffect(() => {
    if (!schoolId) return;

    const fetchSchoolData = async () => {
      setIsLoading(true);
      setFetchError(null);
      try {
        const response = await fetch(`/api/schools/${schoolId}`);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || `Failed to fetch school data: ${response.statusText}`);
        }
        const schoolData: School = await response.json();
        reset({
            name: schoolData.name || '',
            schoolEmail: schoolData.schoolEmail || '',
            address: schoolData.address || '',
            city: schoolData.city || '',
            stateOrRegion: schoolData.stateOrRegion || '',
            country: schoolData.country || '',
            phoneNumber: schoolData.phoneNumber || '',
            website: schoolData.website || '',
            currentAcademicYear: schoolData.currentAcademicYear || '',
            currentTerm: schoolData.currentTerm || null, // Set to null if not present
            currency: schoolData.currency || '',
            timezone: schoolData.timezone || '',
        });
      } catch (err: any) {
        setFetchError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSchoolData();
  }, [schoolId, reset]);

  const onSubmit: SubmitHandler<EditSchoolFormValues> = async (data) => {
    setSubmitError(null);
    setSubmitSuccess(null);

    const cleanedData: Partial<EditSchoolFormValues> = {};
    for (const key in data) {
        const value = data[key as keyof EditSchoolFormValues];
        if (value !== '' && value !== undefined && value !== null) {
            cleanedData[key as keyof EditSchoolFormValues] = value;
        } else if (key === 'website' && value === '') { 
            cleanedData.website = '';
        } else if (value === null && editSchoolSchema.shape[key as keyof EditSchoolFormValues].isOptional()) {
             // If API expects null for clearing optional enum, send null
            cleanedData[key as keyof EditSchoolFormValues] = null;
        }
    }

    if (Object.keys(cleanedData).length === 0 && !Object.values(data).some(v => v === null || v === '')) {
        setSubmitError("No actual changes to submit."); // Avoid submitting if only empty strings were "changed" from initial empty strings
        return;
    }
    
    try {
      const response = await fetch(`/api/schools/${schoolId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleanedData),
      });
      const result = await response.json();
      if (!response.ok) {
        setSubmitError(result.message || `Error: ${response.status}`);
      } else {
        setSubmitSuccess('School details updated successfully!');
        setTimeout(() => {
          router.push(`/super-admin/schools/${schoolId}`);
        }, 1500);
      }
    } catch (err) {
      setSubmitError('An unexpected error occurred.');
    }
  };

  if (isLoading) return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader><CardTitle>Edit School Details</CardTitle></CardHeader>
      <CardContent><p>Loading school data, please wait...</p></CardContent>
    </Card>
  );
  if (fetchError) return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader><CardTitle>Error</CardTitle></CardHeader>
      <CardContent>
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>Failed to Load School Data</AlertTitle>
          <AlertDescription>{fetchError}</AlertDescription>
        </Alert>
        <Button variant="outline" asChild className="mt-4">
            <Link href={`/super-admin/schools/${schoolId}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to School Details
            </Link>
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Edit School Details</CardTitle>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/super-admin/schools/${schoolId}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to School Details
            </Link>
          </Button>
        </div>
        <CardDescription>Update the information for the school below. Only filled fields will be updated.</CardDescription>
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

          {/* Form Fields */}
          <div>
            <Label htmlFor="name">School Name</Label>
            <Input id="name" {...register('name')} disabled={isSubmitting} />
            {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <Label htmlFor="schoolEmail">School Email</Label>
            <Input id="schoolEmail" type="email" {...register('schoolEmail')} disabled={isSubmitting} />
            {errors.schoolEmail && <p className="text-sm text-destructive mt-1">{errors.schoolEmail.message}</p>}
          </div>
          <div>
            <Label htmlFor="address">Address</Label>
            <Textarea id="address" {...register('address')} disabled={isSubmitting} />
            {errors.address && <p className="text-sm text-destructive mt-1">{errors.address.message}</p>}
          </div>
          <div>
            <Label htmlFor="city">City</Label>
            <Input id="city" {...register('city')} disabled={isSubmitting} />
            {errors.city && <p className="text-sm text-destructive mt-1">{errors.city.message}</p>}
          </div>
          <div>
            <Label htmlFor="stateOrRegion">State/Region</Label>
            <Input id="stateOrRegion" {...register('stateOrRegion')} disabled={isSubmitting} />
            {errors.stateOrRegion && <p className="text-sm text-destructive mt-1">{errors.stateOrRegion.message}</p>}
          </div>
          <div>
            <Label htmlFor="country">Country</Label>
            <Input id="country" {...register('country')} disabled={isSubmitting} />
            {errors.country && <p className="text-sm text-destructive mt-1">{errors.country.message}</p>}
          </div>
          <div>
            <Label htmlFor="phoneNumber">Phone Number</Label>
            <Input id="phoneNumber" {...register('phoneNumber')} disabled={isSubmitting} />
            {errors.phoneNumber && <p className="text-sm text-destructive mt-1">{errors.phoneNumber.message}</p>}
          </div>
          <div>
            <Label htmlFor="website">Website</Label>
            <Input id="website" {...register('website')} disabled={isSubmitting} />
            {errors.website && <p className="text-sm text-destructive mt-1">{errors.website.message}</p>}
          </div>
          <div>
            <Label htmlFor="currentAcademicYear">Current Academic Year (e.g., 2024-2025)</Label>
            <Input id="currentAcademicYear" {...register('currentAcademicYear')} disabled={isSubmitting} />
            {errors.currentAcademicYear && <p className="text-sm text-destructive mt-1">{errors.currentAcademicYear.message}</p>}
          </div>
          <div>
            <Label htmlFor="currentTerm">Current Term</Label>
            <Controller
                name="currentTerm"
                control={control}
                render={({ field }) => (
                    <Select
                        onValueChange={(value) => field.onChange(value === "" ? null : value as TermPeriod)} // Handle "No Selection"
                        value={field.value || ""} // Pass empty string to Select if field.value is null/undefined to show placeholder
                        disabled={isSubmitting}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Select current term" />
                        </SelectTrigger>
                        <SelectContent>
                            {/* No <SelectItem value=""> needed; placeholder handles "no selection" */}
                            {Object.values(TermPeriod).map((term) => (
                                <SelectItem key={term} value={term}>{term.replace("_", " ")}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}
            />
            {errors.currentTerm && <p className="text-sm text-destructive mt-1">{errors.currentTerm.message}</p>}
          </div>
          <div>
            <Label htmlFor="currency">Currency (e.g., GHS)</Label>
            <Input id="currency" {...register('currency')} disabled={isSubmitting} />
            {errors.currency && <p className="text-sm text-destructive mt-1">{errors.currency.message}</p>}
          </div>
          <div>
            <Label htmlFor="timezone">Timezone (e.g., Africa/Accra)</Label>
            <Input id="timezone" {...register('timezone')} disabled={isSubmitting} />
            {errors.timezone && <p className="text-sm text-destructive mt-1">{errors.timezone.message}</p>}
          </div>

        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={isSubmitting || isLoading}>
            {isSubmitting ? 'Saving Changes...' : 'Save Changes'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}