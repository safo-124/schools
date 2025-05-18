// app/(platform)/school-admin/dashboard/page.tsx
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route'; // Adjust path
import { UserRole } from '@prisma/client';
import { redirect } from 'next/navigation';

// Shadcn/ui components for layout
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Building, Users2, BookCopy, Users } from 'lucide-react'; // Example icons

// Assuming a shared Prisma instance
import prisma from '@/lib/db'; // Adjust path to your shared Prisma instance
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface DashboardStat {
  title: string;
  value: string | number;
  description?: string;
  icon?: React.ElementType;
}

export default async function SchoolAdminDashboardPage() {
  const session = await getServerSession(authOptions);
  // console.log('[PAGE_SCHOOL_ADMIN_DASHBOARD] Session:', JSON.stringify(session, null, 2)); // For debugging

  // This check is also in the layout, but good for direct page access protection
  if (!session || !session.user || session.user.role !== UserRole.SCHOOL_ADMIN) {
    // console.log('[PAGE_SCHOOL_ADMIN_DASHBOARD] Auth check failed. Redirecting to login.');
    redirect('/auth/login?callbackUrl=/school-admin/dashboard');
  }

  // Fetch school information specific to this SchoolAdmin
  const schoolAdminLink = await prisma.schoolAdmin.findFirst({
    where: { userId: session.user.id }, // session.user.id should be available
    include: {
      school: {
        select: { name: true, id: true } 
      }
    }
  });

  if (!schoolAdminLink || !schoolAdminLink.school) {
    return (
        <Card>
            <CardHeader> <CardTitle>Error</CardTitle> </CardHeader>
            <CardContent>
                <p className="text-red-600">Your account is not associated with any school, or the school could not be found. Please contact the Super Administrator.</p>
            </CardContent>
        </Card>
    );
  }
  
  const schoolName = schoolAdminLink.school.name;
  const schoolId = schoolAdminLink.school.id;

  // Fetch actual dashboard data for this school
  const studentCount = await prisma.student.count({ where: { schoolId: schoolId, isActive: true }});
  const teacherCount = await prisma.teacher.count({ where: { schoolId: schoolId /* consider isActive for teachers too */ }});
  const classCount = await prisma.class.count({ where: { schoolId: schoolId, academicYear: schoolAdminLink.school.currentAcademicYear || undefined }}) // Count for current academic year

  const stats: DashboardStat[] = [
    { title: "Total Students", value: studentCount, description: `active students in ${schoolName}`, icon: Users2 },
    { title: "Total Teachers", value: teacherCount, description: `staff members in ${schoolName}`, icon: Users },
    { title: "Active Classes", value: classCount, description: `for current academic year`, icon: BookCopy },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
        <div>
            <h1 className="text-2xl font-bold tracking-tight">School Dashboard</h1>
            <p className="text-muted-foreground">
                Welcome back, {session.user.firstName || session.user.name}! Managing: <strong>{schoolName}</strong>
            </p>
        </div>
        {/* Add any primary action button here if needed, e.g., "New Announcement" */}
      </div>
      
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              {stat.icon && <stat.icon className="h-4 w-4 text-muted-foreground" />}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              {stat.description && <p className="text-xs text-muted-foreground">{stat.description}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
            <CardHeader>
                <CardTitle>Quick Links</CardTitle>
                <CardDescription>Navigate to common school management tasks.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
                <Button variant="outline" asChild><Link href="/school-admin/students">Manage Students</Link></Button>
                <Button variant="outline" asChild><Link href="/school-admin/teachers">Manage Teachers</Link></Button>
                <Button variant="outline" asChild><Link href="/school-admin/classes">Manage Classes</Link></Button>
                <Button variant="outline" asChild><Link href="/school-admin/timetable">View Timetable</Link></Button>
            </CardContent>
        </Card>
        <Card>
            <CardHeader>
                <CardTitle>Recent Activity (Placeholder)</CardTitle>
                <CardDescription>Overview of recent actions and alerts.</CardDescription>
            </CardHeader>
            <CardContent>
                <p className="text-sm text-muted-foreground">No recent activity to display yet.</p>
                {/* TODO: List recent enrollments, fee payments, announcements etc. */}
            </CardContent>
        </Card>
      </div>
      {/* More dashboard widgets can go here */}
    </div>
  );
}