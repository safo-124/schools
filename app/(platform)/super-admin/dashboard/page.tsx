// app/(platform)/super-admin/dashboard/page.tsx
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';// Adjust path
import {  UserRole, School } from '@prisma/client';
import { redirect } from 'next/navigation';
import Link from 'next/link';

// Shadcn/ui components for layout
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Building2, CheckCircle, XCircle, PlusCircle } from 'lucide-react'; // Example icons

// Assuming a shared Prisma instance
import prisma from '@/lib/db'; // Adjust path to your shared Prisma instance

interface DashboardStats {
  totalSchools: number;
  activeSchools: number;
  inactiveSchools: number;
  recentSchools: Pick<School, 'id' | 'name' | 'schoolEmail' | 'createdAt'>[];
}

async function getDashboardStats(): Promise<DashboardStats> {
  const totalSchools = await prisma.school.count();
  const activeSchools = await prisma.school.count({ where: { isActive: true } });
  const inactiveSchools = await prisma.school.count({ where: { isActive: false } });
  
  const recentSchools = await prisma.school.findMany({
    orderBy: {
      createdAt: 'desc',
    },
    take: 5, // Get the 5 most recent schools
    select: {
      id: true,
      name: true,
      schoolEmail: true,
      createdAt: true,
    },
  });

  return {
    totalSchools,
    activeSchools,
    inactiveSchools,
    recentSchools,
  };
}

export default async function SuperAdminDashboardPage() {
  const session = await getServerSession(authOptions);

  // This check is also in the layout, but good for direct page access protection
  if (!session || !session.user || session.user.role !== UserRole.SUPER_ADMIN) {
    console.log('[PAGE_SUPER_ADMIN_DASHBOARD] Auth check failed. Session user role:', session?.user?.role, '. Redirecting to /auth/login.');
    redirect('/auth/login?callbackUrl=/super-admin/dashboard');
  }

  const stats = await getDashboardStats();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Super Admin Dashboard</h1>
        <Button asChild>
            <Link href="/super-admin/schools/new">
                <PlusCircle className="mr-2 h-5 w-5" /> Create New School
            </Link>
        </Button>
      </div>
      
      <p className="text-muted-foreground">
        Welcome, {session.user.firstName || session.user.name}! Overview of the school management system.
      </p>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Schools</CardTitle>
            <Building2 className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalSchools}</div>
            <p className="text-xs text-muted-foreground">schools registered in the system</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Schools</CardTitle>
            <CheckCircle className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeSchools}</div>
            <p className="text-xs text-muted-foreground">currently active and operational</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inactive Schools</CardTitle>
            <XCircle className="h-5 w-5 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.inactiveSchools}</div>
            <p className="text-xs text-muted-foreground">currently inactive or deactivated</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Schools Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recently Added Schools</CardTitle>
          <CardDescription>Showing the last 5 schools created.</CardDescription>
        </CardHeader>
        <CardContent>
          {stats.recentSchools.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Date Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.recentSchools.map((school) => (
                  <TableRow key={school.id}>
                    <TableCell className="font-medium">{school.name}</TableCell>
                    <TableCell>{school.schoolEmail}</TableCell>
                    <TableCell>{new Date(school.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/super-admin/schools/${school.id}`}>View Details</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">No schools have been created yet.</p>
          )}
        </CardContent>
        {stats.totalSchools > 0 && (
            <CardFooter>
                <Button variant="ghost" asChild className="text-sm">
                    <Link href="/super-admin/schools">View All Schools &rarr;</Link>
                </Button>
            </CardFooter>
        )}
      </Card>

      {/* Placeholder for other dashboard widgets */}
      {/* <Card>
        <CardHeader><CardTitle>User Statistics (Placeholder)</CardTitle></CardHeader>
        <CardContent><p>Graphs and user counts coming soon.</p></CardContent>
      </Card>
      */}
    </div>
  );
}