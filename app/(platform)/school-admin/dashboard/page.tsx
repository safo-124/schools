// app/(platform)/school-admin/dashboard/page.tsx
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth'; // Ensure this path points to your authOptions
import { UserRole } from '@prisma/client';
import { redirect } from 'next/navigation';
import Link from 'next/link';

// Shadcn/ui components for layout
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users2, BookCopy, Users } from 'lucide-react'; // Users is for teachers, Users2 for students

// Assuming a shared Prisma instance
import prisma from '@/lib/db'; 

interface DashboardStat {
  title: string;
  value: string | number;
  description?: string;
  icon?: React.ElementType;
  link?: string; // Optional link for the stat card
  linkText?: string; // Text for the link button
}

export default async function SchoolAdminDashboardPage() {
  const session = await getServerSession(authOptions);
  // console.log('[PAGE_SCHOOL_ADMIN_DASHBOARD] Session:', JSON.stringify(session, null, 2));

  if (!session || !session.user || session.user.role !== UserRole.SCHOOL_ADMIN) {
    // console.log('[PAGE_SCHOOL_ADMIN_DASHBOARD] Auth check failed. Redirecting to login.');
    redirect('/auth/login?callbackUrl=/school-admin/dashboard');
  }

  // Fetch school information specific to this SchoolAdmin
  const schoolAdminLink = await prisma.schoolAdmin.findFirst({
    where: { userId: session.user.id },
    include: {
      school: {
        select: { 
            name: true, 
            id: true,
            currentAcademicYear: true // Ensure this is selected
        } 
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
  const currentSchoolAcademicYear = schoolAdminLink.school.currentAcademicYear;

  // Fetch actual dashboard data for this school
  const studentCount = await prisma.student.count({ 
    where: { 
      schoolId: schoolId, 
      isActive: true // Count only active students
    }
  });

  const teacherCount = await prisma.teacher.count({ 
    where: { 
      schoolId: schoolId,
      // user: { isActive: true } // If teachers are linked to users and you want to count only active user accounts
    }
  });
  
  const classCountQuery: Prisma.ClassCountArgs = { 
    where: { 
      schoolId: schoolId,
    }
  };
  // Only filter by academicYear if currentSchoolAcademicYear is set
  if (currentSchoolAcademicYear) {
    classCountQuery.where!.academicYear = currentSchoolAcademicYear;
  }
  const classCount = await prisma.class.count(classCountQuery);

  const stats: DashboardStat[] = [
    { 
      title: "Active Students", 
      value: studentCount, 
      description: `in ${schoolName}`, 
      icon: Users2,
      link: "/school-admin/students",
      linkText: "Manage Students"
    },
    { 
      title: "Total Teachers", 
      value: teacherCount, 
      description: `staff members`, 
      icon: Users,
      link: "/school-admin/teachers",
      linkText: "Manage Teachers" 
    },
    { 
      title: "Classes", 
      value: classCount, 
      description: currentSchoolAcademicYear ? `for ${currentSchoolAcademicYear}` : `across all years`, 
      icon: BookCopy,
      link: "/school-admin/classes",
      linkText: "Manage Classes"
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
        <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">School Dashboard</h1>
            <p className="text-muted-foreground">
                Welcome back, {session.user.firstName || session.user.name}! Managing: <strong>{schoolName}</strong>
            </p>
        </div>
        {/* Future: Primary Action Button e.g., New Announcement */}
        {/* <Button asChild>
            <Link href="/school-admin/communications/announcements/new">Create Announcement</Link>
        </Button> */}
      </div>
      
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              {stat.icon && <stat.icon className="h-5 w-5 text-muted-foreground" />}
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stat.value}</div>
              {stat.description && <p className="text-xs text-muted-foreground">{stat.description}</p>}
              {stat.link && stat.linkText && (
                <Button variant="link" size="sm" className="px-0 pt-2 text-xs" asChild>
                    <Link href={stat.link}>{stat.linkText} &rarr;</Link>
                </Button>
              )}
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
            <CardContent className="grid grid-cols-2 gap-3 sm:gap-4">
                <Button variant="outline" asChild className="w-full justify-start text-left">
                    <Link href="/school-admin/students">Manage Students</Link>
                </Button>
                <Button variant="outline" asChild className="w-full justify-start text-left">
                    <Link href="/school-admin/teachers">Manage Teachers</Link>
                </Button>
                <Button variant="outline" asChild className="w-full justify-start text-left">
                    <Link href="/school-admin/classes">Manage Classes</Link>
                </Button>
                 <Button variant="outline" asChild className="w-full justify-start text-left">
                    <Link href="/school-admin/subjects">Manage Subjects</Link>
                </Button>
                <Button variant="outline" asChild className="w-full justify-start text-left">
                    <Link href="/school-admin/timetable">Manage Timetable</Link>
                </Button>
                <Button variant="outline" asChild className="w-full justify-start text-left">
                    <Link href="/school-admin/finances/fees">Fee Structures</Link>
                </Button>
                 <Button variant="outline" asChild className="w-full justify-start text-left">
                    <Link href="/school-admin/finances/invoices">Invoices</Link>
                </Button>
                <Button variant="outline" asChild className="w-full justify-start text-left">
                    <Link href="/school-admin/communications/announcements">Announcements</Link>
                </Button>
            </CardContent>
        </Card>
        <Card>
            <CardHeader>
                <CardTitle>Recent Activity (Placeholder)</CardTitle>
                <CardDescription>Overview of recent actions and system alerts.</CardDescription>
            </CardHeader>
            <CardContent>
                <p className="text-sm text-muted-foreground">No recent activity to display yet.</p>
                {/* TODO: List recent student enrollments, fee payments, announcements created etc. */}
            </CardContent>
        </Card>
      </div>
      {/* More dashboard widgets can go here, e.g., upcoming events, alerts */}
    </div>
  );
}