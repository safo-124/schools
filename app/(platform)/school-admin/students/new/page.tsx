// app/(platform)/school-admin/students/new/page.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { z } from 'zod';
import { useForm, SubmitHandler, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from "date-fns";
import { Gender,  } from '@prisma/client'; // Import Gender and Class type

// Import Shadcn/ui components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox"; // For isActive
import { ArrowLeft, CheckCircle, XCircle, CalendarIcon } from "lucide-react";
// import { toast } from "sonner"; // Optional

// Zod schema for the form (client-side)
const createStudentFormSchema = z.object({
  firstName: z.string().min(1, "First name is required."),
  lastName: z.string().min(1, "Last name is required."),
  middleName: z.string().optional().or(z.literal('')),
  studentIdNumber: z.string().min(1, "Student ID number is required."),
  dateOfBirth: z.date({ required_error: "Date of birth is required."}),
  gender: z.nativeEnum(Gender, { required_error: "Gender is required."}),
  enrollmentDate: z.date().optional().nullable(),
  currentClassId: z.string().cuid("Please select a valid class.").optional().nullable(),

  address: z.string().optional().or(z.literal('')),
  city: z.string().optional().or(z.literal('')),
  stateOrRegion: z.string().optional().or(z.literal('')),
  country: z.string().optional().or(z.literal('')),
  postalCode: z.string().optional().or(z.literal('')),
  emergencyContactName: z.string().optional().or(z.literal('')),
  emergencyContactPhone: z.string().optional().or(z.literal('')),
  bloodGroup: z.string().optional().or(z.literal('')),
  allergies: z.string().optional().or(z.literal('')),
  medicalNotes: z.string().optional().or(z.literal('')),
  profilePictureUrl: z.string().url("Must be a valid URL if provided.").optional().or(z.literal('')),
  isActive: z.boolean().default(true),
});

type CreateStudentFormValues = z.infer<typeof createStudentFormSchema>;

// Simplified type for class dropdown from API
interface SimpleClass {
  id: string;
  name: string;
  section?: string | null;
  academicYear?: string | null; // Good to have for display context
}

export default function AddNewStudentPage() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [availableClasses, setAvailableClasses] = useState<SimpleClass[]>([]);
  const [isClassesLoading, setIsClassesLoading] = useState(true);


  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CreateStudentFormValues>({
    resolver: zodResolver(createStudentFormSchema),
    defaultValues: {
      firstName: '', lastName: '', middleName: '', studentIdNumber: '',
      gender: undefined, 
      dateOfBirth: undefined, enrollmentDate: new Date(), 
      currentClassId: null,
      address: '', city: '', stateOrRegion: '', country: '', postalCode: '',
      emergencyContactName: '', emergencyContactPhone: '',
      bloodGroup: '', allergies: '', medicalNotes: '',
      profilePictureUrl: '', isActive: true,
    }
  });

  // Fetch available classes for the dropdown
  useEffect(() => {
    const fetchClasses = async () => {
      setIsClassesLoading(true);
      try {
        const response = await fetch('/api/school-admin/classes'); // Using the API endpoint we created
        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.message || 'Failed to fetch classes for selection.');
        }
        const data: SimpleClass[] = await response.json();
        setAvailableClasses(data);
      } catch (error) {
        console.error("Failed to fetch classes for dropdown:", error);
        // Optionally set an error state to inform the user that class selection might be unavailable
        setSubmitError("Could not load class list for assignment. Please try again later or proceed without assigning a class.");
      } finally {
        setIsClassesLoading(false);
      }
    };
    fetchClasses();
  }, []);

  const onSubmit: SubmitHandler<CreateStudentFormValues> = async (formData) => {
    setSubmitError(null);
    setSubmitSuccess(null);

    const apiData = {
      ...formData,
      dateOfBirth: formData.dateOfBirth.toISOString(),
      enrollmentDate: formData.enrollmentDate ? formData.enrollmentDate.toISOString() : new Date().toISOString(),
      currentClassId: formData.currentClassId === '' ? null : formData.currentClassId,
      // Ensure optional empty strings are handled as per API expectation (e.g., convert to null if API doesn't like "")
      // The current API schema uses .or(z.literal('')).nullable(), so sending "" for those fields is fine.
      // If API only used .optional().nullable(), then:
      // middleName: formData.middleName === '' ? null : formData.middleName,
      // etc. for all optional string fields that are not URLs.
      profilePictureUrl: formData.profilePictureUrl === '' ? null : formData.profilePictureUrl,
    };
    
    // console.log("Submitting Student Data to API:", JSON.stringify(apiData, null, 2));

    try {
      const response = await fetch('/api/school-admin/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiData),
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
        setSubmitSuccess(`Student "${result.firstName} ${result.lastName}" created successfully!`);
        // toast.success(`Student "${result.firstName} ${result.lastName}" created successfully!`);
        reset(); 
        setTimeout(() => {
          router.push('/school-admin/students'); 
        }, 2000);
      }
    } catch (err) {
      console.error("Create student error (client):", err);
      setSubmitError('An unexpected error occurred. Please try again.');
      // toast.error('An unexpected error occurred.');
    }
  };

  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Add New Student</CardTitle>
          <Button variant="outline" size="sm" asChild>
            <Link href="/school-admin/students">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Students List
            </Link>
          </Button>
        </div>
        <CardDescription>
          Fill in the details below to enroll a new student in your school.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4 pt-6">
          {submitError && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertTitle>Enrollment Failed</AlertTitle>
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
            <div>
              <Label htmlFor="firstName-student">First Name</Label>
              <Input id="firstName-student" {...register('firstName')} disabled={isSubmitting} />
              {errors.firstName && <p className="text-sm text-destructive mt-1">{errors.firstName.message}</p>}
            </div>
            <div>
              <Label htmlFor="middleName-student">Middle Name (Optional)</Label>
              <Input id="middleName-student" {...register('middleName')} disabled={isSubmitting} />
            </div>
            <div>
              <Label htmlFor="lastName-student">Last Name</Label>
              <Input id="lastName-student" {...register('lastName')} disabled={isSubmitting} />
              {errors.lastName && <p className="text-sm text-destructive mt-1">{errors.lastName.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <Label htmlFor="dateOfBirth-student">Date of Birth</Label>
                <Controller
                name="dateOfBirth"
                control={control}
                render={({ field }) => (
                    <Popover>
                    <PopoverTrigger asChild>
                        <Button
                        variant={"outline"}
                        className={`w-full justify-start text-left font-normal ${!field.value && "text-muted-foreground"}`}
                        disabled={isSubmitting}
                        >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                        <Calendar
                        mode="single"
                        selected={field.value || undefined}
                        onSelect={(date) => field.onChange(date)}
                        captionLayout="dropdown-buttons" fromYear={new Date().getFullYear() - 25} toYear={new Date().getFullYear() - 3} // Adjust year range
                        initialFocus
                        disabled={isSubmitting}
                        />
                    </PopoverContent>
                    </Popover>
                )}
                />
                {errors.dateOfBirth && <p className="text-sm text-destructive mt-1">{errors.dateOfBirth.message}</p>}
            </div>
            <div>
              <Label htmlFor="gender-student">Gender</Label>
              <Controller
                name="gender"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value || ""} disabled={isSubmitting}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(Gender).map((genderValue) => (
                        <SelectItem key={genderValue} value={genderValue}>{genderValue.charAt(0).toUpperCase() + genderValue.slice(1).toLowerCase().replace("_", " ")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.gender && <p className="text-sm text-destructive mt-1">{errors.gender.message}</p>}
            </div>
          </div>
          
          <h3 className="text-lg font-medium border-b pb-2 pt-4">Enrollment Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <Label htmlFor="studentIdNumber-student">Student ID Number</Label>
                <Input id="studentIdNumber-student" {...register('studentIdNumber')} disabled={isSubmitting} />
                {errors.studentIdNumber && <p className="text-sm text-destructive mt-1">{errors.studentIdNumber.message}</p>}
            </div>
            <div>
                <Label htmlFor="enrollmentDate-student">Enrollment Date</Label>
                 <Controller
                name="enrollmentDate"
                control={control}
                render={({ field }) => (
                    <Popover>
                    <PopoverTrigger asChild>
                        <Button
                        variant={"outline"}
                        className={`w-full justify-start text-left font-normal ${!field.value && "text-muted-foreground"}`}
                        disabled={isSubmitting}
                        >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                        <Calendar
                        mode="single"
                        selected={field.value || undefined}
                        onSelect={(date) => field.onChange(date || null)}
                        initialFocus
                        disabled={isSubmitting}
                        />
                    </PopoverContent>
                    </Popover>
                )}
                />
                {errors.enrollmentDate && <p className="text-sm text-destructive mt-1">{errors.enrollmentDate.message}</p>}
            </div>
          </div>
          <div>
            <Label htmlFor="currentClassId-student">Assign to Class (Optional)</Label>
            <Controller
              name="currentClassId"
              control={control}
              render={({ field }) => (
                <Select 
                    onValueChange={(value) => field.onChange(value === "none" ? null : value)} // Handle "none" to set null
                    value={field.value || "none"} // Use "none" for placeholder state if field.value is null/undefined
                    disabled={isSubmitting || isClassesLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={isClassesLoading ? "Loading classes..." : "Select a class or none"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- No Class Assigned --</SelectItem>
                    {!isClassesLoading && availableClasses.length === 0 && <SelectItem value="no-classes-available" disabled>No classes available</SelectItem>}
                    {availableClasses.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} {c.section ? ` - ${c.section}` : ''} {c.academicYear ? `(${c.academicYear})`: ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.currentClassId && <p className="text-sm text-destructive mt-1">{errors.currentClassId.message}</p>}
          </div>
           <div className="flex items-center space-x-2 pt-2">
                <Controller
                    name="isActive"
                    control={control}
                    render={({ field }) => (
                       <Checkbox
                            id="isActive-student"
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            disabled={isSubmitting}
                        />
                    )}
                />
                <Label htmlFor="isActive-student" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Student is Active / Enrolled
                </Label>
            </div>


          <h3 className="text-lg font-medium border-b pb-2 pt-4">Contact & Other Information (Optional)</h3>
            <div>
                <Label htmlFor="address-student">Address</Label>
                <Textarea id="address-student" {...register('address')} disabled={isSubmitting} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><Label htmlFor="city-student">City</Label><Input id="city-student" {...register('city')} disabled={isSubmitting} /></div>
                <div><Label htmlFor="stateOrRegion-student">State/Region</Label><Input id="stateOrRegion-student" {...register('stateOrRegion')} disabled={isSubmitting} /></div>
            </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><Label htmlFor="country-student">Country</Label><Input id="country-student" {...register('country')} disabled={isSubmitting} /></div>
                <div><Label htmlFor="postalCode-student">Postal Code</Label><Input id="postalCode-student" {...register('postalCode')} disabled={isSubmitting} /></div>
            </div>
             <div>
                <Label htmlFor="profilePictureUrl-student">Profile Picture URL</Label>
                <Input id="profilePictureUrl-student" type="url" {...register('profilePictureUrl')} disabled={isSubmitting} placeholder="https://example.com/image.png"/>
                {errors.profilePictureUrl && <p className="text-sm text-destructive mt-1">{errors.profilePictureUrl.message}</p>}
            </div>

          <h3 className="text-lg font-medium border-b pb-2 pt-4">Emergency Contact (Optional)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><Label htmlFor="emergencyContactName-student">Contact Name</Label><Input id="emergencyContactName-student" {...register('emergencyContactName')} disabled={isSubmitting} /></div>
                <div><Label htmlFor="emergencyContactPhone-student">Contact Phone</Label><Input id="emergencyContactPhone-student" {...register('emergencyContactPhone')} disabled={isSubmitting} /></div>
            </div>

          <h3 className="text-lg font-medium border-b pb-2 pt-4">Medical Information (Optional)</h3>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><Label htmlFor="bloodGroup-student">Blood Group</Label><Input id="bloodGroup-student" {...register('bloodGroup')} disabled={isSubmitting} /></div>
            </div>
            <div>
                <Label htmlFor="allergies-student">Allergies</Label>
                <Textarea id="allergies-student" {...register('allergies')} disabled={isSubmitting} />
            </div>
            <div>
                <Label htmlFor="medicalNotes-student">Other Medical Notes</Label>
                <Textarea id="medicalNotes-student" {...register('medicalNotes')} disabled={isSubmitting} />
            </div>


        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={isSubmitting || isClassesLoading}>
            {isSubmitting ? 'Adding Student...' : 'Add Student'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}