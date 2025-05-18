// app/(platform)/super-admin/schools/page.tsx
"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { School as PrismaSchool } from '@prisma/client';

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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'; // For error display
import { PlusCircle, ExternalLink } from "lucide-react"; // Example icons

// Define a type for the school data we expect from the API
type School = PrismaSchool; // Using Prisma type directly

export default function ManageSchoolsPage() {
  const [schools, setSchools] = useState<School[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSchools = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/schools');
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || `Error: ${response.status}`);
        }
        const data: School[] = await response.json();
        setSchools(data);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch schools.');
        console.error("Fetch schools error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSchools();
  }, []); // Empty dependency array means this effect runs once on mount

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Manage Schools</CardTitle>
          <CardDescription>Loading school data...</CardDescription>
        </CardHeader>
        <CardContent>
          {/* You can replace this with Shadcn/ui Skeleton loaders for a better UX */}
          <p>Loading, please wait...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Manage Schools</CardTitle>
          <CardDescription>Error loading school data</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle>Manage Schools</CardTitle>
          <CardDescription>View and manage all registered schools.</CardDescription>
        </div>
        <Link href="/super-admin/schools/new" passHref>
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" /> Create New School
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {schools.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-lg text-muted-foreground">No schools found.</p>
            <p className="text-sm text-muted-foreground">Be the first to create one!</p>
          </div>
        ) : (
          <Table>
            <TableCaption>A list of all registered schools in the system.</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">ID (Short)</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created At</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schools.map((school) => (
                <TableRow key={school.id}>
                  <TableCell className="font-mono text-xs">{school.id.substring(0, 8)}...</TableCell>
                  <TableCell>
                    <Link href={`/super-admin/schools/${school.id}`} className="font-medium text-primary hover:underline">
                      {school.name}
                    </Link>
                  </TableCell>
                  <TableCell>{school.schoolEmail}</TableCell>
                  <TableCell>{school.city || 'N/A'}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      school.isActive 
                        ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' 
                        : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                    }`}>
                      {school.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </TableCell>
                  <TableCell>{new Date(school.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/super-admin/schools/${school.id}`}>
                        View Details <ExternalLink className="ml-2 h-3 w-3" />
                      </Link>
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
          Total schools: <strong>{schools.length}</strong>
        </div>
      </CardFooter>
    </Card>
  );
}