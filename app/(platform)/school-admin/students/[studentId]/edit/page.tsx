// app/(platform)/school-admin/students/[studentId]/edit/page.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { z } from 'zod';
import { useForm, SubmitHandler, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from "date-fns";
import { Gender, Class as PrismaClass, Student as PrismaStudent, User as PrismaUser } from '@prisma/client';

// Import Shadcn/ui components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, CheckCircle, XCircle, CalendarIcon } from "lucide-react";
// import { toast } from "sonner"; // Optional

// Zod schema for the form (should align with API's PATCH schema)
const editStudentFormSchema = z.object({
  firstName: z.string().min(1, "First name is required.").optional(),
  lastName: z.string().min(1, "Last name is required.").optional(),
  middleName: z.string().optional().or(z.literal('')).nullable(),
  studentIdNumber: z.string().min(1, "Student ID number is required.").optional(),
  dateOfBirth: z.date({ invalid_type_error: "Valid date is required."}).optional().nullable(),
  gender: z.nativeEnum(Gender).optional(),
  enrollmentDate: z.date().optional().nullable(),
  currentClassId: z.string().cuid("Please select a valid class.").optional().nullable(),
  
  address: z.string().optional().or(z.literal('')).nullable(),
  city: z.string().optional().or(z.literal('')).nullable(),
  stateOrRegion: z.string().optional().or(z.literal('')).nullable(),
  country: z.string().optional().or(z.literal('')).nullable(),
  postalCode: z.string().optional().or(z.literal('')).nullable(),
  emergencyContactName: z.string().optional().or(z.literal('')).nullable(),
  emergencyContactPhone: z.string().optional().or(z.literal('')).nullable(),
  bloodGroup: z.string().optional().or(z.literal('')).nullable(),
  allergies: z.string().optional().or(z.literal('')).nullable(),
  medicalNotes: z.string().optional().or(z.literal('')).nullable(),
  profilePictureUrl: z.string().url("Must be a valid URL if provided.").optional().or(z.literal('')).nullable(),
  isActive: z.boolean().optional(), // Student's enrollment status

  // Note: Fields for linked User account (like email) are not included here for simplicity.
  // If you need to edit linked User's email, add it to schema and handle in API.
});

type EditStudentFormValues = z.infer<typeof editStudentFormSchema>;

// Type for data fetched from API (student with optional user and class)
interface StudentDataToEdit extends PrismaStudent {
  user?: Pick<PrismaUser, 'id' | 'email' | 'isActive' | 'profilePicture'> | null;
  currentClass?: Pick<PrismaClass, 'id' | 'name' | 'section'> | null;
}

// Simplified type for class dropdown
interface SimpleClass {
  id: string;
  name: string;
  section?: string | null;
  academicYear?: string | null;
}

export default function EditStudentPage() {
  const router = useRouter();
  const params = useParams();
  const studentId = params.studentId as string;

  const [initialLoading, setInitialLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [availableClasses, setAvailableClasses] = useState<SimpleClass[]>([]);
  const [isClassesLoading, setIsClassesLoading] = useState(true);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting, dirtyFields }, // dirtyFields to know what changed
  } = useForm<EditStudentFormValues>({
    resolver: zodResolver(editStudentFormSchema),
    defaultValues: {}, // Will be populated by useEffect
  });

  // Fetch student data for pre-filling the form
  useEffect(() => {
    if (!studentId) {
        setFetchError("Student ID not found in URL.");
        setInitialLoading(false);
        return;
    };

    const fetchStudentData = async () => {
      setInitialLoading(true);
      setFetchError(null);
      try {
        const response = await fetch(`/api/school-admin/students/${studentId}`);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || `Failed to fetch student data: ${response.statusText}`);
        }
        const studentData: StudentDataToEdit = await response.json();
        
        reset({
            firstName: studentData.firstName || '',
            lastName: studentData.lastName || '',
            middleName: studentData.middleName || '',
            studentIdNumber: studentData.studentIdNumber || '',
            dateOfBirth: studentData.dateOfBirth ? new Date(studentData.dateOfBirth) : null,
            gender: studentData.gender,
            enrollmentDate: studentData.enrollmentDate ? new Date(studentData.enrollmentDate) : null,
            currentClassId: studentData.currentClassId || null,
            address: studentData.address || '',
            city: studentData.city || '',
            stateOrRegion: studentData.stateOrRegion || '',
            country: studentData.country || '',
            postalCode: studentData.postalCode || '',
            emergencyContactName: studentData.emergencyContactName || '',
            emergencyContactPhone: studentData.emergencyContactPhone || '',
            bloodGroup: studentData.bloodGroup || '',
            allergies: studentData.allergies || '',
            medicalNotes: studentData.medicalNotes || '',
            profilePictureUrl: studentData.profilePictureUrl || '',
            isActive: studentData.isActive,
        });
      } catch (err: any) {
        setFetchError(err.message);
        console.error("Fetch student data error:", err);
      } finally {
        setInitialLoading(false);
      }
    };
    fetchStudentData();
  }, [studentId, reset]);

  // Fetch available classes for the dropdown
  useEffect(() => {
    const fetchClasses = async () => {
      setIsClassesLoading(true);
      try {
        const response = await fetch('/api/school-admin/classes'); 
        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.message || 'Failed to fetch classes.');
        }
        const data: SimpleClass[] = await response.json();
        setAvailableClasses(data);
      } catch (error) {
        console.error("Failed to fetch classes for dropdown:", error);
        setFetchError(prev => prev ? `${prev}; Could not load class list.` : "Could not load class list for assignment.");
      } finally {
        setIsClassesLoading(false);
      }
    };
    fetchClasses();
  }, []);


  const onSubmit: SubmitHandler<EditStudentFormValues> = async (formData) => {
    setSubmitError(null);
    setSubmitSuccess(null);

    // Only include fields that were actually changed by the user
    const changedData: Partial<EditStudentFormValues & { dateOfBirth?: string | null, enrollmentDate?: string | null }> = {};
    let hasChanges = false;
    for (const key in dirtyFields) {
        if (dirtyFields[key as keyof EditStudentFormValues]) {
            hasChanges = true;
            const typedKey = key as keyof EditStudentFormValues;
            if (typedKey === 'dateOfBirth' || typedKey === 'enrollmentDate') {
                changedData[typedKey] = formData[typedKey] ? (formData[typedKey] as Date).toISOString() : null;
            } else if (formData[typedKey] === '') {
                 // For optional strings, send null if user cleared it and schema allows null
                changedData[typedKey] = null; 
            }
            else {
                (changedData as any)[typedKey] = formData[typedKey];
            }
        }
    }

    if (!hasChanges) {
        setSubmitError("No changes were made to submit.");
        return;
    }
    
    // console.log("Submitting Updated Student Data to API:", JSON.stringify(changedData, null, 2));

    try {
      const response = await fetch(`/api/school-admin/students/${studentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changedData),
      });

      const result = await response.json();

      if (!response.ok) {
        // console.error("API Error Response:", result);
        let errorMessage = result.message || `Error: ${response.status}`;
        if (result.errors) {
          const fieldErrors = Object.entries(result.errors as Record<string, string[]>)
            .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
            .join('; ');
          errorMessage = fieldErrors ? `Validation Error: ${fieldErrors}` : errorMessage;
        }
        setSubmitError(errorMessage);
      } else {
        setSubmitSuccess(`Student "${result.firstName} ${result.lastName}" updated successfully!`);
        // toast.success(`Student "${result.firstName} ${result.lastName}" updated successfully!`);
        // Optionally, reset form with new data if you stay on page
        // reset(mapApiDataToFormValues(result)); // You'd need a mapping function
        setTimeout(() => {
          router.push('/school-admin/students'); // Or back to student details page if you have one
          // router.refresh(); // If staying on this page and need to reflect persisted changes
        }, 2000);
      }
    } catch (err) {
      console.error("Update student error (client):", err);
      setSubmitError('An unexpected error occurred. Please try again.');
      // toast.error('An unexpected error occurred.');
    }
  };
  
  if (initialLoading) return (
    <Card className="w-full max-w-3xl mx-auto"><CardHeader><CardTitle>Edit Student</CardTitle></CardHeader><CardContent><p>Loading student data...</p></CardContent></Card>
  );
  if (fetchError && !initialLoading) return ( // Show fetch error only if not initial loading
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader><CardTitle>Error</CardTitle></CardHeader>
      <CardContent>
        <Alert variant="destructive"><AlertTitle>Failed to Load Student Data</AlertTitle><AlertDescription>{fetchError}</AlertDescription></Alert>
        <Button variant="outline" asChild className="mt-4"><Link href="/school-admin/students"><ArrowLeft className="mr-2 h-4 w-4"/>Back to Students List</Link></Button>
      </CardContent>
    </Card>
  );

  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Edit Student Information</CardTitle>
          <Button variant="outline" size="sm" asChild>
            <Link href="/school-admin/students"> {/* Or /school-admin/students/[studentId] if a view page exists */}
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Students List 
            </Link>
          </Button>
        </div>
        <CardDescription>
          Update the students details below. Only changed fields will be submitted.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4 pt-6">
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

          <h3 className="text-lg font-medium border-b pb-2">Personal Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><Label htmlFor="edit-student-firstName">First Name</Label><Input id="edit-student-firstName" {...register('firstName')} disabled={isSubmitting} />{errors.firstName && <p className="text-sm text-destructive mt-1">{errors.firstName.message}</p>}</div>
            <div><Label htmlFor="edit-student-middleName">Middle Name</Label><Input id="edit-student-middleName" {...register('middleName')} disabled={isSubmitting} /></div>
            <div><Label htmlFor="edit-student-lastName">Last Name</Label><Input id="edit-student-lastName" {...register('lastName')} disabled={isSubmitting} />{errors.lastName && <p className="text-sm text-destructive mt-1">{errors.lastName.message}</p>}</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <Label htmlFor="edit-student-dateOfBirth">Date of Birth</Label>
                <Controller name="dateOfBirth" control={control} render={({ field }) => (
                    <Popover><PopoverTrigger asChild>
                        <Button variant={"outline"} className={`w-full justify-start text-left font-normal ${!field.value && "text-muted-foreground"}`} disabled={isSubmitting}>
                        <CalendarIcon className="mr-2 h-4 w-4" />{field.value ? format(new Date(field.value), "PPP") : <span>Pick a date</span>}
                        </Button></PopoverTrigger><PopoverContent className="w-auto p-0">
                        <Calendar mode="single" selected={field.value ? new Date(field.value) : undefined} onSelect={(date) => field.onChange(date || null)} captionLayout="dropdown-buttons" fromYear={new Date().getFullYear() - 25} toYear={new Date().getFullYear() - 3} initialFocus disabled={isSubmitting}/>
                    </PopoverContent></Popover>)}
                />
                {errors.dateOfBirth && <p className="text-sm text-destructive mt-1">{errors.dateOfBirth.message}</p>}
            </div>
            <div>
              <Label htmlFor="edit-student-gender">Gender</Label>
              <Controller name="gender" control={control} render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value || ""} disabled={isSubmitting}>
                    <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
                    <SelectContent>{Object.values(Gender).map((g) => (<SelectItem key={g} value={g}>{g.charAt(0).toUpperCase() + g.slice(1).toLowerCase().replace("_", " ")}</SelectItem>))}</SelectContent>
                  </Select>)}
              />
              {errors.gender && <p className="text-sm text-destructive mt-1">{errors.gender.message}</p>}
            </div>
          </div>
          
          <h3 className="text-lg font-medium border-b pb-2 pt-4">Enrollment Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <Label htmlFor="edit-student-studentIdNumber">Student ID Number</Label>
                <Input id="edit-student-studentIdNumber" {...register('studentIdNumber')} disabled={isSubmitting} />
                {errors.studentIdNumber && <p className="text-sm text-destructive mt-1">{errors.studentIdNumber.message}</p>}
            </div>
            <div>
                <Label htmlFor="edit-student-enrollmentDate">Enrollment Date</Label>
                 <Controller name="enrollmentDate" control={control} render={({ field }) => (
                    <Popover><PopoverTrigger asChild>
                        <Button variant={"outline"} className={`w-full justify-start text-left font-normal ${!field.value && "text-muted-foreground"}`} disabled={isSubmitting}>
                        <CalendarIcon className="mr-2 h-4 w-4" />{field.value ? format(new Date(field.value), "PPP") : <span>Pick a date</span>}</Button>
                    </PopoverTrigger><PopoverContent className="w-auto p-0">
                        <Calendar mode="single" selected={field.value ? new Date(field.value) : undefined} onSelect={(date) => field.onChange(date || null)} initialFocus disabled={isSubmitting}/>
                    </PopoverContent></Popover>)}
                />
                {errors.enrollmentDate && <p className="text-sm text-destructive mt-1">{errors.enrollmentDate.message}</p>}
            </div>
          </div>
          <div>
            <Label htmlFor="edit-student-currentClassId">Assign to Class</Label>
            <Controller name="currentClassId" control={control} render={({ field }) => (
                <Select onValueChange={(value) => field.onChange(value === "none" ? null : value)} value={field.value || "none"} disabled={isSubmitting || isClassesLoading}>
                  <SelectTrigger><SelectValue placeholder={isClassesLoading ? "Loading classes..." : "Select a class or none"} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- No Class Assigned --</SelectItem>
                    {!isClassesLoading && availableClasses.length === 0 && <SelectItem value="no-classes-avail" disabled>No classes available</SelectItem>}
                    {availableClasses.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name} {c.section ? ` - ${c.section}` : ''} {c.academicYear ? `(${c.academicYear})`: ''}</SelectItem>))}
                  </SelectContent>
                </Select>)}
            />
            {errors.currentClassId && <p className="text-sm text-destructive mt-1">{errors.currentClassId.message}</p>}
          </div>
           <div className="flex items-center space-x-2 pt-2">
                <Controller name="isActive" control={control} render={({ field }) => (
                       <Checkbox id="edit-student-isActive" checked={field.value} onCheckedChange={field.onChange} disabled={isSubmitting} /> )}
                />
                <Label htmlFor="edit-student-isActive" className="text-sm font-medium leading-none">Student is Active / Enrolled</Label>
            </div>

          <h3 className="text-lg font-medium border-b pb-2 pt-4">Contact & Other Information (Optional)</h3>
            <div><Label htmlFor="edit-student-address">Address</Label><Textarea id="edit-student-address" {...register('address')} disabled={isSubmitting} /></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><Label htmlFor="edit-student-city">City</Label><Input id="edit-student-city" {...register('city')} disabled={isSubmitting} /></div>
                <div><Label htmlFor="edit-student-stateOrRegion">State/Region</Label><Input id="edit-student-stateOrRegion" {...register('stateOrRegion')} disabled={isSubmitting} /></div>
            </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><Label htmlFor="edit-student-country">Country</Label><Input id="edit-student-country" {...register('country')} disabled={isSubmitting} /></div>
                <div><Label htmlFor="edit-student-postalCode">Postal Code</Label><Input id="edit-student-postalCode" {...register('postalCode')} disabled={isSubmitting} /></div>
            </div>
            <div><Label htmlFor="edit-student-profilePictureUrl">Profile Picture URL</Label><Input id="edit-student-profilePictureUrl" type="url" {...register('profilePictureUrl')} disabled={isSubmitting} placeholder="https://example.com/image.png"/>{errors.profilePictureUrl && <p className="text-sm text-destructive mt-1">{errors.profilePictureUrl.message}</p>}</div>

          <h3 className="text-lg font-medium border-b pb-2 pt-4">Emergency Contact (Optional)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><Label htmlFor="edit-student-emergencyContactName">Contact Name</Label><Input id="edit-student-emergencyContactName" {...register('emergencyContactName')} disabled={isSubmitting} /></div>
                <div><Label htmlFor="edit-student-emergencyContactPhone">Contact Phone</Label><Input id="edit-student-emergencyContactPhone" {...register('emergencyContactPhone')} disabled={isSubmitting} /></div>
            </div>

          <h3 className="text-lg font-medium border-b pb-2 pt-4">Medical Information (Optional)</h3>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><Label htmlFor="edit-student-bloodGroup">Blood Group</Label><Input id="edit-student-bloodGroup" {...register('bloodGroup')} disabled={isSubmitting} /></div>
            </div>
            <div><Label htmlFor="edit-student-allergies">Allergies</Label><Textarea id="edit-student-allergies" {...register('allergies')} disabled={isSubmitting} /></div>
            <div><Label htmlFor="edit-student-medicalNotes">Other Medical Notes</Label><Textarea id="edit-student-medicalNotes" {...register('medicalNotes')} disabled={isSubmitting} /></div>

        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={isSubmitting || initialLoading}>
            {isSubmitting ? 'Saving Changes...' : 'Save Changes'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}