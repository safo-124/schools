// app/(platform)/school-admin/classes/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { 
    Class as PrismaClass, 
    Teacher as PrismaTeacher, 
    User as PrismaUser 
} from '@prisma/client';

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
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { PlusCircle, Edit, Eye, BookOpenText } from "lucide-react";
import { DeleteClassButton } from '@/components/school-admin/classes/DeleteClassButton';

interface ClassData extends Omit<PrismaClass, 'homeroomTeacherId' | 'schoolId'> {
  homeroomTeacher?: {
    id: string;
    user: Pick<PrismaUser, 'firstName' | 'lastName'>;
  } | null;
  _count?: {
    currentStudents: number;
  };
}

export default function ManageClassesPage() {
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchAttempted, setFetchAttempted] = useState(false); // To track if fetch has run

  const fetchClasses = useCallback(async () => {
    console.log('[CLASSES_PAGE] fetchClasses called. Current isLoading:', isLoading);
    if (!isLoading && fetchAttempted) setIsLoading(true); // Set loading for re-fetches
    
    try {
      console.log('[CLASSES_PAGE] Fetching classes from API...');
      const response = await fetch('/api/school-admin/classes');
      console.log('[CLASSES_PAGE] API Response Status:', response.status, response.statusText);

      const responseText = await response.text(); // Get text first to avoid JSON parse error on empty/non-JSON
      let data: ClassData[];

      if (!response.ok) {
        console.error('[CLASSES_PAGE] API response not OK. Response text:', responseText);
        let errorMessage = `Error: ${response.status} ${response.statusText}`;
        try {
            const errorData = JSON.parse(responseText); // Try to parse error JSON
            errorMessage = errorData.message || errorMessage;
        } catch (e) {
            // Response was not JSON or message field was missing
            errorMessage = `${errorMessage}. Response: ${responseText.substring(0,100)}...`;
        }
        throw new Error(errorMessage);
      }
      
      try {
          data = JSON.parse(responseText);
          console.log('[CLASSES_PAGE] Parsed API data:', data);
      } catch (e) {
          console.error('[CLASSES_PAGE] Failed to parse API response as JSON. Raw text:', responseText);
          throw new Error(`API response was not valid JSON. Status: ${response.status}. Content: ${responseText.substring(0,100)}...`);
      }
      
      setClasses(data);
      console.log('[CLASSES_PAGE] Classes state updated. Count:', data.length);
    } catch (err: any) {
      toast.error("Failed to fetch classes", { description: err.message });
      console.error("[CLASSES_PAGE] Fetch classes error object:", err);
    } finally {
      setIsLoading(false);
      setFetchAttempted(true);
    }
  }, [isLoading, fetchAttempted]); // Added dependencies to useCallback

  useEffect(() => {
    console.log('[CLASSES_PAGE] Initial useEffect triggered.');
    setIsLoading(true); // Explicitly set loading for initial fetch
    fetchClasses();
  }, [fetchClasses]); // fetchClasses is now correctly a dependency

  const handleActionSuccess = () => {
    console.log('[CLASSES_PAGE] handleActionSuccess called, re-fetching classes.');
    toast.info("Refreshing class list...");
    // We want to ensure isLoading is true when fetchClasses is called by this handler
    setFetchAttempted(false); // Reset fetchAttempted to allow setIsLoading in fetchClasses
    setIsLoading(true);      // Set loading before calling fetchClasses
    fetchClasses();
  };

  const renderSkeletons = () => (
    Array.from({ length: 3 }).map((_, index) => (
      <TableRow key={`skeleton-class-${index}`}>
        <TableCell><Skeleton className="h-6 w-28" /></TableCell>
        <TableCell><Skeleton className="h-6 w-16" /></TableCell>
        <TableCell className="hidden sm:table-cell"><Skeleton className="h-6 w-20" /></TableCell>
        <TableCell className="hidden md:table-cell"><Skeleton className="h-6 w-32" /></TableCell>
        <TableCell className="hidden md:table-cell text-center"><Skeleton className="h-6 w-10 mx-auto" /></TableCell>
        <TableCell className="text-right"><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
      </TableRow>
    ))
  );
  
  console.log('[CLASSES_PAGE] Rendering. isLoading:', isLoading, 'classes.length:', classes.length, 'fetchAttempted:', fetchAttempted);


  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Manage Classes & Sections</CardTitle>
          <CardDescription>View, add, and manage classes and sections for your school.</CardDescription>
        </div>
        <Button asChild>
          <Link href="/school-admin/classes/new"> 
            <PlusCircle className="mr-2 h-4 w-4" /> Add New Class
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading && classes.length === 0 ? ( // Show skeletons only on initial load AND if no classes yet
             <Table>
                <TableCaption>Loading class data...</TableCaption>
                <TableHeader>
                    <TableRow>
                        <TableHead>Class Name</TableHead>
                        <TableHead>Section</TableHead>
                        <TableHead className="hidden sm:table-cell">Academic Year</TableHead>
                        <TableHead className="hidden md:table-cell">Homeroom Teacher</TableHead>
                        <TableHead className="hidden md:table-cell text-center">Students</TableHead>
                        <TableHead className="text-right w-[120px]">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {renderSkeletons()}
                </TableBody>
            </Table>
        ) : !isLoading && classes.length === 0 && fetchAttempted ? ( // Show "No classes" only after fetch attempt and still no classes
          <div className="text-center py-10">
            <BookOpenText className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-2 text-sm font-medium">No classes found</h3>
            <p className="mt-1 text-sm text-muted-foreground">Get started by adding a new class or section.</p>
          </div>
        ) : ( // Render table if not initial loading OR if classes are present
          <Table>
            <TableCaption>A list of all classes and sections in your school.</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Class Name</TableHead>
                <TableHead>Section</TableHead>
                <TableHead className="hidden sm:table-cell">Academic Year</TableHead>
                <TableHead className="hidden md:table-cell">Homeroom Teacher</TableHead>
                <TableHead className="hidden md:table-cell text-center">Students</TableHead>
                <TableHead className="text-right w-[120px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {classes.map((cls) => (
                <TableRow key={cls.id}>
                  <TableCell className="font-medium">{cls.name}</TableCell>
                  <TableCell>{cls.section || 'N/A'}</TableCell>
                  <TableCell className="hidden sm:table-cell">{cls.academicYear}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    {cls.homeroomTeacher 
                      ? `${cls.homeroomTeacher.user.firstName} ${cls.homeroomTeacher.user.lastName}` 
                      : 'N/A'}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-center">
                    {cls._count?.currentStudents ?? 0}
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="icon" className="mr-1" disabled title="View Details (soon)">
                      <Eye className="h-4 w-4" />
                    </Button>
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
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <CardFooter>
        <div className="text-xs text-muted-foreground">
          Total classes/sections: <strong>{classes.length}</strong>
        </div>
      </CardFooter>
    </Card>
  );
}