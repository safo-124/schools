// app/(platform)/school-admin/timetable/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link'; // Not used directly but good to have for potential future links
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { useForm, SubmitHandler, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { 
    DayOfWeek, 
    Class as PrismaClass, 
    Subject as PrismaSubject, 
    User as PrismaUser,
    TimetableSlot as PrismaTimetableSlot
} from '@prisma/client';

// Shadcn/ui components
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { PlusCircle, CalendarClock, Edit, Trash2 } from "lucide-react";

// Types for fetched data
interface SimpleClass { id: string; name: string; section?: string | null; academicYear?: string | null }
interface SimpleSubject { id: string; name: string; code?: string | null }
interface SimpleTeacher { id: string; user: { firstName: string | null; lastName: string | null; }}
interface TimetableSlotWithDetails extends PrismaTimetableSlot {
  class: Pick<PrismaClass, 'id' | 'name' | 'section'>;
  subject: Pick<PrismaSubject, 'id' | 'name'>;
  teacher: { user: Pick<PrismaUser, 'id' | 'firstName' | 'lastName'> };
}

// Zod schema for the Add/Edit Timetable Slot form
const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
const timetableSlotFormSchema = z.object({
  classId: z.string().cuid("Please select a class."),
  subjectId: z.string().cuid("Please select a subject."),
  teacherId: z.string().cuid("Please select a teacher."),
  dayOfWeek: z.nativeEnum(DayOfWeek, { required_error: "Please select a day."}),
  startTime: z.string().regex(timeRegex, "Invalid start time (HH:MM)."),
  endTime: z.string().regex(timeRegex, "Invalid end time (HH:MM)."),
  room: z.string().optional().or(z.literal('')).nullable(),
}).refine(data => {
    if (data.startTime && data.endTime) {
        return data.endTime > data.startTime; // Basic check
    }
    return true;
}, { message: "End time must be after start time.", path: ["endTime"] });

type TimetableSlotFormValues = z.infer<typeof timetableSlotFormSchema>;

export default function ManageTimetablePage() {
  const router = useRouter();
  const [timetableSlots, setTimetableSlots] = useState<TimetableSlotWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // State for dropdowns in the modal form
  const [availableClasses, setAvailableClasses] = useState<SimpleClass[]>([]);
  const [availableSubjects, setAvailableSubjects] = useState<SimpleSubject[]>([]);
  const [availableTeachers, setAvailableTeachers] = useState<SimpleTeacher[]>([]);
  const [isDropdownDataLoading, setIsDropdownDataLoading] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting: isFormSubmitting },
  } = useForm<TimetableSlotFormValues>({
    resolver: zodResolver(timetableSlotFormSchema),
    defaultValues: { room: '', dayOfWeek: undefined, classId: undefined, subjectId: undefined, teacherId: undefined }
  });

  const fetchTimetableSlots = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/school-admin/timetable');
      if (!response.ok) throw new Error('Failed to fetch timetable slots.');
      const data = await response.json();
      setTimetableSlots(data);
    } catch (error: any) {
      toast.error("Failed to load timetable", { description: error.message });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTimetableSlots();
  }, [fetchTimetableSlots]);

  // Fetch data for form dropdowns when modal is about to open
  useEffect(() => {
    if (isAddModalOpen && (availableClasses.length === 0 || availableSubjects.length === 0 || availableTeachers.length === 0)) {
      const fetchDropdownData = async () => {
        setIsDropdownDataLoading(true);
        try {
          const [classesRes, subjectsRes, teachersRes] = await Promise.all([
            fetch('/api/school-admin/classes?simple=true'),
            fetch('/api/school-admin/subjects'), // Assuming this returns simple list or adapt
            fetch('/api/school-admin/teachers')  // Assuming this returns simple list or adapt
          ]);
          if (!classesRes.ok) throw new Error('Failed to fetch classes');
          if (!subjectsRes.ok) throw new Error('Failed to fetch subjects');
          if (!teachersRes.ok) throw new Error('Failed to fetch teachers');
          
          setAvailableClasses(await classesRes.json());
          setAvailableSubjects(await subjectsRes.json());
          setAvailableTeachers(await teachersRes.json());
          
        } catch (error: any) {
          toast.error("Failed to load data for form", { description: error.message });
        } finally {
          setIsDropdownDataLoading(false);
        }
      };
      fetchDropdownData();
    }
  }, [isAddModalOpen]); // Re-fetch if modal opens and data isn't there

  const handleAddSlotSubmit: SubmitHandler<TimetableSlotFormValues> = async (formData) => {
    try {
      const response = await fetch('/api/school-admin/timetable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || "Failed to create timetable slot.");
      }
      toast.success("Timetable slot created successfully!");
      reset();
      setIsAddModalOpen(false);
      fetchTimetableSlots(); // Re-fetch the main list
      router.refresh(); // Revalidate server data
    } catch (error: any) {
      toast.error("Failed to create slot", { description: error.message });
      console.error("Add timetable slot error:", error);
    }
  };
  
  // Helper to format DayOfWeek for display
  const formatDay = (day: DayOfWeek) => day.charAt(0) + day.slice(1).toLowerCase();

  const renderSkeletons = () => Array.from({ length: 5 }).map((_, index) => (
    <TableRow key={`skeleton-slot-${index}`}>
        <TableCell><Skeleton className="h-6 w-20" /></TableCell>
        <TableCell><Skeleton className="h-6 w-24" /></TableCell>
        <TableCell><Skeleton className="h-6 w-24" /></TableCell>
        <TableCell className="hidden sm:table-cell"><Skeleton className="h-6 w-32" /></TableCell>
        <TableCell className="hidden md:table-cell"><Skeleton className="h-6 w-20" /></TableCell>
        <TableCell className="hidden lg:table-cell"><Skeleton className="h-6 w-16" /></TableCell>
        <TableCell className="text-right"><Skeleton className="h-8 w-20" /></TableCell>
    </TableRow>
  ));


  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Manage Timetable</CardTitle>
          <CardDescription>View and schedule classes for your school.</CardDescription>
        </div>
        <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" /> Add Timetable Slot
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Add New Timetable Slot</DialogTitle>
              <DialogDescription>Schedule a new class period.</DialogDescription>
            </DialogHeader>
            {isDropdownDataLoading ? (
                <div className="space-y-4 py-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                </div>
            ) : (
            <form onSubmit={handleSubmit(handleAddSlotSubmit)} className="space-y-4">
              <div>
                <Label htmlFor="dayOfWeek">Day of the Week</Label>
                <Controller name="dayOfWeek" control={control} render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value || ""} disabled={isFormSubmitting}>
                    <SelectTrigger><SelectValue placeholder="Select day" /></SelectTrigger>
                    <SelectContent>{Object.values(DayOfWeek).map(day => <SelectItem key={day} value={day}>{formatDay(day)}</SelectItem>)}</SelectContent>
                  </Select>)}
                />
                {errors.dayOfWeek && <p className="text-sm text-destructive mt-1">{errors.dayOfWeek.message}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="startTime">Start Time (HH:MM)</Label>
                  <Input id="startTime" type="time" {...register('startTime')} disabled={isFormSubmitting} />
                  {errors.startTime && <p className="text-sm text-destructive mt-1">{errors.startTime.message}</p>}
                </div>
                <div>
                  <Label htmlFor="endTime">End Time (HH:MM)</Label>
                  <Input id="endTime" type="time" {...register('endTime')} disabled={isFormSubmitting} />
                  {errors.endTime && <p className="text-sm text-destructive mt-1">{errors.endTime.message}</p>}
                </div>
              </div>
              <div>
                <Label htmlFor="classId">Class</Label>
                <Controller name="classId" control={control} render={({ field }) => (
                  <Select onValueChange={(value) => field.onChange(value === "none" ? null : value)} value={field.value || "none"} disabled={isFormSubmitting || availableClasses.length === 0}>
                    <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                    <SelectContent>{availableClasses.length > 0 ? <SelectItem value="none">-- Select --</SelectItem> : <SelectItem value="no-opt" disabled>No classes</SelectItem>}
                      {availableClasses.map(c => <SelectItem key={c.id} value={c.id}>{c.name} {c.section || ''} ({c.academicYear})</SelectItem>)}</SelectContent>
                  </Select>)}
                />
                {errors.classId && <p className="text-sm text-destructive mt-1">{errors.classId.message}</p>}
              </div>
              <div>
                <Label htmlFor="subjectId">Subject</Label>
                 <Controller name="subjectId" control={control} render={({ field }) => (
                  <Select onValueChange={(value) => field.onChange(value === "none" ? null : value)} value={field.value || "none"} disabled={isFormSubmitting || availableSubjects.length === 0}>
                    <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                    <SelectContent>{availableSubjects.length > 0 ? <SelectItem value="none">-- Select --</SelectItem> : <SelectItem value="no-opt" disabled>No subjects</SelectItem>}
                      {availableSubjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name} {s.code ? `(${s.code})` : ''}</SelectItem>)}</SelectContent>
                  </Select>)}
                />
                {errors.subjectId && <p className="text-sm text-destructive mt-1">{errors.subjectId.message}</p>}
              </div>
              <div>
                <Label htmlFor="teacherId">Teacher</Label>
                <Controller name="teacherId" control={control} render={({ field }) => (
                  <Select onValueChange={(value) => field.onChange(value === "none" ? null : value)} value={field.value || "none"} disabled={isFormSubmitting || availableTeachers.length === 0}>
                    <SelectTrigger><SelectValue placeholder="Select teacher" /></SelectTrigger>
                    <SelectContent>{availableTeachers.length > 0 ? <SelectItem value="none">-- Select --</SelectItem> : <SelectItem value="no-opt" disabled>No teachers</SelectItem>}
                      {availableTeachers.map(t => <SelectItem key={t.id} value={t.id}>{t.user.firstName} {t.user.lastName}</SelectItem>)}</SelectContent>
                  </Select>)}
                />
                {errors.teacherId && <p className="text-sm text-destructive mt-1">{errors.teacherId.message}</p>}
              </div>
              <div>
                <Label htmlFor="room">Room (Optional)</Label>
                <Input id="room" {...register('room')} placeholder="e.g., Room 101, Science Lab" disabled={isFormSubmitting} />
                {errors.room && <p className="text-sm text-destructive mt-1">{errors.room.message}</p>}
              </div>
              <DialogFooter className="pt-4">
                <DialogClose asChild><Button type="button" variant="outline" disabled={isFormSubmitting}>Cancel</Button></DialogClose>
                <Button type="submit" disabled={isFormSubmitting}>
                  {isFormSubmitting ? 'Adding Slot...' : 'Add Slot'}
                </Button>
              </DialogFooter>
            </form>
            )}
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading && timetableSlots.length === 0 ? (
            <Table>
              <TableCaption>Loading timetable data...</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Day</TableHead><TableHead>Time</TableHead><TableHead>Class</TableHead>
                  <TableHead className="hidden sm:table-cell">Subject</TableHead><TableHead className="hidden md:table-cell">Teacher</TableHead>
                  <TableHead className="hidden lg:table-cell">Room</TableHead><TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>{renderSkeletons()}</TableBody>
            </Table>
        ) : !isLoading && timetableSlots.length === 0 ? (
          <div className="text-center py-10"><CalendarClock className="mx-auto h-12 w-12 text-muted-foreground" /><h3 className="mt-2 text-sm font-medium">No timetable slots found.</h3><p className="mt-1 text-sm text-muted-foreground">Get started by adding a new slot.</p></div>
        ) : (
          <Table>
            <TableCaption>Current timetable schedule.</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Day</TableHead><TableHead>Time</TableHead><TableHead>Class</TableHead>
                <TableHead className="hidden sm:table-cell">Subject</TableHead><TableHead className="hidden md:table-cell">Teacher</TableHead>
                <TableHead className="hidden lg:table-cell">Room</TableHead><TableHead className="text-right w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {timetableSlots
                .sort((a, b) => { // Client-side sort for DayOfWeek then startTime
                    const dayOrder = Object.values(DayOfWeek);
                    const dayA = dayOrder.indexOf(a.dayOfWeek);
                    const dayB = dayOrder.indexOf(b.dayOfWeek);
                    if (dayA !== dayB) return dayA - dayB;
                    if (a.startTime < b.startTime) return -1;
                    if (a.startTime > b.startTime) return 1;
                    return 0;
                })
                .map((slot) => (
                <TableRow key={slot.id}>
                  <TableCell className="font-medium">{formatDay(slot.dayOfWeek)}</TableCell>
                  <TableCell>{slot.startTime} - {slot.endTime}</TableCell>
                  <TableCell>{slot.class.name} {slot.class.section || ''}</TableCell>
                  <TableCell className="hidden sm:table-cell">{slot.subject.name}</TableCell>
                  <TableCell className="hidden md:table-cell">{slot.teacher.user.firstName} {slot.teacher.user.lastName}</TableCell>
                  <TableCell className="hidden lg:table-cell">{slot.room || 'N/A'}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="icon" disabled title="Edit (soon)"><Edit className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" disabled className="text-destructive" title="Delete (soon)"><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <CardFooter>
        <div className="text-xs text-muted-foreground">Total timetable slots: <strong>{timetableSlots.length}</strong></div>
      </CardFooter>
    </Card>
  );
}