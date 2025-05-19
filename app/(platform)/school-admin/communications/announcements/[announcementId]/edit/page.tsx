// app/(platform)/school-admin/communications/announcements/[announcementId]/edit/page.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { z } from 'zod';
import { useForm, SubmitHandler, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { SchoolAnnouncement as PrismaSchoolAnnouncement } from '@prisma/client';
import { format } from "date-fns";

// Shadcn/ui components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ArrowLeft, Save, CalendarIcon } from "lucide-react";

// Zod schema for the Edit Announcement form (all fields optional for PATCH)
// This should match the updateAnnouncementApiSchema in your [announcementId]/route.ts
const editAnnouncementFormSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters long.").optional(),
  content: z.string().min(10, "Content must be at least 10 characters long.").optional(),
  publishDate: z.date().optional().nullable(), // Handled as Date object in form
  expiryDate: z.date().optional().nullable(),   // Handled as Date object in form
  audience: z.string().optional().or(z.literal('')).nullable(),
  isPublished: z.boolean().optional(),
}).refine(data => {
    if (data.expiryDate && data.publishDate && data.expiryDate < data.publishDate) {
        return false;
    }
    return true;
}, {
    message: "Expiry date cannot be before publish date.",
    path: ["expiryDate"],
});

type EditAnnouncementFormValues = z.infer<typeof editAnnouncementFormSchema>;

// Type for data fetched from API (includes createdByAdmin)
interface AnnouncementDataToEdit extends PrismaSchoolAnnouncement {
  // createdByAdmin is included if your GET API includes it, otherwise make optional
  createdByAdmin?: {
    user: { firstName: string | null; lastName: string | null; };
  } | null;
}

export default function EditAnnouncementPage() {
  const router = useRouter();
  const params = useParams();
  const announcementId = params.announcementId as string;

  const [initialLoading, setInitialLoading] = useState(true);
  const [originalAnnouncement, setOriginalAnnouncement] = useState<AnnouncementDataToEdit | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting, dirtyFields }, // Use dirtyFields
  } = useForm<EditAnnouncementFormValues>({
    resolver: zodResolver(editAnnouncementFormSchema),
    defaultValues: { // Initialize to prevent uncontrolled component warnings
        title: '',
        content: '',
        publishDate: null,
        expiryDate: null,
        audience: '',
        isPublished: true,
    },
  });

  // Fetch announcement data for pre-filling the form
  useEffect(() => {
    if (!announcementId) {
      toast.error("Error: Announcement ID not found in URL.");
      setInitialLoading(false);
      router.push("/school-admin/communications/announcements");
      return;
    }

    const fetchAnnouncementData = async () => {
      setInitialLoading(true);
      try {
        const response = await fetch(`/api/school-admin/communications/announcements/${announcementId}`);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || `Failed to fetch announcement data: ${response.statusText}`);
        }
        const announcementData: AnnouncementDataToEdit = await response.json();
        setOriginalAnnouncement(announcementData); // Store original for comparison or display
        
        reset({
          title: announcementData.title || '',
          content: announcementData.content || '',
          publishDate: announcementData.publishDate ? new Date(announcementData.publishDate) : null,
          expiryDate: announcementData.expiryDate ? new Date(announcementData.expiryDate) : null,
          audience: announcementData.audience || '',
          isPublished: announcementData.isPublished,
        });
      } catch (err: any) {
        toast.error("Failed to load announcement data", { description: err.message });
        console.error("Fetch announcement data error:", err);
      } finally {
        setInitialLoading(false);
      }
    };
    fetchAnnouncementData();
  }, [announcementId, reset, router]);

  const onSubmit: SubmitHandler<EditAnnouncementFormValues> = async (formData) => {
    const submittingToastId = toast.loading("Updating announcement...");
    
    const changedData: Partial<EditAnnouncementFormValues & { publishDate?: string|null, expiryDate?: string|null }> = {};
    let hasChanges = false;

    // Iterate over dirtyFields to build the payload with only changed values
    (Object.keys(dirtyFields) as Array<keyof EditAnnouncementFormValues>).forEach(key => {
        hasChanges = true;
        const value = formData[key];
        if (key === 'publishDate' || key === 'expiryDate') {
            changedData[key] = value ? (value as Date).toISOString() : null;
        } else if (value === '') { // For optional text fields that can be cleared
            (changedData as any)[key] = null; 
        } else {
            (changedData as any)[key] = value;
        }
    });
    

    if (!hasChanges) {
        toast.info("No changes were made to submit.", { id: submittingToastId });
        return;
    }
    
    // console.log("Submitting Updated Announcement Data to API:", JSON.stringify(changedData, null, 2));

    try {
      const response = await fetch(`/api/school-admin/communications/announcements/${announcementId}`, {
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
        throw new Error(errorMessage);
      }
      toast.success("Announcement updated successfully!", { id: submittingToastId });
      // Update form with newly saved data to clear dirty state and reflect changes
      reset({ 
        title: result.title || '',
        content: result.content || '',
        publishDate: result.publishDate ? new Date(result.publishDate) : null,
        expiryDate: result.expiryDate ? new Date(result.expiryDate) : null,
        audience: result.audience || '',
        isPublished: result.isPublished,
      }); 
      setTimeout(() => {
        router.push('/school-admin/communications/announcements'); 
      }, 1500);
    } catch (err: any) {
      toast.error("Failed to update announcement", { id: submittingToastId, description: err.message });
      console.error("Update announcement error (client):", err);
    }
  };
  
  if (initialLoading) {
    return (
      <Card className="w-full max-w-lg mx-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Edit Announcement</CardTitle>
            <Button variant="outline" size="sm" asChild disabled>
              <Link href="/school-admin/communications/announcements"><ArrowLeft className="mr-2 h-4 w-4" />Back</Link>
            </Button>
          </div>
          <CardDescription><Skeleton className="h-4 w-3/4" /></CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <div className="space-y-2"><Skeleton className="h-4 w-1/4" /><Skeleton className="h-10 w-full" /></div>
          <div className="space-y-2"><Skeleton className="h-4 w-1/4" /><Skeleton className="h-20 w-full" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-10 w-full" /></div>
            <div className="space-y-2"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-10 w-full" /></div>
          </div>
          <div className="space-y-2"><Skeleton className="h-4 w-1/4" /><Skeleton className="h-10 w-full" /></div>
          <div className="flex items-center space-x-2 pt-2"><Skeleton className="h-6 w-6 rounded-full" /><Skeleton className="h-4 w-1/4" /></div>
        </CardContent>
        <CardFooter><Skeleton className="h-10 w-28" /></CardFooter>
      </Card>
    );
  }
  
  if (!originalAnnouncement && !initialLoading) { // Fetch attempted but failed to get data
     return (
      <Card className="w-full max-w-lg mx-auto">
        <CardHeader><CardTitle>Error</CardTitle></CardHeader>
        <CardContent>
            <p className="text-destructive">Failed to load announcement data. It might have been deleted or an error occurred.</p>
            <Button variant="outline" asChild className="mt-4">
                <Link href="/school-admin/communications/announcements"><ArrowLeft className="mr-2 h-4 w-4"/>Back to Announcements</Link>
            </Button>
        </CardContent>
      </Card>
     );
  }


  return (
    <Card className="w-full max-w-lg mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Edit Announcement</CardTitle>
          <Button variant="outline" size="sm" asChild>
            <Link href="/school-admin/communications/announcements">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Announcements
            </Link>
          </Button>
        </div>
        <CardDescription>
          Modify the details of: <strong>{originalAnnouncement?.title || "this announcement"}</strong>.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4 pt-6">
          {/* Toasts will handle submit success/error */}
          <div>
            <Label htmlFor="edit-ann-title">Title <span className="text-destructive">*</span></Label>
            <Input id="edit-ann-title" {...register('title')} disabled={isSubmitting} />
            {errors.title && <p className="text-sm text-destructive mt-1">{errors.title.message}</p>}
          </div>
          <div>
            <Label htmlFor="edit-ann-content">Content <span className="text-destructive">*</span></Label>
            <Textarea id="edit-ann-content" {...register('content')} rows={5} disabled={isSubmitting} />
            {errors.content && <p className="text-sm text-destructive mt-1">{errors.content.message}</p>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="edit-ann-publishDate">Publish Date</Label>
              <Controller name="publishDate" control={control} render={({ field }) => (
                <Popover><PopoverTrigger asChild>
                    <Button variant={"outline"} id="edit-ann-publishDate" className={`w-full justify-start text-left font-normal ${!field.value && "text-muted-foreground"}`} disabled={isSubmitting}>
                    <CalendarIcon className="mr-2 h-4 w-4" />{field.value ? format(field.value, "PPP") : <span>Pick publish date</span>}
                    </Button></PopoverTrigger><PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={field.value} onSelect={(date) => field.onChange(date || null)} initialFocus disabled={isSubmitting}/>
                </PopoverContent></Popover>)} 
              />
              {errors.publishDate && <p className="text-sm text-destructive mt-1">{errors.publishDate.message}</p>}
            </div>
            <div>
              <Label htmlFor="edit-ann-expiryDate">Expiry Date (Optional)</Label>
              <Controller name="expiryDate" control={control} render={({ field }) => (
                <Popover><PopoverTrigger asChild>
                    <Button variant={"outline"} id="edit-ann-expiryDate" className={`w-full justify-start text-left font-normal ${!field.value && "text-muted-foreground"}`} disabled={isSubmitting}>
                    <CalendarIcon className="mr-2 h-4 w-4" />{field.value ? format(field.value, "PPP") : <span>No expiry</span>}
                    </Button></PopoverTrigger><PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={field.value} onSelect={(date) => field.onChange(date || null)} initialFocus disabled={isSubmitting}/>
                </PopoverContent></Popover>)}
              />
              {errors.expiryDate && <p className="text-sm text-destructive mt-1">{errors.expiryDate.message}</p>}
            </div>
          </div>
          <div>
            <Label htmlFor="edit-ann-audience">Target Audience (Optional)</Label>
            <Input id="edit-ann-audience" {...register('audience')} placeholder="e.g., ALL, PARENTS, TEACHERS_GRADE_5" disabled={isSubmitting} />
            {errors.audience && <p className="text-sm text-destructive mt-1">{errors.audience.message}</p>}
          </div>
          <div className="flex items-center space-x-2 pt-2">
            <Controller name="isPublished" control={control} render={({ field }) => (
                <Switch id="edit-ann-isPublished" checked={field.value} onCheckedChange={field.onChange} disabled={isSubmitting} />
            )} />
            <Label htmlFor="edit-ann-isPublished" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              Is Published
            </Label>
             {errors.isPublished && <p className="text-sm text-destructive mt-1">{errors.isPublished.message}</p>}
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={isSubmitting || initialLoading}>
            <Save className="mr-2 h-4 w-4" />
            {isSubmitting ? 'Saving Changes...' : 'Save Changes'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}