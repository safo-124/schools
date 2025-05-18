// app/(platform)/school-admin/finances/fees/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { PlusCircle, Edit, Trash2, DollarSign, Eye } from "lucide-react";

// Import the custom DeleteFeeStructureButton component
import { DeleteFeeStructureButton } from '@/components/school-admin/finances/DeleteFeeStructureButton'; // Adjust path if needed

type FeeStructure = PrismaFeeStructure;

// Zod schema for the Add Fee Structure form
const feeStructureFormSchema = z.object({
  name: z.string().min(3, "Fee structure name is required (e.g., Term 1 Tuition - Grade 1)."),
  description: z.string().optional().or(z.literal('')).nullable(),
  amount: z.preprocess(
    // Convert empty string or non-numeric to undefined so optional validation works, else parse to float
    (val) => (val === "" || val === null || val === undefined || isNaN(parseFloat(String(val)))) ? undefined : parseFloat(String(val)), 
    z.number({required_error: "Amount is required.", invalid_type_error: "Amount must be a number."}).positive("Amount must be positive.")
  ),
  academicYear: z.string()
    .regex(/^\d{4}-\d{4}$/, "Academic year format: YYYY-YYYY (e.g., 2024-2025).")
    .refine(year => {
        if(!year || year === '') return false; // Academic year is required
        const years = year.split('-');
        return parseInt(years[0]) + 1 === parseInt(years[1]);
    }, "Academic years must be consecutive and is required."),
  term: z.nativeEnum(TermPeriod).optional().nullable(),
  frequency: z.string().min(1, "Frequency is required (e.g., Termly, Annually)."),
});

type FeeStructureFormValues = z.infer<typeof feeStructureFormSchema>;

// Predefined frequency options
const frequencyOptions = ["Termly", "Annually", "Monthly", "One-time", "Session-based", "Per Subject"];

export default function ManageFeeStructuresPage() {
  const router = useRouter();
  const [feeStructures, setFeeStructures] = useState<FeeStructure[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [fetchAttempted, setFetchAttempted] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting: isFormSubmitting },
  } = useForm<FeeStructureFormValues>({
    resolver: zodResolver(feeStructureFormSchema),
    defaultValues: {
      name: '',
      description: '',
      amount: undefined, 
      academicYear: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
      term: null, // Explicitly null for controlled Select
      frequency: '',
    }
  });

  const fetchFeeStructures = useCallback(async (isInitialLoad = false) => {
    if(isInitialLoad) setIsLoading(true);
    setFetchAttempted(false); // Reset before fetch
    try {
      const response = await fetch('/api/school-admin/finances/fee-structures');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch fee structures.');
      }
      const data = await response.json();
      setFeeStructures(data);
    } catch (error: any) {
      toast.error("Failed to load fee structures", { description: error.message });
      setFeeStructures([]); // Clear data on error
    } finally {
      if(isInitialLoad) setIsLoading(false);
      setFetchAttempted(true); // Mark fetch as attempted
    }
  }, []);

  useEffect(() => {
    fetchFeeStructures(true);
  }, [fetchFeeStructures]);

  const handleAddSubmit: SubmitHandler<FeeStructureFormValues> = async (formData) => {
    const submittingToastId = toast.loading("Adding fee structure...");
    try {
      const dataToSend = {
        ...formData,
        amount: Number(formData.amount), 
        term: formData.term === "none" || formData.term === '' ? null : formData.term,
        description: formData.description === '' ? null : formData.description,
      };
      const response = await fetch('/api/school-admin/finances/fee-structures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSend),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || "Failed to create fee structure.");
      }
      toast.success("Fee structure created successfully!", { id: submittingToastId });
      reset();
      setIsAddModalOpen(false);
      fetchFeeStructures(false); 
      router.refresh(); 
    } catch (error: any) {
      toast.error("Failed to create fee structure", { id: submittingToastId, description: error.message });
    }
  };
  
  const formatAmount = (amount: any) => {
    if (amount === null || amount === undefined) return 'N/A';
    return new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(Number(amount));
  };

  const handleActionSuccess = () => {
    toast.info("Refreshing fee structures list...");
    fetchFeeStructures(false);
  };

  const renderSkeletons = () => Array.from({ length: 3 }).map((_, index) => (
    <TableRow key={`skeleton-fee-${index}`}>
        <TableCell><Skeleton className="h-6 w-3/4" /></TableCell>
        <TableCell><Skeleton className="h-6 w-20" /></TableCell>
        <TableCell className="hidden sm:table-cell"><Skeleton className="h-6 w-24" /></TableCell>
        <TableCell className="hidden md:table-cell"><Skeleton className="h-6 w-16" /></TableCell>
        <TableCell className="hidden lg:table-cell"><Skeleton className="h-6 w-20" /></TableCell>
        <TableCell className="text-right"><Skeleton className="h-8 w-20" /></TableCell>
    </TableRow>
  ));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Manage Fee Structures</CardTitle>
          <CardDescription>Define and manage different types of fees for your school.</CardDescription>
        </div>
        <Dialog open={isAddModalOpen} onOpenChange={(open) => {
            if (!open) reset(); // Reset form when dialog closes
            setIsAddModalOpen(open);
        }}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" /> Add Fee Structure
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Add New Fee Structure</DialogTitle>
              <DialogDescription>Define a new type of fee.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit(handleAddSubmit)} className="space-y-4 py-4">
              <div>
                <Label htmlFor="add-fee-name">Fee Name <span className="text-destructive">*</span></Label>
                <Input id="add-fee-name" {...register('name')} placeholder="e.g., Term 1 Tuition - Grade 1" disabled={isFormSubmitting} />
                {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
              </div>
              <div>
                <Label htmlFor="add-fee-amount">Amount (GHS) <span className="text-destructive">*</span></Label>
                <Input id="add-fee-amount" type="number" step="0.01" {...register('amount')} placeholder="e.g., 500.00" disabled={isFormSubmitting} />
                {errors.amount && <p className="text-sm text-destructive mt-1">{errors.amount.message}</p>}
              </div>
              <div>
                <Label htmlFor="add-fee-academicYear">Academic Year <span className="text-destructive">*</span></Label>
                <Input id="add-fee-academicYear" {...register('academicYear')} placeholder="e.g., 2024-2025" disabled={isFormSubmitting} />
                {errors.academicYear && <p className="text-sm text-destructive mt-1">{errors.academicYear.message}</p>}
              </div>
              <div>
                <Label htmlFor="add-fee-term">Applicable Term (Optional)</Label>
                <Controller name="term" control={control} render={({ field }) => (
                  <Select onValueChange={(value) => field.onChange(value === "none" ? null : value as TermPeriod)} value={field.value || "none"} disabled={isFormSubmitting}>
                    <SelectTrigger><SelectValue placeholder="Select term if applicable" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="none">-- Not Term Specific --</SelectItem>
                        {Object.values(TermPeriod).map(term => <SelectItem key={term} value={term}>{term.replace("_", " ")}</SelectItem>)}
                    </SelectContent>
                  </Select>)}
                />
                {errors.term && <p className="text-sm text-destructive mt-1">{errors.term.message}</p>}
              </div>
              <div>
                <Label htmlFor="add-fee-frequency">Frequency <span className="text-destructive">*</span></Label>
                <Controller name="frequency" control={control} render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value || ""} disabled={isFormSubmitting}>
                    <SelectTrigger><SelectValue placeholder="Select frequency" /></SelectTrigger>
                    <SelectContent>
                        {frequencyOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                    </SelectContent>
                  </Select>)}
                />
                {errors.frequency && <p className="text-sm text-destructive mt-1">{errors.frequency.message}</p>}
              </div>
              <div>
                <Label htmlFor="add-fee-description">Description (Optional)</Label>
                <Textarea id="add-fee-description" {...register('description')} placeholder="Additional details about this fee" disabled={isFormSubmitting} />
                {errors.description && <p className="text-sm text-destructive mt-1">{errors.description.message}</p>}
              </div>
              <DialogFooter className="pt-4">
                <DialogClose asChild><Button type="button" variant="outline" disabled={isFormSubmitting}>Cancel</Button></DialogClose>
                <Button type="submit" disabled={isFormSubmitting}>
                  {isFormSubmitting ? 'Adding...' : 'Add Fee Structure'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {(isLoading && !fetchAttempted) ? ( // Show skeletons only on the very first load
             <Table>
              <TableCaption>Loading fee structure data...</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead><TableHead>Amount</TableHead>
                  <TableHead className="hidden sm:table-cell">Academic Year</TableHead><TableHead className="hidden md:table-cell">Term</TableHead>
                  <TableHead className="hidden lg:table-cell">Frequency</TableHead><TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>{renderSkeletons()}</TableBody>
            </Table>
        ) : !isLoading && feeStructures.length === 0 && fetchAttempted ? ( // Show if fetch is done, attempted, and still no data
          <div className="text-center py-10"><DollarSign className="mx-auto h-12 w-12 text-muted-foreground" /><h3 className="mt-2 text-sm font-medium">No fee structures found.</h3><p className="mt-1 text-sm text-muted-foreground">Get started by defining a new fee structure.</p></div>
        ) : ( // Display table if data is present (or if loading for a re-fetch but old data is still there)
          <Table>
            <TableCaption>A list of defined fee structures for your school.</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead><TableHead>Amount</TableHead>
                <TableHead className="hidden sm:table-cell">Academic Year</TableHead><TableHead className="hidden md:table-cell">Term</TableHead>
                <TableHead className="hidden lg:table-cell">Frequency</TableHead><TableHead className="text-right w-[120px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {feeStructures.map((fee) => (
                <TableRow key={fee.id}>
                  <TableCell className="font-medium">{fee.name}</TableCell>
                  <TableCell>{formatAmount(fee.amount)}</TableCell>
                  <TableCell className="hidden sm:table-cell">{fee.academicYear}</TableCell>
                  <TableCell className="hidden md:table-cell">{fee.term ? fee.term.replace("_", " ") : 'N/A'}</TableCell>
                  <TableCell className="hidden lg:table-cell">{fee.frequency}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="icon" className="mr-1" asChild title="Edit Fee Structure">
                      <Link href={`/school-admin/finances/fees/${fee.id}/edit`}>
                        <Edit className="h-4 w-4" />
                      </Link>
                    </Button>
                    <DeleteFeeStructureButton
                        feeStructureId={fee.id}
                        feeStructureName={fee.name}
                        onDeleteSuccess={handleActionSuccess}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <CardFooter>
        <div className="text-xs text-muted-foreground">Total fee structures: <strong>{feeStructures.length}</strong></div>
      </CardFooter>
    </Card>
  );
}