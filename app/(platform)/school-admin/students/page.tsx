// app/(platform)/school-admin/students/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from 'react'; // Added useCallback
import Link from 'next/link';
// useRouter is not directly needed here if DeleteStudentButton handles its own refresh or parent calls fetchStudents
import { User as PrismaUser, Student as PrismaStudent, Class as PrismaClass } from '@prisma/client';

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
import { PlusCircle, Edit, Eye, Users as UsersIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { DeleteStudentButton } from '@/components/school-admin/students/DeleteStudentButton';

interface StudentData extends PrismaStudent {
  user?: Pick<PrismaUser, 'email' | 'isActive' | 'profilePicture'> | null;
  currentClass?: Pick<PrismaClass, 'id' | 'name' | 'section'> | null;
}

export default function ManageStudentsPage() {
  const [students, setStudents] = useState<StudentData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // isPending from useTransition is not needed here anymore if DeleteStudentButton handles its own transition

  // useCallback ensures fetchStudents function identity is stable across re-renders
  // unless its dependencies change (none in this case, but good practice).
  const fetchStudents = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/school-admin/students');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Error: ${response.status} ${response.statusText}`);
      }
      const data: StudentData[] = await response.json();
      setStudents(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch students.');
      console.error("Fetch students error:", err);
    } finally {
      setIsLoading(false);
    }
  }, []); // Empty dependency array for useCallback

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]); // fetchStudents is now a dependency

  const handleStudentDeleted = () => {
    // This function is called by DeleteStudentButton on success.
    // We re-fetch the students list to update the UI.
    console.log("Student deleted, re-fetching student list...");
    fetchStudents(); 
    // Optionally, you could show a page-level success message here too.
  };


  if (isLoading && students.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle>Manage Students</CardTitle><CardDescription>Loading student data...</CardDescription></CardHeader>
        <CardContent><p>Loading...</p></CardContent>
      </Card>
    );
  }

  if (error && students.length === 0) { // Only show full page error if initial load fails
    return (
      <Card>
        <CardHeader><CardTitle>Manage Students</CardTitle><CardDescription>Error loading student data</CardDescription></CardHeader>
        <CardContent><Alert variant="destructive"><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert></CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Manage Students</CardTitle>
          <CardDescription>View, add, and manage students in your school.</CardDescription>
        </div>
        <Button asChild>
          <Link href="/school-admin/students/new"> 
            <PlusCircle className="mr-2 h-4 w-4" /> Add New Student
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {/* Display non-critical errors (e.g., from a failed delete that didn't stop page from loading) */}
        {error && !isLoading && students.length > 0 && (
            <Alert variant="destructive" className="mb-4">
            <AlertTitle>An Action Error Occurred</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
            </Alert>
        )}
        {students.length === 0 && !isLoading ? (
          <div className="text-center py-10">
            <UsersIcon className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-2 text-sm font-medium">No students found</h3>
            <p className="mt-1 text-sm text-muted-foreground">Get started by adding a new student.</p>
          </div>
        ) : (
          <Table>
            <TableCaption>A list of all students in your school.</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">Avatar</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="hidden sm:table-cell">Student ID</TableHead>
                <TableHead>Class</TableHead>
                <TableHead className="hidden md:table-cell">Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right w-[120px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((student) => (
                <TableRow key={student.id}>
                  <TableCell>
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={student.profilePictureUrl || student.user?.profilePicture || undefined} alt={`${student.firstName} ${student.lastName}`} />
                      <AvatarFallback>
                        {student.firstName?.charAt(0).toUpperCase()}
                        {student.lastName?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </TableCell>
                  <TableCell className="font-medium">
                    {student.firstName} {student.lastName}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell font-mono text-xs">{student.studentIdNumber}</TableCell>
                  <TableCell>
                    {student.currentClass 
                      ? `${student.currentClass.name}${student.currentClass.section ? ` - ${student.currentClass.section}` : ''}` 
                      : 'N/A'}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{student.user?.email || 'N/A'}</TableCell>
                  <TableCell>
                    <Badge variant={student.isActive ? 'default' : 'outline'}
                           className={student.isActive ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'border-muted-foreground text-muted-foreground'}
                    >
                      {student.isActive ? 'Active' : 'Withdrawn'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="icon" className="mr-1" disabled title="View Details (soon)">
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="mr-1" asChild title="Edit Student">
                      <Link href={`/school-admin/students/${student.id}/edit`}>
                        <Edit className="h-4 w-4" />
                      </Link>
                    </Button>
                    <DeleteStudentButton 
                        studentId={student.id}
                        studentName={`${student.firstName} ${student.lastName}`}
                        onDeleteSuccess={handleStudentDeleted} // Pass the re-fetch function
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <CardFooter>
        <div className="text-xs text-muted-foreground">
          Total students: <strong>{students.length}</strong>
        </div>
      </CardFooter>
    </Card>
  );
}