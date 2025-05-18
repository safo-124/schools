// app/(platform)/school-admin/communications/announcements/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { useForm, SubmitHandler, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { 
    SchoolAnnouncement as PrismaSchoolAnnouncement, 
    SchoolAdmin as PrismaSchoolAdmin,
    User as PrismaUser
} from '@prisma/client';
import { format } from "date-fns";

// Shadcn/ui components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
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
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { PlusCircle, Megaphone, CalendarIcon, Users, Edit, Trash2 } from "lucide-react";
import { Badge } from '@/components/ui/badge';

// Type for announcement data displayed in the list
interface AnnouncementWithAuthor extends PrismaSchoolAnnouncement {
  createdByAdmin?: {
    user: Pick<PrismaUser, 'firstName' | 'lastName' | 'email'>;
  } | null;
}

// Zod schema for the Add Announcement form
const announcementFormSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters long."),
  content: z.string().min(10, "Content must be at least 10 characters long."),
  publishDate: z.date().optional().nullable(), // Will be converted to ISO string for API
  expiryDate: z.date().optional().nullable(),
  audience: z.string().optional().or(z.literal('')).nullable(),
  isPublished: z.boolean().default(true),
}).refine(data => {
    if (data.expiryDate && data.publishDate && data.expiryDate < data.publishDate) {
        return false;
    }
    return true;
}, {
    message: "Expiry date cannot be before publish date.",
    path: ["expiryDate"],
});

type AnnouncementFormValues = z.infer<typeof announcementFormSchema>;

export default function ManageAnnouncementsPage() {
  const router = useRouter();
  const [announcements, setAnnouncements] = useState<AnnouncementWithAuthor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [fetchAttempted, setFetchAttempted] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting: isFormSubmitting },
  } = useForm<AnnouncementFormValues>({
    resolver: zodResolver(announcementFormSchema),
    defaultValues: {
      title: '',
      content: '',
      publishDate: new Date(), // Default to today
      expiryDate: null,
      audience: 'ALL',
      isPublished: true,
    }
  });

  const fetchAnnouncements = useCallback(async (isInitialLoad = false) => {
    if(isInitialLoad) setIsLoading(true);
    setFetchAttempted(false);
    try {
      const response = await fetch('/api/school-admin/communications/announcements');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch announcements.');
      }
      const data: AnnouncementWithAuthor[] = await response.json();
      setAnnouncements(data);
    } catch (error: any) {
      toast.error("Failed to load announcements", { description: error.message });
      setAnnouncements([]);
    } finally {
      if(isInitialLoad) setIsLoading(false);
      setFetchAttempted(true);
    }
  }, []);

  useEffect(() => {
    fetchAnnouncements(true);
  }, [fetchAnnouncements]);

  const handleAddSubmit: SubmitHandler<AnnouncementFormValues> = async (formData) => {
    const submittingToastId = toast.loading("Creating announcement...");
    try {
      const apiData = {
        ...formData,
        publishDate: formData.publishDate ? formData.publishDate.toISOString() : undefined, // API expects string or undefined
        expiryDate: formData.expiryDate ? formData.expiryDate.toISOString() : undefined,
        audience: formData.audience === '' ? null : formData.audience,
      };

      const response = await fetch('/api/school-admin/communications/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiData),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || "Failed to create announcement.");
      }
      toast.success("Announcement created successfully!", { id: submittingToastId });
      reset({ // Reset with defaults after successful submission
          title: '', content: '', publishDate: new Date(), expiryDate: null,
          audience: 'ALL', isPublished: true,
      });
      setIsAddModalOpen(false);
      fetchAnnouncements(false); 
      router.refresh(); 
    } catch (error: any) {
      toast.error("Failed to create announcement", { id: submittingToastId, description: error.message });
    }
  };
  
  const formatDate = (dateString: string | Date | null | undefined) => {
    if (!dateString) return 'N/A';
    return format(new Date(dateString), "PPP p"); // e.g., May 18th, 2025, 2:30 PM
  };

  const renderSkeletons = () => Array.from({ length: 3 }).map((_, index) => (
    <Card key={`skeleton-announcement-${index}`} className="mb-4">
        <CardHeader>
            <Skeleton className="h-6 w-3/4 mb-2" /> {/* Title */}
            <Skeleton className="h-4 w-1/2" /> {/* Meta */}
        </CardHeader>
        <CardContent>
            <Skeleton className="h-4 w-full mb-1" />
            <Skeleton className="h-4 w-full mb-1" />
            <Skeleton className="h-4 w-2/3" />
        </CardContent>
        <CardFooter>
            <Skeleton className="h-8 w-24" />
        </CardFooter>
    </Card>
  ));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center"><Megaphone className="mr-2 h-6 w-6" /> Manage Announcements</CardTitle>
            <CardDescription>Create, view, and manage school-wide announcements.</CardDescription>
          </div>
          <Dialog open={isAddModalOpen} onOpenChange={(open) => {
            if (!open) reset({ title: '', content: '', publishDate: new Date(), expiryDate: null, audience: 'ALL', isPublished: true });
            setIsAddModalOpen(open);
          }}>
            <DialogTrigger asChild>
              <Button>
                <PlusCircle className="mr-2 h-4 w-4" /> Create Announcement
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Create New Announcement</DialogTitle>
                <DialogDescription>Compose and schedule your announcement.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit(handleAddSubmit)} className="space-y-4 py-4">
                <div>
                  <Label htmlFor="title">Title <span className="text-destructive">*</span></Label>
                  <Input id="title" {...register('title')} disabled={isFormSubmitting} />
                  {errors.title && <p className="text-sm text-destructive mt-1">{errors.title.message}</p>}
                </div>
                <div>
                  <Label htmlFor="content">Content <span className="text-destructive">*</span></Label>
                  <Textarea id="content" {...register('content')} rows={5} disabled={isFormSubmitting} />
                  {errors.content && <p className="text-sm text-destructive mt-1">{errors.content.message}</p>}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="publishDate">Publish Date (Optional)</Label>
                    <Controller name="publishDate" control={control} render={({ field }) => (
                      <Popover><PopoverTrigger asChild>
                          <Button variant={"outline"} id="publishDate" className={`w-full justify-start text-left font-normal ${!field.value && "text-muted-foreground"}`} disabled={isFormSubmitting}>
                          <CalendarIcon className="mr-2 h-4 w-4" />{field.value ? format(field.value, "PPP") : <span>Immediately (or pick date)</span>}
                          </Button></PopoverTrigger><PopoverContent className="w-auto p-0">
                          <Calendar mode="single" selected={field.value || undefined} onSelect={(date) => field.onChange(date || null)} initialFocus disabled={isFormSubmitting}/>
                      </PopoverContent></Popover>)}
                    />
                    {errors.publishDate && <p className="text-sm text-destructive mt-1">{errors.publishDate.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="expiryDate">Expiry Date (Optional)</Label>
                    <Controller name="expiryDate" control={control} render={({ field }) => (
                      <Popover><PopoverTrigger asChild>
                          <Button variant={"outline"} id="expiryDate" className={`w-full justify-start text-left font-normal ${!field.value && "text-muted-foreground"}`} disabled={isFormSubmitting}>
                          <CalendarIcon className="mr-2 h-4 w-4" />{field.value ? format(field.value, "PPP") : <span>No expiry</span>}
                          </Button></PopoverTrigger><PopoverContent className="w-auto p-0">
                          <Calendar mode="single" selected={field.value || undefined} onSelect={(date) => field.onChange(date || null)} initialFocus disabled={isFormSubmitting}/>
                      </PopoverContent></Popover>)}
                    />
                    {errors.expiryDate && <p className="text-sm text-destructive mt-1">{errors.expiryDate.message}</p>}
                  </div>
                </div>
                <div>
                    <Label htmlFor="audience">Target Audience (Optional)</Label>
                    <Input id="audience" {...register('audience')} placeholder="e.g., ALL, PARENTS, TEACHERS_GRADE_5" disabled={isFormSubmitting} />
                    {errors.audience && <p className="text-sm text-destructive mt-1">{errors.audience.message}</p>}
                </div>
                <div className="flex items-center space-x-2">
                    <Controller name="isPublished" control={control} render={({ field }) => (
                        <Switch id="isPublished" checked={field.value} onCheckedChange={field.onChange} disabled={isFormSubmitting} />
                    )} />
                    <Label htmlFor="isPublished">Publish Immediately (Save as Draft if unchecked)</Label>
                </div>
                <DialogFooter className="pt-4">
                  <DialogClose asChild><Button type="button" variant="outline" disabled={isFormSubmitting}>Cancel</Button></DialogClose>
                  <Button type="submit" disabled={isFormSubmitting}>
                    {isFormSubmitting ? 'Creating...' : 'Create Announcement'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {isLoading && !fetchAttempted ? (
            <div className="space-y-4">{renderSkeletons()}</div>
          ) : !isLoading && announcements.length === 0 && fetchAttempted ? (
            <div className="text-center py-10"><Megaphone className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-sm font-medium">No announcements found.</h3>
              <p className="mt-1 text-sm text-muted-foreground">Create the first announcement for your school.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {announcements.map((ann) => (
                <Card key={ann.id} className={`${!ann.isPublished ? 'border-dashed border-amber-500 opacity-70' : ''}`}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                        <CardTitle>{ann.title}</CardTitle>
                        <div className="flex items-center space-x-2">
                            {ann.audience && <Badge variant="outline">{ann.audience}</Badge>}
                            <Badge variant={ann.isPublished ? 'default' : 'secondary'} className={ann.isPublished ? 'bg-green-500' : ''}>
                                {ann.isPublished ? 'Published' : 'Draft'}
                            </Badge>
                        </div>
                    </div>
                    <CardDescription className="text-xs">
                      Published: {formatDate(ann.publishDate)} 
                      {ann.expiryDate && ` | Expires: ${formatDate(ann.expiryDate)}`}
                      {ann.createdByAdmin?.user && ` | By: ${ann.createdByAdmin.user.firstName} ${ann.createdByAdmin.user.lastName}`}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-wrap">{ann.content}</p>
                  </CardContent>
                  <CardFooter className="flex justify-end space-x-2">
                    <Button variant="outline" size="sm" disabled title="Edit (soon)"><Edit className="mr-2 h-4 w-4"/>Edit</Button>
                    <Button variant="outline" size="sm" disabled className="text-destructive" title="Delete (soon)"><Trash2 className="mr-2 h-4 w-4"/>Delete</Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}