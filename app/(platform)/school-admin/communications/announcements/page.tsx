// app/(platform)/school-admin/communications/announcements/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { z } from 'zod';
import { useForm, SubmitHandler, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { 
    SchoolAnnouncement as PrismaSchoolAnnouncement, 
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
import { PlusCircle, Megaphone, CalendarIcon, Edit, Trash2 } from "lucide-react";
import { Badge } from '@/components/ui/badge';

import { DeleteAnnouncementButton } from '@/components/school-admin/communications/DeleteAnnouncementButton';

interface AnnouncementWithAuthor extends PrismaSchoolAnnouncement {
  createdByAdmin?: {
    user: Pick<PrismaUser, 'firstName' | 'lastName' | 'email'>;
  } | null;
}

const announcementFormSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters long."),
  content: z.string().min(10, "Content must be at least 10 characters long."),
  publishDate: z.date().optional().nullable(),
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

  const addAnnouncementForm = useForm<AnnouncementFormValues>({
    resolver: zodResolver(announcementFormSchema),
    defaultValues: {
      title: '', content: '', publishDate: new Date(), 
      expiryDate: null, audience: 'ALL', isPublished: true,
    }
  });

  const fetchAnnouncements = useCallback(async (isInitialCall = false) => {
    if (isInitialCall) {
        setIsLoading(true); // Only set for the very first call by useEffect
    }
    // For subsequent calls (e.g., after delete/add), we might not want a full page skeleton.
    // The button itself will show a loading state.
    console.log(`[ANNOUNCEMENTS_PAGE] fetchAnnouncements called. Initial call: ${isInitialCall}`);
    setFetchAttempted(false);
    try {
      const response = await fetch('/api/school-admin/communications/announcements');
      const responseText = await response.text();
      let data: AnnouncementWithAuthor[] = [];

      if (!response.ok) {
        let errorMessage = `Error ${response.status}: ${response.statusText || 'Failed to fetch'}`;
        try { const errorData = JSON.parse(responseText); errorMessage = errorData.message || errorMessage;
        } catch (e) { errorMessage = `${errorMessage}. Response: ${responseText.substring(0,200)}...`;}
        throw new Error(errorMessage);
      }
      
      if (responseText) {
        try { data = JSON.parse(responseText); } catch (e: any) {
            console.error("[ANNOUNCEMENTS_PAGE] Failed to parse API response as JSON. Raw text:", responseText.substring(0, 200), 'Error:', e);
            throw new Error(`API response was not valid JSON. Status: ${response.status}.`);
        }
      }
      
      const validAnnouncements = Array.isArray(data) ? data.filter(ann => ann && typeof ann.title === 'string' && ann.title !== null) : [];
      if (validAnnouncements.length !== data.length && Array.isArray(data)) {
          console.warn("[ANNOUNCEMENTS_PAGE] Filtered out invalid announcement objects from API response.");
      }
      setAnnouncements(validAnnouncements);
    } catch (error: any) {
      toast.error("Failed to load announcements", { description: error.message });
      console.error("[ANNOUNCEMENTS_PAGE] Fetch announcements error object:", error);
      setAnnouncements([]);
    } finally {
      setIsLoading(false); // Always set to false when fetch completes or fails
      setFetchAttempted(true);
    }
  }, []); // Corrected: Empty dependency array for useCallback makes fetchAnnouncements stable

  useEffect(() => {
    console.log('[ANNOUNCEMENTS_PAGE] Initial useEffect triggered.');
    fetchAnnouncements(true); // Call with true for initial load
  }, [fetchAnnouncements]); // This useEffect runs once because fetchAnnouncements is stable

  const handleAddSubmit: SubmitHandler<AnnouncementFormValues> = async (formData) => {
    const submittingToastId = toast.loading("Creating announcement...");
    try {
      const apiData = { ...formData,
        publishDate: formData.publishDate ? formData.publishDate.toISOString() : new Date().toISOString(),
        expiryDate: formData.expiryDate ? formData.expiryDate.toISOString() : null,
        audience: formData.audience === '' ? null : formData.audience,
      };
      const response = await fetch('/api/school-admin/communications/announcements', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(apiData),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Failed to create announcement.");
      
      toast.success("Announcement created successfully!", { id: submittingToastId });
      addAnnouncementForm.reset({ title: '', content: '', publishDate: new Date(), expiryDate: null, audience: 'ALL', isPublished: true });
      setIsAddModalOpen(false); 
      fetchAnnouncements(); // Re-fetch list after adding
      router.refresh(); 
    } catch (error: any) { 
        toast.error("Failed to create announcement", { id: submittingToastId, description: error.message });
    }
  };
  
  const handleActionSuccess = () => {
    console.log('[ANNOUNCEMENTS_PAGE] Delete action successful, re-fetching announcements.');
    toast.info("Refreshing announcements list...");
    fetchAnnouncements(); 
  };

  const formatDate = (dateString: string | Date | null | undefined) => {
    if (!dateString) return 'N/A';
    return format(new Date(dateString), "PPP p");
  };

  const renderSkeletons = () => Array.from({ length: 2 }).map((_, index) => ( 
    <Card key={`skeleton-announcement-${index}`} className="mb-4">
        <CardHeader><Skeleton className="h-7 w-3/4 mb-2" /> <Skeleton className="h-4 w-1/2" /></CardHeader>
        <CardContent className="space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-2/3" /></CardContent>
        <CardFooter><Skeleton className="h-8 w-20 mr-2" /><Skeleton className="h-8 w-20" /></CardFooter>
    </Card>
  ));

  let contentToRender;
  if (isLoading && !fetchAttempted) {
    contentToRender = <div className="space-y-4">{renderSkeletons()}</div>;
  } else if (!isLoading && announcements.length === 0 && fetchAttempted) {
    contentToRender = ( 
      <div className="text-center py-10"><Megaphone className="mx-auto h-12 w-12 text-muted-foreground" /><h3 className="mt-2 text-sm font-medium">No announcements found.</h3><p className="mt-1 text-sm text-muted-foreground">Create the first announcement for your school.</p></div>
    );
  } else if (announcements.length > 0) {
    contentToRender = (
      <div className="space-y-4">
        {announcements.map((ann) => {
          if (!ann || typeof ann.title !== 'string' || ann.title === null) {
            console.warn("[ANNOUNCEMENTS_PAGE] Skipping render for invalid announcement object:", ann);
            return <Card key={ann?.id || Math.random()} className="border-red-500"><CardHeader><CardTitle className="text-red-600">Data Error</CardTitle></CardHeader><CardContent><p className="text-red-500">This announcement entry is incomplete.</p></CardContent></Card>;
          }
          return (
            <Card key={ann.id} className={`${!ann.isPublished ? 'border-dashed border-amber-500 opacity-70 dark:border-amber-700' : 'dark:border-neutral-700'}`}>
              <CardHeader>
                <div className="flex justify-between items-start">
                    <CardTitle>{ann.title}</CardTitle>
                    <div className="flex items-center space-x-2 flex-shrink-0">
                        {ann.audience && <Badge variant="outline" className="text-xs">{ann.audience}</Badge>}
                        <Badge variant={ann.isPublished ? 'default' : 'secondary'} className={`${ann.isPublished ? 'bg-green-600 hover:bg-green-700' : 'bg-amber-500 hover:bg-amber-600'} text-white text-xs`}>
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
              <CardContent><p className="text-sm whitespace-pre-wrap">{ann.content}</p></CardContent>
              <CardFooter className="flex justify-end space-x-2">
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/school-admin/communications/announcements/${ann.id}/edit`}>
                    <Edit className="mr-2 h-4 w-4"/>Edit
                  </Link>
                </Button>
                <DeleteAnnouncementButton
                    announcementId={ann.id}
                    announcementTitle={ann.title}
                    onDeleteSuccess={handleActionSuccess}
                />
              </CardFooter>
            </Card>
          );
        })}
      </div>
    );
  } else { 
    contentToRender = <p className="text-center py-10 text-muted-foreground">Could not display announcements at this time.</p>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div><CardTitle className="flex items-center"><Megaphone className="mr-2 h-6 w-6" /> Manage Announcements</CardTitle><CardDescription>Create, view, edit, and manage school-wide announcements.</CardDescription></div>
          <Dialog open={isAddModalOpen} onOpenChange={(open) => { if (!open) addAnnouncementForm.reset({ title: '', content: '', publishDate: new Date(), expiryDate: null, audience: 'ALL', isPublished: true }); setIsAddModalOpen(open);}}>
            <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4 w-4" /> Create Announcement</Button></DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader><DialogTitle>Create New Announcement</DialogTitle><DialogDescription>Compose and schedule.</DialogDescription></DialogHeader>
              <form onSubmit={addAnnouncementForm.handleSubmit(handleAddSubmit)} className="space-y-4 py-4">
                <div><Label htmlFor="add-title">Title <span className="text-destructive">*</span></Label><Input id="add-title" {...addAnnouncementForm.register('title')} disabled={addAnnouncementForm.formState.isSubmitting} />{addAnnouncementForm.formState.errors.title && <p className="text-sm text-destructive mt-1">{addAnnouncementForm.formState.errors.title.message}</p>}</div>
                <div><Label htmlFor="add-content">Content <span className="text-destructive">*</span></Label><Textarea id="add-content" {...addAnnouncementForm.register('content')} rows={5} disabled={addAnnouncementForm.formState.isSubmitting} />{addAnnouncementForm.formState.errors.content && <p className="text-sm text-destructive mt-1">{addAnnouncementForm.formState.errors.content.message}</p>}</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div><Label htmlFor="add-publishDate">Publish Date</Label><Controller name="publishDate" control={addAnnouncementForm.control} render={({ field }) => (<Popover><PopoverTrigger asChild><Button variant={"outline"} id="add-publishDate" className={`w-full justify-start text-left font-normal ${!field.value && "text-muted-foreground"}`} disabled={addAnnouncementForm.formState.isSubmitting}><CalendarIcon className="mr-2 h-4 w-4" />{field.value ? format(field.value, "PPP") : <span>Immediately</span>}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value || undefined} onSelect={(date) => field.onChange(date || null)} initialFocus disabled={addAnnouncementForm.formState.isSubmitting}/></PopoverContent></Popover>)} />{addAnnouncementForm.formState.errors.publishDate && <p className="text-sm text-destructive mt-1">{addAnnouncementForm.formState.errors.publishDate.message}</p>}</div>
                  <div><Label htmlFor="add-expiryDate">Expiry Date</Label><Controller name="expiryDate" control={addAnnouncementForm.control} render={({ field }) => (<Popover><PopoverTrigger asChild><Button variant={"outline"} id="add-expiryDate" className={`w-full justify-start text-left font-normal ${!field.value && "text-muted-foreground"}`} disabled={addAnnouncementForm.formState.isSubmitting}><CalendarIcon className="mr-2 h-4 w-4" />{field.value ? format(field.value, "PPP") : <span>No expiry</span>}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value || undefined} onSelect={(date) => field.onChange(date || null)} initialFocus disabled={addAnnouncementForm.formState.isSubmitting}/></PopoverContent></Popover>)} />{addAnnouncementForm.formState.errors.expiryDate && <p className="text-sm text-destructive mt-1">{addAnnouncementForm.formState.errors.expiryDate.message}</p>}</div>
                </div>
                <div><Label htmlFor="add-audience">Target Audience</Label><Input id="add-audience" {...addAnnouncementForm.register('audience')} placeholder="e.g., ALL, PARENTS" disabled={addAnnouncementForm.formState.isSubmitting} />{addAnnouncementForm.formState.errors.audience && <p className="text-sm text-destructive mt-1">{addAnnouncementForm.formState.errors.audience.message}</p>}</div>
                <div className="flex items-center space-x-2"><Controller name="isPublished" control={addAnnouncementForm.control} render={({ field }) => (<Switch id="add-isPublished" checked={field.value} onCheckedChange={field.onChange} disabled={addAnnouncementForm.formState.isSubmitting} />)} /><Label htmlFor="add-isPublished">Publish Immediately</Label></div>
                <DialogFooter className="pt-4"><DialogClose asChild><Button type="button" variant="outline" disabled={addAnnouncementForm.formState.isSubmitting}>Cancel</Button></DialogClose><Button type="submit" disabled={addAnnouncementForm.formState.isSubmitting}>{addAnnouncementForm.formState.isSubmitting ? 'Creating...' : 'Create'}</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>{contentToRender}</CardContent>
      </Card>
    </div>
  );
}