// app/(platform)/school-admin/settings/page.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { useForm, SubmitHandler, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { School as PrismaSchool, TermPeriod } from '@prisma/client';

// Import Shadcn/ui components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Save, Info } from "lucide-react";

// Zod schema for the form (should align with API's PATCH schema - all editable fields are optional)
const editSchoolSettingsFormSchema = z.object({
  currentAcademicYear: z.string()
    .regex(/^\d{4}-\d{4}$/, "Academic year must be in YYYY-YYYY format (e.g., 2024-2025).")
    .refine(year => {
        if(!year || year === '') return true; // Allow empty or optional
        const years = year.split('-');
        return parseInt(years[0]) + 1 === parseInt(years[1]);
    }, "Academic year range must be consecutive (e.g., 2024-2025).")
    .optional().or(z.literal('')).nullable(),
  currentTerm: z.nativeEnum(TermPeriod).optional().nullable(),
  
  phoneNumber: z.string().optional().or(z.literal('')).nullable(),
  website: z.string().url("Invalid URL for website").optional().or(z.literal('')).nullable(),
  address: z.string().optional().or(z.literal('')).nullable(),
  city: z.string().optional().or(z.literal('')).nullable(),
  stateOrRegion: z.string().optional().or(z.literal('')).nullable(),
  country: z.string().optional().or(z.literal('')).nullable(),
  postalCode: z.string().optional().or(z.literal('')).nullable(),
  logoUrl: z.string().url("Logo URL must be a valid URL if provided").optional().or(z.literal('')).nullable(),
});

type EditSchoolSettingsFormValues = z.infer<typeof editSchoolSettingsFormSchema>;

// Type for the full school data fetched (includes read-only fields)
type SchoolSettingsData = PrismaSchool;

export default function SchoolSettingsPage() {
  const router = useRouter();
  const [initialLoading, setInitialLoading] = useState(true);
  const [readOnlyData, setReadOnlyData] = useState<Partial<SchoolSettingsData>>({}); // For displaying non-editable fields

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting, dirtyFields },
  } = useForm<EditSchoolSettingsFormValues>({
    resolver: zodResolver(editSchoolSettingsFormSchema),
    defaultValues: { // Initialize all editable fields
        currentAcademicYear: '',
        currentTerm: null,
        phoneNumber: '',
        website: '',
        address: '',
        city: '',
        stateOrRegion: '',
        country: '',
        postalCode: '',
        logoUrl: '',
    },
  });

  // Fetch school settings for pre-filling the form
  useEffect(() => {
    const fetchSchoolSettings = async () => {
      setInitialLoading(true);
      try {
        const response = await fetch('/api/school-admin/settings');
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || `Failed to fetch school settings: ${response.statusText}`);
        }
        const settingsData: SchoolSettingsData = await response.json();
        
        // Set values for editable fields
        reset({
            currentAcademicYear: settingsData.currentAcademicYear || '',
            currentTerm: settingsData.currentTerm || null,
            phoneNumber: settingsData.phoneNumber || '',
            website: settingsData.website || '',
            address: settingsData.address || '',
            city: settingsData.city || '',
            stateOrRegion: settingsData.stateOrRegion || '',
            country: settingsData.country || '',
            postalCode: settingsData.postalCode || '',
            logoUrl: settingsData.logoUrl || '',
        });
        // Store read-only data for display
        setReadOnlyData({
            name: settingsData.name,
            schoolEmail: settingsData.schoolEmail,
            currency: settingsData.currency,
            timezone: settingsData.timezone,
        });
      } catch (err: any) {
        toast.error("Failed to load school settings", { description: err.message });
        console.error("Fetch school settings error:", err);
      } finally {
        setInitialLoading(false);
      }
    };
    fetchSchoolSettings();
  }, [reset]);

  const onSubmit: SubmitHandler<EditSchoolSettingsFormValues> = async (formData) => {
    const changedData: Partial<EditSchoolSettingsFormValues> = {};
    let hasChanges = false;

    for (const key in dirtyFields) {
        if (dirtyFields[key as keyof EditSchoolSettingsFormValues]) {
            hasChanges = true;
            const typedKey = key as keyof EditSchoolSettingsFormValues;
            if (formData[typedKey] === '') { // User cleared an optional text field
                changedData[typedKey] = null; 
            } else if (typedKey === 'currentTerm' && formData.currentTerm === null) { // User selected "None" for term
                 changedData[typedKey] = null;
            }
            else {
                (changedData as any)[typedKey] = formData[typedKey];
            }
        }
    }

    if (!hasChanges) {
        toast.info("No changes were made to submit.");
        return;
    }
    
    // console.log("Submitting Updated School Settings to API:", JSON.stringify(changedData, null, 2));

    try {
      const response = await fetch(`/api/school-admin/settings`, { // Using root settings API
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
        toast.error("Settings update failed", { description: errorMessage });
      } else {
        toast.success("School settings updated successfully!");
        reset(result); // Update form with saved data to clear dirty state & reflect changes
        setReadOnlyData(prev => ({...prev, name: result.name, schoolEmail: result.schoolEmail})); // Update read-only if they were part of result
        router.refresh(); // Refresh any server components relying on this data
      }
    } catch (err: any) {
      console.error("Update school settings error (client):", err);
      toast.error('An unexpected error occurred', { description: err.message || "Please try again."});
    }
  };
  
  const renderFormSkeletons = () => (
    <div className="space-y-4">
        <div className="space-y-2"><Skeleton className="h-4 w-1/4" /><Skeleton className="h-10 w-full" /></div>
        <div className="space-y-2"><Skeleton className="h-4 w-1/4" /><Skeleton className="h-10 w-full" /></div>
        <div className="space-y-2"><Skeleton className="h-4 w-1/4" /><Skeleton className="h-10 w-full" /></div>
        <div className="space-y-2"><Skeleton className="h-4 w-1/4" /><Skeleton className="h-20 w-full" /></div>
        <Skeleton className="h-10 w-32 mt-4" />
    </div>
  );


  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>School Settings</CardTitle>
        <CardDescription>
          Manage general settings for your school: <strong>{readOnlyData.name || <Skeleton className="h-4 w-1/3 inline-block"/>}</strong>.
          <br/>Some settings might be managed by the Super Administrator.
        </CardDescription>
      </CardHeader>
      {initialLoading ? (
        <CardContent>{renderFormSkeletons()}</CardContent>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-6">
            {/* Read-only fields for context */}
            <div className="space-y-2 p-4 border rounded-md bg-muted/50">
                <h4 className="font-medium text-sm text-muted-foreground">School Identification (Read-only)</h4>
                <p className="text-sm"><strong>Official School Name:</strong> {readOnlyData.name || 'N/A'}</p>
                <p className="text-sm"><strong>Official School Email:</strong> {readOnlyData.schoolEmail || 'N/A'}</p>
            </div>

            <div className="space-y-1">
              <Label htmlFor="currentAcademicYear">Current Academic Year</Label>
              <Input id="currentAcademicYear" {...register('currentAcademicYear')} placeholder="e.g., 2024-2025" disabled={isSubmitting} />
              {errors.currentAcademicYear && <p className="text-sm text-destructive mt-1">{errors.currentAcademicYear.message}</p>}
              <p className="text-xs text-muted-foreground">Format: YYYY-YYYY (e.g., 2024-2025)</p>
            </div>

            <div className="space-y-1">
              <Label htmlFor="currentTerm">Current Term</Label>
              <Controller
                  name="currentTerm"
                  control={control}
                  render={({ field }) => (
                      <Select 
                          onValueChange={(value) => field.onChange(value === "none" ? null : value)} 
                          value={field.value || "none"} // Handle null for placeholder
                          disabled={isSubmitting}
                      >
                          <SelectTrigger>
                              <SelectValue placeholder="Select current term" />
                          </SelectTrigger>
                          <SelectContent>
                              <SelectItem value="none">-- Not Set --</SelectItem>
                              {Object.values(TermPeriod).map((term) => (
                                  <SelectItem key={term} value={term}>{term.replace("_", " ")}</SelectItem>
                              ))}
                          </SelectContent>
                      </Select>
                  )}
              />
              {errors.currentTerm && <p className="text-sm text-destructive mt-1">{errors.currentTerm.message}</p>}
            </div>

            <h3 className="text-lg font-medium border-b pb-2 pt-4">Contact & Location Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <Label htmlFor="phoneNumber">School Phone Number</Label>
                    <Input id="phoneNumber" {...register('phoneNumber')} disabled={isSubmitting} />
                    {errors.phoneNumber && <p className="text-sm text-destructive mt-1">{errors.phoneNumber.message}</p>}
                </div>
                <div>
                    <Label htmlFor="website">School Website</Label>
                    <Input id="website" type="url" {...register('website')} placeholder="https://www.yourschool.com" disabled={isSubmitting} />
                    {errors.website && <p className="text-sm text-destructive mt-1">{errors.website.message}</p>}
                </div>
            </div>
            <div>
                <Label htmlFor="address">School Address</Label>
                <Textarea id="address" {...register('address')} disabled={isSubmitting} />
                {errors.address && <p className="text-sm text-destructive mt-1">{errors.address.message}</p>}
            </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><Label htmlFor="city">City</Label><Input id="city" {...register('city')} disabled={isSubmitting} /></div>
                <div><Label htmlFor="stateOrRegion">State/Region</Label><Input id="stateOrRegion" {...register('stateOrRegion')} disabled={isSubmitting} /></div>
            </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><Label htmlFor="country">Country</Label><Input id="country" {...register('country')} disabled={isSubmitting} /></div>
                <div><Label htmlFor="postalCode">Postal Code</Label><Input id="postalCode" {...register('postalCode')} disabled={isSubmitting} /></div>
            </div>
            <div>
                <Label htmlFor="logoUrl">School Logo URL</Label>
                <Input id="logoUrl" type="url" {...register('logoUrl')} placeholder="https://example.com/logo.png" disabled={isSubmitting} />
                {errors.logoUrl && <p className="text-sm text-destructive mt-1">{errors.logoUrl.message}</p>}
            </div>
            
            <div className="space-y-2 p-4 border rounded-md bg-muted/50 mt-6">
                <h4 className="font-medium text-sm text-muted-foreground flex items-center"><Info className="h-4 w-4 mr-2"/>Read-only System Settings</h4>
                <p className="text-sm"><strong>Designated Currency:</strong> {readOnlyData.currency || 'N/A'}</p>
                <p className="text-sm"><strong>System Timezone:</strong> {readOnlyData.timezone || 'N/A'}</p>
            </div>

          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isSubmitting || initialLoading}>
              <Save className="mr-2 h-4 w-4" />
              {isSubmitting ? 'Saving Settings...' : 'Save Settings'}
            </Button>
          </CardFooter>
        </form>
      )}
    </Card>
  );
}