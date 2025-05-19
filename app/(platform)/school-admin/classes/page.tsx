// app/(platform)/school-admin/classes/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
    Class as PrismaClass, 
     // For SimpleTeacher type if used in dropdown
    User as PrismaUser,
    // For Add Class form Zod schema
} from '@prisma/client';

import { z } from 'zod';
import { useForm, SubmitHandler, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

// Import Shadcn/ui components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; // For Add Modal
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { PlusCircle, Edit, Eye, BookOpenText } from "lucide-react"; // Added CalendarIcon

// Import the custom DeleteClassButton component
import { DeleteClassButton } from '@/components/school-admin/classes/DeleteClassButton'; // Adjust path if needed

// Define the expected structure of a class object from the API
interface ClassData extends Omit<PrismaClass, 'homeroomTeacherId' | 'schoolId'> {
  homeroomTeacher?: {
    id: string;
    user: Pick<PrismaUser, 'firstName' | 'lastName'>;
  } | null;
  _count?: {
    currentStudents: number;
  };
}

// Zod schema for the Add Class form (from AddNewClassPage context)
const addClassFormSchema = z.object({
  name: z.string().min(1, "Class name/level is required (e.g., Grade 1, JHS 2)."),
  section: z.string().optional().or(z.literal('')).nullable(),
  academicYear: z.string()
    .regex(/^\d{4}-\d{4}$/, "Academic year must be in YYYY-YYYY format (e.g., 2024-2025).")
    .refine(year => {
        if(!year) return false;
        const years = year.split('-');
        if (years.length !== 2 || !/^\d{4}$/.test(years[0]) || !/^\d{4}$/.test(years[1])) return false;
        return parseInt(years[0]) + 1 === parseInt(years[1]);
    }, "Academic years must be consecutive and is required."),
  homeroomTeacherId: z.string().cuid("Please select a valid teacher.").optional().nullable(),
});
type AddClassFormValues = z.infer<typeof addClassFormSchema>;

// Simplified type for teacher dropdown for Add Modal
interface SimpleTeacher {
  id: string;
  user: { // Assuming your teacher API returns user nested like this for name
    firstName: string | null;
    lastName: string | null;
  };
}


export default function ManageClassesPage() {
  const router = useRouter();
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [isLoading, setIsLoading] = useState(true); 
  const [fetchAttempted, setFetchAttempted] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const [availableTeachers, setAvailableTeachers] = useState<SimpleTeacher[]>([]);
  const [isTeachersLoading, setIsTeachersLoading] = useState(false);

  const addClassForm = useForm<AddClassFormValues>({
    resolver: zodResolver(addClassFormSchema),
    defaultValues: {
      name: '',
      section: '',
      academicYear: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
      homeroomTeacherId: null,
    }
  });

  const fetchClasses = useCallback(async (isInitialCall = false) => {
    if (isInitialCall) {
        setIsLoading(true);
    }
    console.log('[CLASSES_PAGE] fetchClasses called. InitialCall:', isInitialCall);
    setFetchAttempted(false); // Reset before fetch, will be true in finally
    
    try {
      console.log('[CLASSES_PAGE] Fetching classes from API: /api/school-admin/classes');
      const response = await fetch('/api/school-admin/classes');
      console.log('[CLASSES_PAGE] API Response Status:', response.status, response.statusText);

      const responseText = await response.text();
      let data: ClassData[] = [];

      if (!response.ok) {
        console.error('[CLASSES_PAGE] API response not OK. Status:', response.status, 'Response text:', responseText);
        let errorMessage = `Error: ${response.status} ${response.statusText || 'Failed to fetch'}`;
        try {
            const errorData = JSON.parse(responseText);
            errorMessage = errorData.message || errorMessage;
        } catch (e) {
            const previewText = responseText.length > 150 ? responseText.substring(0, 150) + "..." : responseText;
            errorMessage = `${errorMessage}. Response: ${previewText}`;
        }
        throw new Error(errorMessage);
      }
      
      if (responseText) {
        try {
            data = JSON.parse(responseText);
            console.log('[CLASSES_PAGE] Parsed API data (first item if exists):', data.length > 0 ? JSON.stringify(data[0], null, 2) : "Empty array from API");
        } catch (e: any) {
            console.error('[CLASSES_PAGE] Failed to parse API response as JSON. Raw text:', responseText, 'Error:', e);
            const previewText = responseText.length > 150 ? responseText.substring(0, 150) + "..." : responseText;
            throw new Error(`API response was not valid JSON. Status: ${response.status}. Content snippet: ${previewText}`);
        }
      } else {
        console.log('[CLASSES_PAGE] API response was empty, setting classes to [].');
      }
      
      // ***** CORRECTED FILTERING LOGIC *****
      const validClasses = Array.isArray(data) ? data.filter(cls => cls && typeof cls.name === 'string' && cls.name !== null) : [];
      if (validClasses.length !== data.length && Array.isArray(data)) {
          console.warn("[CLASSES_PAGE] Filtered out invalid class objects from API response. Original count:", data.length, "Valid count:", validClasses.length);
      }
      setClasses(validClasses);
      console.log('[CLASSES_PAGE] Classes state updated. New count:', validClasses.length);
      if(validClasses.length > 0) {
        validClasses.forEach(cls => console.log(`[CLASSES_PAGE] Class in state: ${cls.name}, Student Count from API: ${cls._count?.currentStudents}`));
      }

    } catch (error: any) {
      toast.error("Failed to load classes", { description: error.message });
      console.error("[CLASSES_PAGE] Fetch classes actual error object:", error);
      setClasses([]);
    } finally {
      setIsLoading(false);
      setFetchAttempted(true); 
      console.log('[CLASSES_PAGE] fetchClasses finished. isLoading set to false, fetchAttempted set to true.');
    }
  }, []); 

  useEffect(() => {
    console.log('[CLASSES_PAGE] Initial useEffect triggered for fetchClasses.');
    fetchClasses(true);
  }, [fetchClasses]);

  useEffect(() => {
    if (isAddModalOpen && availableTeachers.length === 0) {
      const fetchModalTeachers = async () => {
        console.log('[CLASSES_PAGE_ADD_MODAL] Fetching teachers for dropdown...');
        setIsTeachersLoading(true);
        try {
          const response = await fetch('/api/school-admin/teachers');
          if (!response.ok) {
              const errData = await response.json();
              throw new Error(errData.message || 'Failed to fetch teachers for selection.');
          }
          const data = await response.json();
          setAvailableTeachers(data);
          console.log('[CLASSES_PAGE_ADD_MODAL] Teachers for dropdown loaded.');
        } catch (error: any) {
          console.error("Failed to fetch teachers for add modal dropdown:", error);
          toast.error("Could not load teacher list for form", { description: error.message });
        } finally {
          setIsTeachersLoading(false);
        }
      };
      fetchModalTeachers();
    }
  }, [isAddModalOpen, availableTeachers.length]);

  const handleAddClassSubmit: SubmitHandler<AddClassFormValues> = async (formData) => {
    const submittingToastId = toast.loading("Adding new class...");
    try {
      const apiData = {
        ...formData,
        section: formData.section === '' ? null : formData.section,
        homeroomTeacherId: formData.homeroomTeacherId === "none" || formData.homeroomTeacherId === '' ? null : formData.homeroomTeacherId,
      };
      console.log("[CLASSES_PAGE_ADD_MODAL] Submitting new class data:", JSON.stringify(apiData, null, 2));
      const response = await fetch('/api/school-admin/classes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(apiData),
      });
      const result = await response.json();
      if (!response.ok) {
        let em = result.message || "Failed to create class.";
        if(result.errors) em = `${em} Errors: ${JSON.stringify(result.errors)}`;
        throw new Error(em);
      }
      
      toast.success(`Class "${result.name}${result.section ? ` - ${result.section}` : ''}" created!`, { id: submittingToastId });
      addClassForm.reset({ name: '', section: '', academicYear: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`, homeroomTeacherId: null });
      setIsAddModalOpen(false); 
      fetchClasses(false); 
      router.refresh(); 
    } catch (error: any) { 
        toast.error("Failed to create class", { id: submittingToastId, description: error.message });
        console.error("[CLASSES_PAGE_ADD_MODAL] Create class error:", error);
    }
  };
  
  const handleActionSuccess = () => { // For DeleteClassButton callback
    console.log('[CLASSES_PAGE] Delete action successful, re-fetching classes.');
    toast.info("Refreshing class list...");
    fetchClasses(false);
  };

  const renderSkeletons = () => Array.from({ length: 3 }).map((_, index) => (
    <TableRow key={`skeleton-class-${index}`}>
      <TableCell><Skeleton className="h-6 w-28" /></TableCell>
      <TableCell><Skeleton className="h-6 w-16" /></TableCell>
      <TableCell className="hidden sm:table-cell"><Skeleton className="h-6 w-20" /></TableCell>
      <TableCell className="hidden md:table-cell"><Skeleton className="h-6 w-32" /></TableCell>
      <TableCell className="hidden md:table-cell text-center"><Skeleton className="h-6 w-10 mx-auto" /></TableCell>
      <TableCell className="text-right"><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
    </TableRow>
  ));
  
  console.log('[CLASSES_PAGE] Rendering. isLoading:', isLoading, 'classes.length:', classes.length, 'fetchAttempted:', fetchAttempted);

  let contentToRender;
  if (isLoading && !fetchAttempted) {
    contentToRender = (
      <Table>
        <TableCaption>Loading class data...</TableCaption>
        <TableHeader>
            <TableRow>
                <TableHead>Class Name</TableHead><TableHead>Section</TableHead>
                <TableHead className="hidden sm:table-cell">Academic Year</TableHead>
                <TableHead className="hidden md:table-cell">Homeroom Teacher</TableHead>
                <TableHead className="hidden md:table-cell text-center">Students</TableHead>
                <TableHead className="text-right w-[120px]">Actions</TableHead>
            </TableRow>
        </TableHeader>
        <TableBody>{renderSkeletons()}</TableBody>
      </Table>
    );
  } else if (!isLoading && classes.length === 0 && fetchAttempted) {
    contentToRender = ( 
      <div className="text-center py-10"><BookOpenText className="mx-auto h-12 w-12 text-muted-foreground" /><h3 className="mt-2 text-sm font-medium">No classes found</h3><p className="mt-1 text-sm text-muted-foreground">Get started by adding a new class or section.</p></div>
    );
  } else if (classes.length > 0) {
    contentToRender = (
      <Table>
        <TableCaption>A list of all classes and sections in your school.</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Class Name</TableHead><TableHead>Section</TableHead>
            <TableHead className="hidden sm:table-cell">Academic Year</TableHead>
            <TableHead className="hidden md:table-cell">Homeroom Teacher</TableHead>
            <TableHead className="hidden md:table-cell text-center">Students</TableHead>
            <TableHead className="text-right w-[120px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {classes.map((cls) => {
            // More robust check against potentially malformed cls objects
            if (!cls || typeof cls.name !== 'string' || cls.name === null) { 
              console.warn("[CLASSES_PAGE] Skipping render for invalid class object in list:", cls);
              return null; 
            }
            return (
            <TableRow key={cls.id}>
              <TableCell className="font-medium">{cls.name}</TableCell>
              <TableCell>{cls.section || 'N/A'}</TableCell>
              <TableCell className="hidden sm:table-cell">{cls.academicYear}</TableCell>
              <TableCell className="hidden md:table-cell">
                {cls.homeroomTeacher && cls.homeroomTeacher.user 
                  ? `${cls.homeroomTeacher.user.firstName} ${cls.homeroomTeacher.user.lastName}` 
                  : 'N/A'}
              </TableCell>
              <TableCell className="hidden md:table-cell text-center">
                {cls._count?.currentStudents ?? 0}
              </TableCell>
              <TableCell className="text-right space-x-1">
                <Button variant="ghost" size="icon" className="mr-1" disabled title="View Details (soon)"><Eye className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="mr-1" asChild title="Edit Class">
                  <Link href={`/school-admin/classes/${cls.id}/edit`}>
                    <Edit className="h-4 w-4" />
                  </Link>
                </Button>
                <DeleteClassButton
                    classId={cls.id}
                    classNameWithSection={`${cls.name}${cls.section ? ` - ${cls.section}` : ''} (${cls.academicYear})`}
                    onDeleteSuccess={handleActionSuccess}
                />
              </TableCell>
            </TableRow>
          );
        })}
        </TableBody>
      </Table>
    );
  } else { 
    contentToRender = <p className="text-center py-10 text-muted-foreground">Could not display classes. If you've added classes, try refreshing.</p>;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div><CardTitle className="flex items-center"><BookOpenText className="mr-2 h-6 w-6" /> Manage Classes & Sections</CardTitle><CardDescription>View, add, edit, and manage classes and sections for your school.</CardDescription></div>
        <Dialog open={isAddModalOpen} onOpenChange={(open) => { if (!open) addClassForm.reset({ name: '', section: '', academicYear: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`, homeroomTeacherId: null }); setIsAddModalOpen(open);}}>
          <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4 w-4" /> Add New Class</Button></DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Add New Class/Section</DialogTitle><DialogDescription>Define a new class or section.</DialogDescription></DialogHeader>
            {isTeachersLoading ? (<div className="py-4 space-y-2"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></div>)
            : (
              <form onSubmit={addClassForm.handleSubmit(handleAddClassSubmit)} className="space-y-4 py-4">
                <div><Label htmlFor="add-class-name">Class Name/Level <span className="text-destructive">*</span></Label><Input id="add-class-name" {...addClassForm.register('name')} disabled={addClassForm.formState.isSubmitting} />{addClassForm.formState.errors.name && <p className="text-sm text-destructive mt-1">{addClassForm.formState.errors.name.message}</p>}</div>
                <div><Label htmlFor="add-class-section">Section (Optional)</Label><Input id="add-class-section" {...addClassForm.register('section')} disabled={addClassForm.formState.isSubmitting} />{addClassForm.formState.errors.section && <p className="text-sm text-destructive mt-1">{addClassForm.formState.errors.section.message}</p>}</div>
                <div><Label htmlFor="add-class-academicYear">Academic Year <span className="text-destructive">*</span></Label><Input id="add-class-academicYear" {...addClassForm.register('academicYear')} disabled={addClassForm.formState.isSubmitting} />{addClassForm.formState.errors.academicYear && <p className="text-sm text-destructive mt-1">{addClassForm.formState.errors.academicYear.message}</p>}</div>
                <div>
                  <Label htmlFor="add-class-homeroomTeacherId">Homeroom Teacher (Optional)</Label>
                  <Controller name="homeroomTeacherId" control={addClassForm.control} render={({ field }) => (
                    <Select onValueChange={(value) => field.onChange(value === "none" ? null : value)} value={field.value || "none"} disabled={addClassForm.formState.isSubmitting || isTeachersLoading || availableTeachers.length === 0}>
                      <SelectTrigger id="add-class-homeroomTeacherId"><SelectValue placeholder={isTeachersLoading ? "Loading teachers..." : (availableTeachers.length === 0 ? "No teachers available" : "Select a teacher")} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">-- None --</SelectItem>
                        {availableTeachers.map(t => <SelectItem key={t.id} value={t.id}>{t.user.firstName} {t.user.lastName}</SelectItem>)}
                      </SelectContent>
                    </Select>)}
                  />
                  {addClassForm.formState.errors.homeroomTeacherId && <p className="text-sm text-destructive mt-1">{addClassForm.formState.errors.homeroomTeacherId.message}</p>}
                </div>
                <DialogFooter className="pt-4"><DialogClose asChild><Button type="button" variant="outline" disabled={addClassForm.formState.isSubmitting}>Cancel</Button></DialogClose><Button type="submit" disabled={addClassForm.formState.isSubmitting}>{addClassForm.formState.isSubmitting ? 'Adding...' : 'Add Class'}</Button></DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {contentToRender}
      </CardContent>
      <CardFooter>
        <div className="text-xs text-muted-foreground">Total classes/sections: <strong>{classes.length}</strong></div>
      </CardFooter>
    </Card>
  );
}