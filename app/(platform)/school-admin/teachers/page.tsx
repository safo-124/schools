// app/(platform)/school-admin/teachers/page.tsx
"use client";

import React, { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation'; // For router.refresh()
import { User as PrismaUser, Teacher as PrismaTeacher } from '@prisma/client';

// Import Shadcn/ui components
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { PlusCircle, Edit, Trash2, Eye, UserCircle, Users as UsersIcon } from "lucide-react"; // Renamed Users to UsersIcon to avoid conflict
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
// import { toast } from "sonner"; // Optional, for toast notifications

interface TeacherWithUser extends PrismaTeacher {
  user: Pick<PrismaUser, 'id' | 'firstName' | 'lastName' | 'email' | 'isActive' | 'profilePicture' | 'phoneNumber'>;
}

export default function ManageTeachersPage() {
  const router = useRouter();
  const [teachers, setTeachers] = useState<TeacherWithUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // For delete confirmation dialog
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [teacherToDelete, setTeacherToDelete] = useState<TeacherWithUser | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [isPending, startTransition] = useTransition(); // For router.refresh pending state

  const fetchTeachers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/school-admin/teachers');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Error: ${response.status} ${response.statusText}`);
      }
      const data: TeacherWithUser[] = await response.json();
      setTeachers(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch teachers.');
      console.error("Fetch teachers error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTeachers();
  }, []);

  const handleDeleteInitiation = (teacher: TeacherWithUser) => {
    setTeacherToDelete(teacher);
    setIsAlertOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!teacherToDelete) return;
    setIsDeleting(true);
    setError(null); // Clear previous errors

    try {
      const response = await fetch(`/api/school-admin/teachers/${teacherToDelete.id}`, {
        method: 'DELETE',
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || 'Failed to delete teacher.');
      }
      // toast.success(`Teacher "${teacherToDelete.user.firstName} ${teacherToDelete.user.lastName}" deleted successfully.`);
      setTeachers(prevTeachers => prevTeachers.filter(t => t.id !== teacherToDelete.id)); // Optimistic UI update
      // Or re-fetch the list for consistency, especially if there's pagination or server-side sorting
      // fetchTeachers(); // This would reset isLoading state
      startTransition(() => {
        router.refresh(); // Re-runs server components and re-fetches data for the current route
      });
    } catch (err: any) {
      setError(err.message);
      // toast.error(err.message || 'Failed to delete teacher.');
      console.error("Delete teacher error:", err);
    } finally {
      setIsDeleting(false);
      setIsAlertOpen(false);
      setTeacherToDelete(null);
    }
  };


  if (isLoading && teachers.length === 0) { // Show loading only on initial load
    return (
      <Card>
        <CardHeader><CardTitle>Manage Teachers</CardTitle><CardDescription>Loading teacher data...</CardDescription></CardHeader>
        <CardContent><p>Loading...</p></CardContent>
      </Card>
    );
  }

  if (error && teachers.length === 0) { // Show error only if it prevents initial loading
    return (
      <Card>
        <CardHeader><CardTitle>Manage Teachers</CardTitle><CardDescription>Error loading teacher data</CardDescription></CardHeader>
        <CardContent><Alert variant="destructive"><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert></CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Manage Teachers</CardTitle>
            <CardDescription>View, add, and manage teachers for your school.</CardDescription>
          </div>
          <Button asChild>
            <Link href="/school-admin/teachers/new"> 
              <PlusCircle className="mr-2 h-4 w-4" /> Add New Teacher
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {/* Display general error for delete/update actions if needed, separate from initial load error */}
          {error && !isLoading && teachers.length > 0 && ( // Show non-critical errors here
             <Alert variant="destructive" className="mb-4">
                <AlertTitle>Action Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
             </Alert>
          )}
          {teachers.length === 0 && !isLoading ? (
            <div className="text-center py-10">
              <UsersIcon className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-sm font-medium">No teachers found</h3>
              <p className="mt-1 text-sm text-muted-foreground">Get started by adding a new teacher.</p>
            </div>
          ) : (
            <Table>
              <TableCaption>A list of all teachers in your school.</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Avatar</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teachers.map((teacher) => (
                  <TableRow key={teacher.id}>
                    <TableCell>
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={teacher.user.profilePicture || undefined} alt={`${teacher.user.firstName} ${teacher.user.lastName}`} />
                        <AvatarFallback>
                          {teacher.user.firstName?.charAt(0).toUpperCase()}
                          {teacher.user.lastName?.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </TableCell>
                    <TableCell className="font-medium">
                      {teacher.user.firstName} {teacher.user.lastName}
                    </TableCell>
                    <TableCell>{teacher.user.email}</TableCell>
                    <TableCell>{teacher.user.phoneNumber || 'N/A'}</TableCell>
                    <TableCell>{teacher.dateOfJoining ? new Date(teacher.dateOfJoining).toLocaleDateString() : 'N/A'}</TableCell>
                    <TableCell>
                      <Badge variant={teacher.user.isActive ? 'default' : 'outline'}
                             className={teacher.user.isActive ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'border-muted-foreground text-muted-foreground'}
                      >
                        {teacher.user.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {/* Edit Button - Now links to the edit page */}
                      <Button variant="ghost" size="icon" className="mr-1" asChild>
                        <Link href={`/school-admin/teachers/${teacher.id}/edit`}>
                          <Edit className="h-4 w-4" />
                        </Link>
                      </Button>
                      {/* Delete Button - Triggers AlertDialog */}
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteInitiation(teacher)} disabled={isDeleting && teacherToDelete?.id === teacher.id} className="text-destructive hover:text-destructive/80">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
        <CardFooter>
          <div className="text-xs text-muted-foreground">
            Total teachers: <strong>{teachers.length}</strong>
          </div>
        </CardFooter>
      </Card>

      {/* Delete Confirmation Dialog */}
      {teacherToDelete && (
        <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the teacher profile for 
                <strong> {teacherToDelete.user.firstName} {teacherToDelete.user.lastName}</strong>. 
                The associated user account will remain, but their teacher role for this school will be removed.
                If the teacher is assigned to any classes or timetables, you might need to unassign them first.
              </AlertDialogDescription>
            </AlertDialogHeader>
            {/* Display error specific to delete action if it occurs */}
            {error && teacherToDelete && <Alert variant="destructive" className="mt-2"><AlertDescription>{error}</AlertDescription></Alert>}
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setTeacherToDelete(null)} disabled={isDeleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmDelete} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                {isDeleting ? 'Deleting...' : 'Yes, Delete Teacher'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}