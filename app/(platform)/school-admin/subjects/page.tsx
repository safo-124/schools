// app/(platform)/school-admin/subjects/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation'; // useRouter for router.refresh if used in parent
import { Subject as PrismaSubject } from '@prisma/client';

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
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { PlusCircle, Edit, Eye, BookMarked } from "lucide-react"; // Trash2 icon is in DeleteSubjectButton

// Import the custom DeleteSubjectButton component
import { DeleteSubjectButton } from '@/components/school-admin/subjects/DeleteSubjectButton'; // Adjust path if needed

// Define the expected structure of a subject object from the API
type Subject = PrismaSubject;

export default function ManageSubjectsPage() {
  const router = useRouter(); // Not strictly needed if DeleteSubjectButton handles its own refresh
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // Errors are primarily handled by toasts from actions or initial fetch

  const fetchSubjects = useCallback(async () => {
    // setIsLoading(true); // Set true for initial load, manage for re-fetches if needed
    try {
      const response = await fetch('/api/school-admin/subjects');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Error: ${response.status} ${response.statusText}`);
      }
      const data: Subject[] = await response.json();
      setSubjects(data);
    } catch (err: any) {
      toast.error("Failed to fetch subjects", { description: err.message });
      console.error("Fetch subjects error:", err);
    } finally {
      setIsLoading(false); // Ensure this is set after fetch attempt
    }
  }, []);

  useEffect(() => {
    setIsLoading(true); // For initial load
    fetchSubjects();
  }, [fetchSubjects]);

  const handleActionSuccess = () => {
    // This function is called by DeleteSubjectButton's onDeleteSuccess prop
    // It explicitly re-fetches the subjects to update the list on this page
    toast.info("Refreshing subject list...");
    fetchSubjects(); // Re-fetch data
  };

  const renderSkeletons = () => (
    Array.from({ length: 5 }).map((_, index) => (
      <TableRow key={`skeleton-subject-${index}`}>
        <TableCell><Skeleton className="h-6 w-3/4" /></TableCell>
        <TableCell><Skeleton className="h-6 w-1/2" /></TableCell>
        <TableCell className="hidden md:table-cell"><Skeleton className="h-6 w-full" /></TableCell>
        <TableCell className="text-right"><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
      </TableRow>
    ))
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Manage Subjects</CardTitle>
          <CardDescription>View, add, and manage subjects offered by your school.</CardDescription>
        </div>
        <Button asChild>
          <Link href="/school-admin/subjects/new"> 
            <PlusCircle className="mr-2 h-4 w-4" /> Add New Subject
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading && subjects.length === 0 ? (
             <Table>
                <TableCaption>Loading subject data...</TableCaption>
                <TableHeader>
                    <TableRow>
                        <TableHead>Subject Name</TableHead>
                        <TableHead>Code</TableHead>
                        <TableHead className="hidden md:table-cell">Description</TableHead>
                        <TableHead className="text-right w-[120px]">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {renderSkeletons()}
                </TableBody>
            </Table>
        ) : !isLoading && subjects.length === 0 ? (
          <div className="text-center py-10">
            <BookMarked className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-2 text-sm font-medium">No subjects found</h3>
            <p className="mt-1 text-sm text-muted-foreground">Get started by adding a new subject.</p>
          </div>
        ) : (
          <Table>
            <TableCaption>A list of all subjects offered in your school.</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Subject Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead className="hidden md:table-cell">Description</TableHead>
                <TableHead className="text-right w-[120px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subjects.map((subject) => (
                <TableRow key={subject.id}>
                  <TableCell className="font-medium">{subject.name}</TableCell>
                  <TableCell>{subject.code || 'N/A'}</TableCell>
                  <TableCell className="hidden md:table-cell truncate max-w-xs">
                    {subject.description || 'N/A'}
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="icon" className="mr-1" disabled title="View Details (soon)">
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="mr-1" asChild title="Edit Subject">
                      <Link href={`/school-admin/subjects/${subject.id}/edit`}>
                        <Edit className="h-4 w-4" />
                      </Link>
                    </Button>
                    {/* Integrate DeleteSubjectButton here */}
                    <DeleteSubjectButton
                        subjectId={subject.id}
                        subjectName={subject.name}
                        onDeleteSuccess={handleActionSuccess} // Call re-fetch on this page
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
          Total subjects: <strong>{subjects.length}</strong>
        </div>
      </CardFooter>
    </Card>
  );
}