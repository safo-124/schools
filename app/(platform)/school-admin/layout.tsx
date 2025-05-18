// app/(platform)/school-admin/layout.tsx
import React from 'react';
import Link from 'next/link';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route'; // Adjust path if needed
import { UserRole } from '@prisma/client';
import { redirect } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { UserNav } from '@/components/shared/UserNav'; // Import the UserNav component
import { 
    LayoutDashboard, 
    Users, 
    BookOpen, 
    CalendarDays, 
    DollarSign, 
    Megaphone,
    Settings // Example icon for settings
} from 'lucide-react';

// Assuming a shared Prisma instance from lib/db.ts
import prisma from '@/lib/db'; 

export default async function SchoolAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  // console.log('[LAYOUT_SCHOOL_ADMIN] Session in layout:', JSON.stringify(session, null, 2)); // For debugging

  if (!session || !session.user || session.user.role !== UserRole.SCHOOL_ADMIN) {
    // console.log('[LAYOUT_SCHOOL_ADMIN] Auth check failed. Redirecting to login.');
    // console.log('   > Session present?', !!session);
    // console.log('   > Session user present?', !!session?.user);
    // console.log('   > Session user role:', session?.user?.role);
    redirect('/auth/login?callbackUrl=/school-admin/dashboard'); 
  }
  
  let schoolName = "Your School"; // Default school name
  // Fetch school name for display
  try {
    const schoolAdminLink = await prisma.schoolAdmin.findFirst({ 
      where: { userId: session.user.id }, // session.user.id should be available due to the check above
      include: { 
        school: { 
          select: { name: true } 
        } 
      } 
    });
    if (schoolAdminLink?.school?.name) {
        schoolName = schoolAdminLink.school.name;
    } else {
        console.warn(`[LAYOUT_SCHOOL_ADMIN] No school name found for admin user ${session.user.id}`);
    }
  } catch (error) {
      console.error("[LAYOUT_SCHOOL_ADMIN] Error fetching school name for admin:", error);
  }
  // Note: Prisma client does not need manual $disconnect here when using the shared instance from lib/db.ts

  return (
    <div className="flex flex-col min-h-screen bg-muted/40 dark:bg-neutral-900">
      <header className="bg-background dark:bg-neutral-800 border-b dark:border-neutral-700 p-4 shadow-sm sticky top-0 z-50">
        <div className="container mx-auto flex justify-between items-center">
          <div>
            <Link href="/school-admin/dashboard">
              <h1 className="text-xl font-semibold text-primary dark:text-primary-foreground">
                School Admin Portal
              </h1>
            </Link>
            <p className="text-sm text-muted-foreground dark:text-neutral-400">Managing: {schoolName}</p>
          </div>
          <UserNav /> {/* UserNav component handles user display and sign out */}
        </div>
      </header>

      <div className="flex flex-1 pt-16"> {/* pt-16 for header height (approx 4rem or 64px) */}
        <aside className="w-60 bg-background dark:bg-neutral-800 p-4 border-r dark:border-neutral-700 fixed top-16 h-[calc(100vh-4rem)] overflow-y-auto">
          <nav className="flex flex-col space-y-1">
            <Button variant="ghost" className="w-full justify-start text-sm hover:bg-muted dark:hover:bg-neutral-700" asChild>
                <Link href="/school-admin/dashboard"><LayoutDashboard className="mr-2 h-4 w-4" /> Dashboard</Link>
            </Button>
            
            <h4 className="px-3 pt-3 pb-1 text-xs font-semibold text-muted-foreground dark:text-neutral-500 uppercase tracking-wider">Management</h4>
            <Button variant="ghost" className="w-full justify-start text-sm hover:bg-muted dark:hover:bg-neutral-700" asChild>
                <Link href="/school-admin/teachers"><Users className="mr-2 h-4 w-4" /> Teachers</Link>
            </Button>
            <Button variant="ghost" className="w-full justify-start text-sm hover:bg-muted dark:hover:bg-neutral-700" asChild>
                <Link href="/school-admin/students"><Users className="mr-2 h-4 w-4" /> Students</Link>
            </Button>
            <Button variant="ghost" className="w-full justify-start text-sm hover:bg-muted dark:hover:bg-neutral-700" asChild>
                <Link href="/school-admin/classes"><BookOpen className="mr-2 h-4 w-4" /> Classes & Sections</Link>
            </Button>
            <Button variant="ghost" className="w-full justify-start text-sm hover:bg-muted dark:hover:bg-neutral-700" asChild>
                <Link href="/school-admin/subjects"><BookOpen className="mr-2 h-4 w-4" /> Subjects</Link>
            </Button>
             <Button variant="ghost" className="w-full justify-start text-sm hover:bg-muted dark:hover:bg-neutral-700" asChild>
                <Link href="/school-admin/timetable"><CalendarDays className="mr-2 h-4 w-4" /> Timetable</Link>
            </Button>

            <h4 className="px-3 pt-3 pb-1 text-xs font-semibold text-muted-foreground dark:text-neutral-500 uppercase tracking-wider">Operations</h4>
            <Button variant="ghost" className="w-full justify-start text-sm hover:bg-muted dark:hover:bg-neutral-700" asChild>
                <Link href="/school-admin/finances/fees"><DollarSign className="mr-2 h-4 w-4" /> Fee Management</Link>
            </Button>
            <Button variant="ghost" className="w-full justify-start text-sm hover:bg-muted dark:hover:bg-neutral-700" asChild>
                <Link href="/school-admin/finances/invoices"><DollarSign className="mr-2 h-4 w-4" /> Invoices & Payments</Link>
            </Button>
            <Button variant="ghost" className="w-full justify-start text-sm hover:bg-muted dark:hover:bg-neutral-700" asChild>
                <Link href="/school-admin/communications"><Megaphone className="mr-2 h-4 w-4" /> Communications</Link>
            </Button>
            
            <h4 className="px-3 pt-3 pb-1 text-xs font-semibold text-muted-foreground dark:text-neutral-500 uppercase tracking-wider">Settings</h4>
             <Button variant="ghost" className="w-full justify-start text-sm hover:bg-muted dark:hover:bg-neutral-700" asChild>
                <Link href="/school-admin/settings"><Settings className="mr-2 h-4 w-4" /> School Settings</Link>
            </Button>
          </nav>
        </aside>

        <main className="flex-1 p-20 lg:p-8 ml-60 mt-16"> {/* Adjust ml for sidebar, mt for header */}
          {children}
        </main>
      </div>
    </div>
  );
}