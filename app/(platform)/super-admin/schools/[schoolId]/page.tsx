// app/(platform)/super-admin/schools/[schoolId]/page.tsx
import { School, UserRole, SchoolAdmin, User as PrismaUser } from '@prisma/client';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';

// Import Shadcn/ui components
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Edit3, Users as UsersIcon } from 'lucide-react';

// For session checking on server components
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';// Adjust path if needed

// Import custom components
import { SchoolStatusToggleButton } from '@/components/super-admin/SchoolStatusToggleButton'; // Adjust path
import { EditSchoolButton } from '@/components/super-admin/EditSchoolButton'; // Adjust path
import { AssignSchoolAdminForm } from '@/components/super-admin/AssignSchoolAdminForm'; // Adjust path

import prisma from '@/lib/db'; // Using shared Prisma instance

// Define a type for the admin data we'll fetch (SchoolAdmin linked with User details)
type AdminWithUserDetails = SchoolAdmin & {
  user: Pick<PrismaUser, 'id' | 'email' | 'firstName' | 'lastName' | 'isActive'>;
};

interface FetchedSchoolDetailsData {
  school: School;
  admins: AdminWithUserDetails[];
}

async function getSchoolAndAdminDetails(schoolId: string): Promise<FetchedSchoolDetailsData | null> {
  // console.log(`[PAGE_SCHOOL_DETAILS] Fetching details for schoolId: ${schoolId}`);
  try {
    const school = await prisma.school.findUnique({
      where: { id: schoolId },
    });

    if (!school) {
      // console.log(`[PAGE_SCHOOL_DETAILS] School not found for schoolId: ${schoolId}`);
      return null;
    }

    const admins = await prisma.schoolAdmin.findMany({
      where: { schoolId: schoolId },
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true, isActive: true },
        },
      },
      orderBy: { user: { firstName: 'asc' } },
    });
    // console.log(`[PAGE_SCHOOL_DETAILS] Found ${admins.length} admins for schoolId: ${schoolId}`);
    return { school, admins };
  } catch (error) {
    console.error(`[PAGE_SCHOOL_DETAILS] Failed to fetch school and admin details for schoolId ${schoolId}:`, error);
    return null;
  }
}

// Using `params: any` to bypass the Vercel build type error for PageProps constraint
export default async function SchoolDetailsPage({ params }: { params: any }) {
  // Internally, we expect params.schoolId to be a string and will use it as such.
  const schoolId = params.schoolId as string; 
  
  // console.log(`[PAGE_SCHOOL_DETAILS] Rendering page for schoolId: ${schoolId}`);
  const session = await getServerSession(authOptions);

  if (!session?.user?.id || session.user.role !== UserRole.SUPER_ADMIN) {
    // console.log(`[PAGE_SCHOOL_DETAILS] Unauthorized access for schoolId: ${schoolId}. Redirecting to login.`);
    redirect('/auth/login?callbackUrl=' + encodeURIComponent(`/super-admin/schools/${schoolId}`));
  }

  if (!schoolId) { // Basic check in case params.schoolId was somehow undefined despite being a dynamic route
    console.error("[PAGE_SCHOOL_DETAILS] schoolId is undefined from params. Triggering notFound().");
    notFound();
  }

  const schoolData = await getSchoolAndAdminDetails(schoolId);

  if (!schoolData) {
    // console.log(`[PAGE_SCHOOL_DETAILS] No school data found for schoolId: ${schoolId}. Triggering notFound().`);
    notFound();
  }

  const { school, admins } = schoolData;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="outline" asChild>
          <Link href="/super-admin/schools">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Schools List
          </Link>
        </Button>
        <EditSchoolButton schoolId={school.id} variant="default" size="default">
          <Edit3 className="mr-2 h-4 w-4" /> Edit School Profile
        </EditSchoolButton>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-2xl">{school.name}</CardTitle>
              <CardDescription>School ID: <span className="font-mono text-xs">{school.id}</span></CardDescription>
            </div>
            <Badge 
              variant={school.isActive ? 'default' : 'destructive'} 
              className={`${
                school.isActive 
                  ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' 
                  : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
              } px-2 py-1 text-xs font-semibold rounded-full`}
            >
              {school.isActive ? 'Active' : 'Inactive'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Contact Information Section */}
          <div>
            <h3 className="text-lg font-semibold mb-2">Contact Information</h3>
            <Separator />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 mt-3 text-sm">
              <p><strong>Email:</strong> {school.schoolEmail}</p>
              <p><strong>Phone:</strong> {school.phoneNumber || 'N/A'}</p>
              <p className="md:col-span-2"><strong>Website:</strong> {school.website ? <a href={school.website.startsWith('http') ? school.website : `http://${school.website}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{school.website}</a> : 'N/A'}</p>
            </div>
          </div>

          {/* Location Details Section */}
          <div>
            <h3 className="text-lg font-semibold mb-2">Location Details</h3>
            <Separator />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 mt-3 text-sm">
              <p className="md:col-span-2"><strong>Address:</strong> {school.address || 'N/A'}</p>
              <p><strong>City:</strong> {school.city || 'N/A'}</p>
              <p><strong>State/Region:</strong> {school.stateOrRegion || 'N/A'}</p>
              <p><strong>Country:</strong> {school.country || 'N/A'}</p>
              <p><strong>Postal Code:</strong> {school.postalCode || 'N/A'}</p>
            </div>
          </div>
          
          {/* Academic & System Configuration Section */}
          <div>
            <h3 className="text-lg font-semibold mb-2">Academic & System Configuration</h3>
            <Separator />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 mt-3 text-sm">
              <p><strong>Current Academic Year:</strong> {school.currentAcademicYear || 'Not Set'}</p>
              <p><strong>Current Term:</strong> {school.currentTerm ? school.currentTerm.replace("_", " ") : 'Not Set'}</p>
              <p><strong>Currency:</strong> {school.currency}</p>
              <p><strong>Timezone:</strong> {school.timezone}</p>
              <p><strong>Created At:</strong> {new Date(school.createdAt).toLocaleString()}</p>
              <p><strong>Last Updated:</strong> {new Date(school.updatedAt).toLocaleString()}</p>
              {school.createdBySuperAdminId && <p className="md:col-span-2"><strong>Created By (ID Short):</strong> <span className="font-mono text-xs">{school.createdBySuperAdminId.substring(0,8)}...</span></p>}
            </div>
          </div>

          {/* School Administrators Section */}
          <div>
            <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-semibold flex items-center"><UsersIcon className="mr-2 h-5 w-5 text-muted-foreground"/>School Administrators</h3>
                 <AssignSchoolAdminForm 
                    schoolId={school.id} 
                    schoolName={school.name} 
                 />
            </div>
            <Separator />
            {admins.length === 0 ? (
              <p className="text-sm text-muted-foreground mt-3">No administrators assigned to this school yet.</p>
            ) : (
              <ul className="list-none mt-3 space-y-2 text-sm">
                {admins.map(adminLink => (
                  <li key={adminLink.id} className="p-3 border rounded-md flex justify-between items-center dark:border-neutral-700">
                    <div>
                      <span className="font-medium">{adminLink.user.firstName} {adminLink.user.lastName}</span>
                      <span className="text-muted-foreground ml-2">({adminLink.user.email})</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Badge variant={adminLink.user.isActive ? 'default' : 'outline'} className={adminLink.user.isActive ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'border-orange-400 text-orange-600 dark:border-orange-600 dark:text-orange-400'}>
                            User Acc: {adminLink.user.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex flex-wrap items-center gap-2 border-t pt-6 mt-4 dark:border-neutral-700">
          <h3 className="text-md font-semibold mr-2 self-center">School Actions:</h3>
          <SchoolStatusToggleButton school={{ id: school.id, isActive: school.isActive, name: school.name }} />
        </CardFooter>
      </Card>
    </div>
  );
}