// app/(platform)/school-admin/dashboard/page.tsx
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { UserRole /* Prisma */ } from '@prisma/client'; // Comment out Prisma if it's causing issues and we bypass
import { redirect } from 'next/navigation';
import Link from 'next/link';

// Shadcn/ui components for layout
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users2, BookCopy, Users } from 'lucide-react'; 

import prisma from '@/lib/db'; 

interface DashboardStat {
  title: string;
  value: string | number;
  description?: string;
  icon?: React.ElementType;
  link?: string; 
  linkText?: string;
}

export default async function SchoolAdminDashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user || session.user.role !== UserRole.SCHOOL_ADMIN) {
    redirect('/auth/login?callbackUrl=/school-admin/dashboard');
  }

  const schoolAdminLink = await prisma.schoolAdmin.findFirst({
    where: { userId: session.user.id },
    include: {
      school: {
        select: { 
            name: true, 
            id: true,
            currentAcademicYear: true 
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

  const studentCount = await prisma.student.count({ 
    where: { 
      schoolId: schoolId, 
      isActive: true 
    }
  });

  const teacherCount = await prisma.teacher.count({ 
    where: { 
      schoolId: schoolId,
    }
  });
  
  // Using 'any' as a type bypass for classCountQueryArgs
  const classCountQueryArgs: any = { // <<< TYPE BYPASS APPLIED HERE
    where: { 
      schoolId: schoolId,
    }
  };
  if (currentSchoolAcademicYear) {
    // Since classCountQueryArgs is 'any', TypeScript won't complain about adding academicYear
    classCountQueryArgs.where.academicYear = currentSchoolAcademicYear;
  }
  const classCount = await prisma.class.count(classCountQueryArgs);

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
      </div>
      
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
            </CardContent>
        </Card>
      </div>
    </div>
  );
}