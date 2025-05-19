// app/(platform)/school-admin/students/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
import { Switch } from "@/components/ui/switch"; // For the active/inactive filter toggle
import { Label } from "@/components/ui/label";   // For the toggle label
import { PlusCircle, Edit, Eye, Users as UsersIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

// Import the custom ToggleStudentStatusButton component
import { ToggleStudentStatusButton } from '@/components/school-admin/students/ToggleStudentStatusButton'; // Adjust path

interface StudentData extends PrismaStudent {
  user?: Pick<PrismaUser, 'email' | 'isActive' | 'profilePicture'> | null; // user.isActive is linked user account status
  currentClass?: Pick<PrismaClass, 'id' | 'name' | 'section'> | null;
}

export default function ManageStudentsPage() {
  const router = useRouter();
  const [students, setStudents] = useState<StudentData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchAttempted, setFetchAttempted] = useState(false);
  const [showInactive, setShowInactive] = useState(false); // State for toggling view

  const fetchStudents = useCallback(async (isInitialLoad = false) => {
    if(isInitialLoad) setIsLoading(true);
    setFetchAttempted(false);
    setError(null);
    try {
      // API now fetches based on activeOnly parameter if not specified,
      // or fetches all if activeOnly is false. Let's adjust API or client call.
      // For now, client decides what to fetch based on showInactive state.
      const apiUrl = showInactive ? '/api/school-admin/students' : '/api/school-admin/students?activeOnly=true';
      console.log(`[STUDENTS_PAGE] Fetching students from: ${apiUrl}`);
      
      const response = await fetch(apiUrl); 
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Error: ${response.status} ${response.statusText}`);
      }
      const data: StudentData[] = await response.json();
      setStudents(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch students.');
      toast.error("Failed to load students", { description: err.message });
      console.error("Fetch students error:", err);
      setStudents([]);
    } finally {
      if(isInitialLoad) setIsLoading(false);
      setFetchAttempted(true);
    }
  }, [showInactive]); // Re-fetch when showInactive changes

  useEffect(() => {
    fetchStudents(true);
  }, [fetchStudents]); // fetchStudents itself depends on showInactive

  const handleActionSuccess = () => {
    toast.info("Refreshing student list...");
    fetchStudents(false); 
  };

  const renderSkeletons = () => Array.from({ length: 5 }).map((_, index) => (
    <TableRow key={`skeleton-student-${index}`}>
        <TableCell><Skeleton className="h-9 w-9 rounded-full" /></TableCell>
        <TableCell><Skeleton className="h-6 w-32" /></TableCell>
        <TableCell className="hidden sm:table-cell"><Skeleton className="h-6 w-20" /></TableCell>
        <TableCell><Skeleton className="h-6 w-24" /></TableCell>
        <TableCell className="hidden md:table-cell"><Skeleton className="h-6 w-40" /></TableCell>
        <TableCell><Skeleton className="h-6 w-20" /></TableCell> {/* Enrollment Status */}
        <TableCell><Skeleton className="h-6 w-20" /></TableCell> {/* User Account Status */}
        <TableCell className="text-right"><Skeleton className="h-8 w-24" /></TableCell>
    </TableRow>
  ));

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <CardTitle>Manage Students</CardTitle>
          <CardDescription>View, add, and manage students in your school.</CardDescription>
        </div>
        <div className="flex items-center space-x-2">
            <Switch
                id="show-inactive-students"
                checked={showInactive}
                onCheckedChange={setShowInactive}
            />
            <Label htmlFor="show-inactive-students" className="text-sm">Show Inactive Students</Label>
        </div>
        <Button asChild>
          <Link href="/school-admin/students/new"> 
            <PlusCircle className="mr-2 h-4 w-4" /> Add New Student
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {error && !isLoading && students.length === 0 && fetchAttempted && (
            <Alert variant="destructive" className="mb-4">
            <AlertTitle>Error Loading Students</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
            </Alert>
        )}
        {(isLoading && !fetchAttempted) ? (
             <Table>
              <TableCaption>Loading student data...</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">Avatar</TableHead><TableHead>Name</TableHead>
                  <TableHead className="hidden sm:table-cell">Student ID</TableHead><TableHead>Class</TableHead>
                  <TableHead className="hidden md:table-cell">Email</TableHead>
                  <TableHead>Enroll. Status</TableHead>
                  <TableHead className="hidden lg:table-cell">User Acc. Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>{renderSkeletons()}</TableBody>
            </Table>
        ) : !isLoading && students.length === 0 && fetchAttempted ? (
          <div className="text-center py-10">
            <UsersIcon className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-2 text-sm font-medium">No {showInactive ? "inactive" : "active"} students found.</h3>
            <p className="mt-1 text-sm text-muted-foreground">
                {showInactive ? "There are no students marked as inactive." : "Get started by adding a new student or check the 'Show Inactive Students' filter."}
            </p>
          </div>
        ) : (
          <Table>
            <TableCaption>A list of {showInactive ? "inactive" : "active"} students in your school.</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">Avatar</TableHead><TableHead>Name</TableHead>
                <TableHead className="hidden sm:table-cell">Student ID</TableHead><TableHead>Class</TableHead>
                <TableHead className="hidden md:table-cell">Email</TableHead>
                <TableHead>Enroll. Status</TableHead>
                <TableHead className="hidden lg:table-cell">User Acc. Status</TableHead>
                <TableHead className="text-right w-[120px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((student) => (
                <TableRow key={student.id} className={!student.isActive ? "opacity-60" : ""}>
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
                  <TableCell> {/* Student Enrollment Status */}
                    <Badge variant={student.isActive ? 'default' : 'outline'}
                           className={student.isActive ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'border-orange-400 text-orange-600'}
                    >
                      {student.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                   <TableCell className="hidden lg:table-cell"> {/* Linked User Account Status */}
                    {student.user ? (
                        <Badge variant={student.user.isActive ? 'default' : 'outline'}
                               className={student.user.isActive ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'border-muted-foreground text-muted-foreground'}
                        >
                        {student.user.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                    ) : (
                        <Badge variant="secondary">No Account</Badge>
                    )}
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
                    <ToggleStudentStatusButton 
                        student={student} // Pass the whole student object or necessary parts
                        onActionSuccess={handleActionSuccess}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <CardFooter>
        <div className="text-xs text-muted-foreground">Total {showInactive ? "inactive" : "active"} students: <strong>{students.length}</strong></div>
      </CardFooter>
    </Card>
  );
}