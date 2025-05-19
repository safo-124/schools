// app/(platform)/school-admin/finances/invoices/new/page.tsx
"use client";

import React, { useState, useEffect} from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { z } from 'zod';
import { useForm, SubmitHandler, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { 
    Student as PrismaStudent, 
    FeeStructure as PrismaFeeStructure,
    TermPeriod 
} from '@prisma/client';
import { format } from "date-fns";

// Shadcn/ui components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ArrowLeft, PlusCircle, Trash2, CalendarIcon,  FilePlus2 } from "lucide-react";

// Zod schema for individual line items (client-side form)
const lineItemFormSchema = z.object({
  feeStructureId: z.string().cuid("Select a fee structure or choose custom.").optional().nullable(),
  description: z.string().min(1, "Description is required."),
  quantity: z.preprocess(
    (val) => {
        const strVal = String(val).trim();
        if (strVal === '') return 1; // Default to 1 if empty, Zod will then validate if it's positive
        const num = parseInt(strVal, 10);
        return isNaN(num) ? undefined : num; // Let Zod catch if it becomes undefined and is required
    }, 
    z.number({required_error: "Quantity is required.", invalid_type_error: "Quantity must be a number."})
     .int({message: "Quantity must be a whole number."})
     .positive("Quantity must be at least 1.").default(1)
  ),
  unitPrice: z.preprocess(
    (val) => {
        const strVal = String(val).trim();
        if (strVal === '') return 0; // Default to 0 if empty, Zod will validate if positive
        const num = parseFloat(strVal);
        return isNaN(num) ? undefined : num; // Let Zod catch
    },
    z.number({required_error: "Unit price is required.", invalid_type_error: "Unit price must be a number."})
     .positive("Unit price must be positive (or zero if allowed, currently positive).") // Consider allowing 0 if needed
  ),
});

// Zod schema for the main invoice form (client-side)
const createInvoiceFormSchema = z.object({
  studentId: z.string({required_error: "Please select a student."}).cuid("Please select a valid student."),
  academicYear: z.string()
    .min(1, "Academic year is required.")
    .regex(/^\d{4}-\d{4}$/, "Format: YYYY-YYYY (e.g., 2024-2025)")
    .refine(year => {
        if(!year) return false;
        const years = year.split('-');
        return parseInt(years[0]) + 1 === parseInt(years[1]);
    }, "Academic years must be consecutive (e.g., 2024-2025)."),
  term: z.nativeEnum(TermPeriod, { required_error: "Term is required." }),
  issueDate: z.date({ required_error: "Issue date is required." }),
  dueDate: z.date({ required_error: "Due date is required." }),
  notes: z.string().optional().or(z.literal('')).nullable(),
  lineItems: z.array(lineItemFormSchema).min(1, "At least one line item is required."),
}).refine(data => data.dueDate >= data.issueDate, {
    message: "Due date cannot be before issue date.",
    path: ["dueDate"],
});

type CreateInvoiceFormValues = z.infer<typeof createInvoiceFormSchema>;

interface SimpleStudent { id: string; firstName: string; lastName: string; studentIdNumber: string; }
// Ensure SimpleFeeStructure.amount is consistently number after fetch
interface SimpleFeeStructure { id: string; name: string; amount: number; } 

export default function CreateNewInvoicePage() {
  const router = useRouter();
  
  const [students, setStudents] = useState<SimpleStudent[]>([]);
  const [feeStructures, setFeeStructures] = useState<SimpleFeeStructure[]>([]);
  const [isLoadingDropdownData, setIsLoadingDropdownData] = useState(true);

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateInvoiceFormValues>({
    resolver: zodResolver(createInvoiceFormSchema),
    defaultValues: {
      studentId: undefined,
      academicYear: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
      term: undefined,
      issueDate: new Date(),
      dueDate: new Date(new Date().setDate(new Date().getDate() + 30)),
      notes: '',
      lineItems: [{ description: '', quantity: 1, unitPrice: 0, feeStructureId: null }],
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "lineItems",
  });

  useEffect(() => {
    const fetchData = async () => {
      console.log("[CLIENT_INVOICE_NEW] Fetching dropdown data...");
      setIsLoadingDropdownData(true);
      try {
        const [studentsRes, feeStructuresRes] = await Promise.all([
          fetch('/api/school-admin/students'), 
          fetch('/api/school-admin/finances/fee-structures?simple=true') // Ensure this API returns simple list with amount as number
        ]);

        let studentsError = !studentsRes.ok;
        let feeStructuresError = !feeStructuresRes.ok;

        const studentsData = studentsError ? [] : await studentsRes.json();
        const feeStructuresData = feeStructuresError ? [] : await feeStructuresRes.json();
        
        if(studentsError) {
            const errText = await studentsRes.text();
            toast.error("Failed to fetch students", {description: studentsData?.message || `Error ${studentsRes.status}: ${errText.substring(0,100)}...`});
        }
        if(feeStructuresError) {
            const errText = await feeStructuresRes.text();
            toast.error("Failed to fetch fee structures", {description: feeStructuresData?.message || `Error ${feeStructuresRes.status}: ${errText.substring(0,100)}...`});
        }
        
        setStudents(studentsData.map((s: PrismaStudent & {user?: any}) => ({
            id: s.id, 
            firstName: s.firstName, 
            lastName: s.lastName,
            studentIdNumber: s.studentIdNumber
        })));
        
        // Ensure amount from API (Prisma Decimal can be object/string) is converted to number for the form logic
        setFeeStructures(feeStructuresData.map((fs: PrismaFeeStructure) => ({ 
            id: fs.id,
            name: `${fs.name} (${fs.academicYear || 'N/A'}) - ${new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(Number(fs.amount))}`,
            amount: Number(fs.amount) 
        })));
        console.log("[CLIENT_INVOICE_NEW] Dropdown data fetched.");

      } catch (error: any) {
        toast.error("Failed to load initial data for form", { description: error.message });
        console.error("[CLIENT_INVOICE_NEW] Fetch dropdown data error:", error);
      } finally {
        setIsLoadingDropdownData(false);
      }
    };
    fetchData();
  }, []);

  const lineItemsValues = watch("lineItems");
  const totalAmount = lineItemsValues.reduce((acc, item) => {
    const quantity = Number(item.quantity) || 0;
    const unitPrice = Number(item.unitPrice) || 0;
    return acc + (quantity * unitPrice);
  }, 0);

  const handleFeeStructureChange = (index: number, feeStructureId: string) => {
    const selectedFee = feeStructures.find(fs => fs.id === feeStructureId);
    if (selectedFee) {
      // Extracting original name without amount for description
      const originalName = selectedFee.name.substring(0, selectedFee.name.lastIndexOf(' ('));
      setValue(`lineItems.${index}.description`, originalName, { shouldValidate: true });
      setValue(`lineItems.${index}.unitPrice`, Number(selectedFee.amount), { shouldValidate: true }); // Ensure amount is number
    } else { 
      // User selected "-- Custom Item --" or cleared selection
      // Allow manual input for description and unitPrice
      // Optionally clear them if you prefer:
      // setValue(`lineItems.${index}.description`, '', { shouldValidate: true }); 
      // setValue(`lineItems.${index}.unitPrice`, 0, { shouldValidate: true });
    }
  };

  const onSubmit: SubmitHandler<CreateInvoiceFormValues> = async (formData) => {
    const submittingToastId = toast.loading("Creating invoice...");
    console.log("[CLIENT_INVOICE_NEW] Raw Form Data Submitted:", JSON.stringify(formData, null, 2));
    
    const apiData = {
      ...formData,
      issueDate: formData.issueDate.toISOString(),
      dueDate: formData.dueDate.toISOString(),
      lineItems: formData.lineItems.map(item => ({
        description: item.description,
        quantity: Number(item.quantity),   // Ensure number
        unitPrice: Number(item.unitPrice), // Ensure number
        feeStructureId: item.feeStructureId === "custom" || !item.feeStructureId || item.feeStructureId === "none" ? null : item.feeStructureId,
      }))
    };
    console.log("[CLIENT_INVOICE_NEW] Data prepared for API:", JSON.stringify(apiData, null, 2));

    try {
      const response = await fetch('/api/school-admin/finances/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiData),
      });

      const responseText = await response.text();
      console.log("[CLIENT_INVOICE_NEW] API Raw Response Text:", responseText);
      const result = responseText ? JSON.parse(responseText) : null;

      if (!response.ok) {
        console.error("[CLIENT_INVOICE_NEW] API Error Response Object:", result);
        let errorMessage = result?.message || `Error: ${response.status} ${response.statusText || 'Failed to create invoice.'}`;
        if (result?.errors) {
          const fieldErrors = Object.entries(result.errors as Record<string, string[]>)
            .map(([field, messages]) => `${field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}: ${messages.join(', ')}`)
            .join('; ');
          errorMessage = fieldErrors ? `Validation Error: ${fieldErrors}` : errorMessage;
        }
        throw new Error(errorMessage);
      }
      toast.success(`Invoice #${result.invoiceNumber} created successfully!`, { id: submittingToastId });
      reset(); 
      router.push('/school-admin/finances/invoices'); 
    } catch (error: any) {
      toast.error("Failed to create invoice", { id: submittingToastId, description: error.message });
      console.error("[CLIENT_INVOICE_NEW] Create invoice submission/catch error:", error);
    }
  };

  const renderFormSkeleton = () => (
    <div className="space-y-6 pt-6">
        <div className="p-4 border rounded-lg space-y-4 dark:border-neutral-700">
            <Skeleton className="h-6 w-1/3 mb-2" /> {/* Section Title */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1"><Skeleton className="h-4 w-1/4" /><Skeleton className="h-10 w-full" /></div>
                <div className="space-y-1"><Skeleton className="h-4 w-1/4" /><Skeleton className="h-10 w-full" /></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1"><Skeleton className="h-4 w-1/4" /><Skeleton className="h-10 w-full" /></div>
                <div className="space-y-1"><Skeleton className="h-4 w-1/4" /><Skeleton className="h-10 w-full" /></div>
                <div className="space-y-1"><Skeleton className="h-4 w-1/4" /><Skeleton className="h-10 w-full" /></div>
            </div>
        </div>
         <div className="p-4 border rounded-lg space-y-4 dark:border-neutral-700">
            <Skeleton className="h-6 w-1/3 mb-2" /> {/* Section Title */}
            <Skeleton className="h-20 w-full" /> 
         </div>
         <div className="p-4 border rounded-lg space-y-4 dark:border-neutral-700">
            <Skeleton className="h-6 w-1/3 mb-2" /> {/* Section Title */}
            <Skeleton className="h-16 w-full" /> 
         </div>
    </div>
  );

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-2xl flex items-center"><FilePlus2 className="mr-2 h-6 w-6"/> Create New Invoice</CardTitle>
          <Button variant="outline" size="sm" asChild>
            <Link href="/school-admin/finances/invoices">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Invoices List
            </Link>
          </Button>
        </div>
        <CardDescription>
          Generate a new invoice for a student. Select fee structures or add custom line items.
        </CardDescription>
      </CardHeader>
      {isLoadingDropdownData ? (
        <CardContent>{renderFormSkeleton()}</CardContent>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-6 pt-6">
            {/* Section 1: Main Invoice Details */}
            <div className="p-4 border rounded-lg space-y-4 dark:border-neutral-700">
              <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">Invoice Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="studentId">Student <span className="text-destructive">*</span></Label>
                  <Controller name="studentId" control={control} render={({ field }) => (
                    <Select onValueChange={(value) => field.onChange(value === "none" ? "" : value)} value={field.value || "none"} disabled={isSubmitting || students.length === 0}>
                      <SelectTrigger id="studentId"><SelectValue placeholder={students.length === 0 ? "No students available" : "Select a student"} /></SelectTrigger>
                      <SelectContent>
                          <SelectItem value="none">-- Select Student --</SelectItem>
                          {students.map(s => <SelectItem key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.studentIdNumber})</SelectItem>)}
                      </SelectContent>
                    </Select>)}
                  />
                  {errors.studentId && <p className="text-sm text-destructive mt-1">{errors.studentId.message}</p>}
                </div>
                <div>
                  <Label htmlFor="academicYear">Academic Year <span className="text-destructive">*</span></Label>
                  <Input id="academicYear" {...register('academicYear')} placeholder="e.g., 2024-2025" disabled={isSubmitting} />
                  {errors.academicYear && <p className="text-sm text-destructive mt-1">{errors.academicYear.message}</p>}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="term">Term <span className="text-destructive">*</span></Label>
                  <Controller name="term" control={control} render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value || ""} disabled={isSubmitting}>
                      <SelectTrigger id="term"><SelectValue placeholder="Select term" /></SelectTrigger>
                      <SelectContent>{Object.values(TermPeriod).map(t => <SelectItem key={t} value={t}>{t.replace("_"," ")}</SelectItem>)}</SelectContent>
                    </Select>)}
                  />
                  {errors.term && <p className="text-sm text-destructive mt-1">{errors.term.message}</p>}
                </div>
                <div>
                  <Label htmlFor="issueDate">Issue Date <span className="text-destructive">*</span></Label>
                  <Controller name="issueDate" control={control} render={({ field }) => (
                      <Popover><PopoverTrigger asChild>
                          <Button id="issueDate" variant={"outline"} className={`w-full justify-start text-left font-normal ${!field.value && "text-muted-foreground"}`} disabled={isSubmitting}>
                          <CalendarIcon className="mr-2 h-4 w-4" />{field.value ? format(field.value, "PPP") : <span>Pick issue date</span>}
                          </Button></PopoverTrigger><PopoverContent className="w-auto p-0">
                          <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus disabled={isSubmitting}/>
                      </PopoverContent></Popover>)}
                  />
                  {errors.issueDate && <p className="text-sm text-destructive mt-1">{errors.issueDate.message}</p>}
                </div>
                <div>
                  <Label htmlFor="dueDate">Due Date <span className="text-destructive">*</span></Label>
                   <Controller name="dueDate" control={control} render={({ field }) => (
                      <Popover><PopoverTrigger asChild>
                          <Button id="dueDate" variant={"outline"} className={`w-full justify-start text-left font-normal ${!field.value && "text-muted-foreground"}`} disabled={isSubmitting}>
                          <CalendarIcon className="mr-2 h-4 w-4" />{field.value ? format(field.value, "PPP") : <span>Pick due date</span>}</Button>
                      </PopoverTrigger><PopoverContent className="w-auto p-0">
                          <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus disabled={isSubmitting}/>
                      </PopoverContent></Popover>)}
                  />
                  {errors.dueDate && <p className="text-sm text-destructive mt-1">{errors.dueDate.message}</p>}
                </div>
              </div>
            </div>

            {/* Section 2: Line Items */}
            <div className="p-4 border rounded-lg space-y-4 dark:border-neutral-700">
              <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">Invoice Items</h3>
                  <Button type="button" size="sm" variant="outline" onClick={() => append({ description: '', quantity: 1, unitPrice: 0, feeStructureId: null })} disabled={isSubmitting}>
                      <PlusCircle className="mr-2 h-4 w-4" /> Add Item
                  </Button>
              </div>
              {errors.lineItems && typeof errors.lineItems === 'object' && !Array.isArray(errors.lineItems) && (errors.lineItems as any).message && (
                   <p className="text-sm text-destructive mt-1">{(errors.lineItems as any).message}</p>
              )}
              {errors.lineItems && errors.lineItems.root && <p className="text-sm text-destructive mt-1">{errors.lineItems.root.message}</p>}


              {fields.map((item, index) => (
                <div key={item.id} className="p-3 border rounded-md space-y-3 relative bg-muted/20 dark:bg-neutral-700/30 dark:border-neutral-600">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 items-start">
                    <div className="md:col-span-1">
                      <Label htmlFor={`lineItems.${index}.feeStructureId`}>Fee Item (Optional)</Label>
                      <Controller
                        name={`lineItems.${index}.feeStructureId`}
                        control={control}
                        render={({ field }) => (
                          <Select
                            onValueChange={(value) => {
                              field.onChange(value === "custom" ? null : value);
                              handleFeeStructureChange(index, value === "custom" ? "" : value);
                            }}
                            value={field.value || "custom"}
                            disabled={isSubmitting || feeStructures.length === 0}
                          >
                            <SelectTrigger id={`lineItems.${index}.feeStructureId`}><SelectValue placeholder="Select fee or custom" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="custom">-- Custom Item --</SelectItem>
                              {feeStructures.map(fs => <SelectItem key={fs.id} value={fs.id}>{fs.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label htmlFor={`lineItems.${index}.description`}>Description <span className="text-destructive">*</span></Label>
                      <Input id={`lineItems.${index}.description`} {...register(`lineItems.${index}.description`)} disabled={isSubmitting} />
                      {errors.lineItems?.[index]?.description && <p className="text-sm text-destructive mt-1">{errors.lineItems?.[index]?.description?.message}</p>}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-start">
                      <div>
                          <Label htmlFor={`lineItems.${index}.quantity`}>Quantity <span className="text-destructive">*</span></Label>
                          <Input id={`lineItems.${index}.quantity`} type="number" {...register(`lineItems.${index}.quantity`)} step="1" min="1" disabled={isSubmitting} />
                          {errors.lineItems?.[index]?.quantity && <p className="text-sm text-destructive mt-1">{errors.lineItems?.[index]?.quantity?.message}</p>}
                      </div>
                      <div>
                          <Label htmlFor={`lineItems.${index}.unitPrice`}>Unit Price (GHS) <span className="text-destructive">*</span></Label>
                          <Input id={`lineItems.${index}.unitPrice`} type="number" step="0.01" {...register(`lineItems.${index}.unitPrice`)} disabled={isSubmitting} />
                          {errors.lineItems?.[index]?.unitPrice && <p className="text-sm text-destructive mt-1">{errors.lineItems?.[index]?.unitPrice?.message}</p>}
                      </div>
                      <div className="sm:col-span-1 flex items-end">
                          <p className="text-sm font-medium mt-1">
                          Subtotal: {new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(
                              (Number(watch(`lineItems.${index}.quantity`)) || 0) * (Number(watch(`lineItems.${index}.unitPrice`)) || 0)
                          )}
                          </p>
                      </div>
                      {fields.length > 1 && (
                          <div className="sm:col-span-1 flex items-end justify-end">
                              <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} disabled={isSubmitting} className="text-destructive hover:text-destructive/80">
                                  <Trash2 className="h-4 w-4" />
                              </Button>
                          </div>
                      )}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border rounded-lg space-y-4 dark:border-neutral-700">
              <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">Summary & Notes</h3>
              <div>
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea id="notes" {...register('notes')} placeholder="Any additional notes for this invoice" disabled={isSubmitting} />
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold">Total Amount: {new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(totalAmount)}</p>
              </div>
            </div>

          </CardContent>
          <CardFooter className="flex justify-end">
            <Button type="submit" disabled={isSubmitting || isLoadingDropdownData}>
              <FilePlus2 className="mr-2 h-4 w-4" />
              {isSubmitting ? 'Generating Invoice...' : 'Generate Invoice'}
            </Button>
          </CardFooter>
        </form>
      )}
    </Card>
  );
}