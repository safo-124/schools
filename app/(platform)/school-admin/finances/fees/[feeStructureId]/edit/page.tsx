// app/(platform)/school-admin/finances/fees/[feeStructureId]/edit/page.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { z } from 'zod';
import { useForm, SubmitHandler, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FeeStructure as PrismaFeeStructure, TermPeriod } from '@prisma/client';

// Shadcn/ui components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ArrowLeft, Save } from "lucide-react";

// Zod schema for editing a fee structure (all fields optional for PATCH)
const editFeeStructureFormSchema = z.object({
  name: z.string().min(3, "Fee structure name must be at least 3 characters.").optional(),
  description: z.string().optional().or(z.literal('')).nullable(),
  amount: z.preprocess(
    // Convert empty string or non-numeric to undefined so optional validation works, else parse to float
    (val) => (val === "" || val === null || val === undefined || isNaN(parseFloat(String(val)))) ? undefined : parseFloat(String(val)), 
    z.number({invalid_type_error: "Amount must be a number."}).positive("Amount must be positive.").optional()
  ),
  academicYear: z.string()
    .regex(/^\d{4}-\d{4}$/, "Academic year format: YYYY-YYYY (e.g., 2024-2025).")
    .refine(year => {
        if(!year || year === '') return true; // Allow empty for optional
        const years = year.split('-');
        return parseInt(years[0]) + 1 === parseInt(years[1]);
    }, "Academic years must be consecutive.")
    .optional(),
  term: z.nativeEnum(TermPeriod).optional().nullable(),
  frequency: z.string().min(1, "Frequency is required.").optional(),
});

type EditFeeStructureFormValues = z.infer<typeof editFeeStructureFormSchema>;
type FeeStructureDataToEdit = PrismaFeeStructure;

// Predefined frequency options
const frequencyOptions = ["Termly", "Annually", "Monthly", "One-time", "Session-based"];

export default function EditFeeStructurePage() {
  const router = useRouter();
  const params = useParams();
  const feeStructureId = params.feeStructureId as string;

  const [initialLoading, setInitialLoading] = useState(true);
  // Fetch error will be handled by toast

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting, dirtyFields },
  } = useForm<EditFeeStructureFormValues>({
    resolver: zodResolver(editFeeStructureFormSchema),
    defaultValues: { // Initialize to prevent uncontrolled component warnings
        name: '',
        description: '',
        amount: undefined,
        academicYear: '',
        term: null,
        frequency: '',
    },
  });

  // Fetch fee structure data for pre-filling the form
  useEffect(() => {
    if (!feeStructureId) {
      toast.error("Error: Fee Structure ID not found in URL.");
      setInitialLoading(false);
      router.push("/school-admin/finances/fees"); // Redirect if no ID
      return;
    }

    const fetchFeeStructureData = async () => {
      setInitialLoading(true);
      try {
        const response = await fetch(`/api/school-admin/finances/fee-structures/${feeStructureId}`);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || `Failed to fetch fee structure data: ${response.statusText}`);
        }
        const feeData: FeeStructureDataToEdit = await response.json();
        
        reset({
            name: feeData.name || '',
            description: feeData.description || '',
            // Prisma Decimal can be an object, ensure it's converted to number for the form
            amount: feeData.amount ? Number(feeData.amount.toString()) : undefined, 
            academicYear: feeData.academicYear || '',
            term: feeData.term || null,
            frequency: feeData.frequency || '',
        });
      } catch (err: any) {
        toast.error("Failed to load fee structure data", { description: err.message });
        console.error("Fetch fee structure data error:", err);
      } finally {
        setInitialLoading(false);
      }
    };
    fetchFeeStructureData();
  }, [feeStructureId, reset, router]);

  const onSubmit: SubmitHandler<EditFeeStructureFormValues> = async (formData) => {
    const changedData: Partial<EditFeeStructureFormValues> = {};
    let hasChanges = false;

    for (const key in dirtyFields) {
        if (dirtyFields[key as keyof EditFeeStructureFormValues]) {
            hasChanges = true;
            const typedKey = key as keyof EditFeeStructureFormValues;
            const value = formData[typedKey];

            if (value === '') { // User cleared an optional text field
                if (typedKey === 'description' || typedKey === 'code' /* if code existed */) { // Fields that can be null
                    (changedData as any)[typedKey] = null; 
                } else {
                    (changedData as any)[typedKey] = value; // name, academicYear, frequency shouldn't be empty string if required
                }
            } else if (typedKey === 'term' && value === null) { // User selected "None" for term
                 (changedData as any)[typedKey] = null;
            } else if (typedKey === 'amount' && value !== undefined) {
                (changedData as any)[typedKey] = Number(value); // Ensure amount is number
            }
            else {
                (changedData as any)[typedKey] = value;
            }
        }
    }

    if (!hasChanges) {
        toast.info("No changes were made to submit.");
        return;
    }
    
    // console.log("Submitting Updated Fee Structure Data to API:", JSON.stringify(changedData, null, 2));

    try {
      const response = await fetch(`/api/school-admin/finances/fee-structures/${feeStructureId}`, {
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
        toast.error("Fee Structure update failed", { description: errorMessage });
      } else {
        toast.success(`Fee Structure "${result.name}" updated successfully!`);
        reset(result); // Update form with saved data
        setTimeout(() => {
          router.push('/school-admin/finances/fees'); 
        }, 1500);
      }
    } catch (err: any) {
      console.error("Update fee structure error (client):", err);
      toast.error('An unexpected error occurred', { description: err.message || "Please try again."});
    }
  };
  
  const renderFormSkeletons = () => (
    <div className="space-y-4 pt-6">
        <div className="space-y-2"><Skeleton className="h-4 w-1/4" /><Skeleton className="h-10 w-full" /></div>
        <div className="space-y-2"><Skeleton className="h-4 w-1/4" /><Skeleton className="h-10 w-full" /></div>
        <div className="space-y-2"><Skeleton className="h-4 w-1/4" /><Skeleton className="h-10 w-full" /></div>
        <div className="space-y-2"><Skeleton className="h-4 w-1/4" /><Skeleton className="h-10 w-full" /></div>
        <div className="space-y-2"><Skeleton className="h-4 w-1/4" /><Skeleton className="h-20 w-full" /></div>
        <Skeleton className="h-10 w-32 mt-4" />
    </div>
  );

  return (
    <Card className="w-full max-w-lg mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Edit Fee Structure</CardTitle>
          <Button variant="outline" size="sm" asChild>
            <Link href="/school-admin/finances/fees">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Fee Structures
            </Link>
          </Button>
        </div>
        <CardDescription>
          Update the details for this fee structure.
        </CardDescription>
      </CardHeader>
      {initialLoading ? (
          <CardContent>{renderFormSkeletons()}</CardContent>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4 pt-6">
            {/* Toasts handle submit success/error */}

            <div>
              <Label htmlFor="edit-fee-name">Fee Name <span className="text-destructive">*</span></Label>
              <Input id="edit-fee-name" {...register('name')} placeholder="e.g., Term 1 Tuition - Grade 1" disabled={isSubmitting} />
              {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
            </div>

            <div>
              <Label htmlFor="edit-fee-amount">Amount (GHS) <span className="text-destructive">*</span></Label>
              <Input id="edit-fee-amount" type="number" step="0.01" {...register('amount')} placeholder="e.g., 500.00" disabled={isSubmitting} />
              {errors.amount && <p className="text-sm text-destructive mt-1">{errors.amount.message}</p>}
            </div>

            <div>
              <Label htmlFor="edit-fee-academicYear">Academic Year <span className="text-destructive">*</span></Label>
              <Input id="edit-fee-academicYear" {...register('academicYear')} placeholder="e.g., 2024-2025" disabled={isSubmitting} />
              {errors.academicYear && <p className="text-sm text-destructive mt-1">{errors.academicYear.message}</p>}
            </div>

            <div>
              <Label htmlFor="edit-fee-term">Applicable Term (Optional)</Label>
              <Controller
                  name="term"
                  control={control}
                  render={({ field }) => (
                      <Select 
                          onValueChange={(value) => field.onChange(value === "none" ? null : value as TermPeriod)} 
                          value={field.value || "none"} // Default to "none" if null/undefined
                          disabled={isSubmitting}
                      >
                          <SelectTrigger><SelectValue placeholder="Select term if applicable" /></SelectTrigger>
                          <SelectContent>
                              <SelectItem value="none">-- Not Term Specific --</SelectItem>
                              {Object.values(TermPeriod).map(term => <SelectItem key={term} value={term}>{term.replace("_", " ")}</SelectItem>)}
                          </SelectContent>
                      </Select>
                  )}
              />
              {errors.term && <p className="text-sm text-destructive mt-1">{errors.term.message}</p>}
            </div>

            <div>
              <Label htmlFor="edit-fee-frequency">Frequency <span className="text-destructive">*</span></Label>
              <Controller 
                  name="frequency" 
                  control={control} 
                  render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value || ""} disabled={isSubmitting}>
                          <SelectTrigger><SelectValue placeholder="Select frequency" /></SelectTrigger>
                          <SelectContent>
                              {frequencyOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                          </SelectContent>
                      </Select>
                  )}
              />
              {errors.frequency && <p className="text-sm text-destructive mt-1">{errors.frequency.message}</p>}
            </div>
            
            <div>
              <Label htmlFor="edit-fee-description">Description (Optional)</Label>
              <Textarea id="edit-fee-description" {...register('description')} placeholder="Additional details about this fee" disabled={isSubmitting} />
              {errors.description && <p className="text-sm text-destructive mt-1">{errors.description.message}</p>}
            </div>

          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isSubmitting || initialLoading}>
              <Save className="mr-2 h-4 w-4" />
              {isSubmitting ? 'Saving Changes...' : 'Save Changes'}
            </Button>
          </CardFooter>
        </form>
      )}
    </Card>
  );
}