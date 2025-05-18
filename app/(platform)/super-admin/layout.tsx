// app/(platform)/super-admin/layout.tsx
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
    Building, 
    Settings,
    Users // Example for user management later
} from 'lucide-react';

// If you need Prisma here, import the shared instance:
// import prisma from '@/lib/db';

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  // Primary protection should be middleware, but this is a safeguard for the layout
  if (!session || !session.user || session.user.role !== UserRole.SUPER_ADMIN) {
    console.log('[LAYOUT_SUPER_ADMIN] Auth check failed. Session user role:', session?.user?.role, '. Redirecting to /auth/login.');
    redirect('/auth/login?callbackUrl=/super-admin/dashboard'); // Or appropriate callback
  }

  return (
    <div className="flex flex-col min-h-screen bg-muted/40 dark:bg-neutral-900">
      <header className="bg-background dark:bg-neutral-800 border-b dark:border-neutral-700 p-4 shadow-sm sticky top-0 z-50">
        <div className="container mx-auto flex justify-between items-center">
          <Link href="/super-admin/dashboard">
            <h1 className="text-xl font-semibold text-primary dark:text-primary-foreground">
              Super Admin Portal
            </h1>
          </Link>
          <UserNav /> {/* UserNav component handles user display and sign out */}
        </div>
      </header>

      <div className="flex flex-1 pt-16"> {/* pt-16 for header height */}
        <aside className="w-60 bg-background dark:bg-neutral-800 p-4 border-r dark:border-neutral-700 fixed top-16 h-[calc(100vh-4rem)] overflow-y-auto">
          <nav className="flex flex-col space-y-1">
            <Button variant="ghost" className="w-full justify-start text-sm hover:bg-muted dark:hover:bg-neutral-700" asChild>
                <Link href="/super-admin/dashboard"><LayoutDashboard className="mr-2 h-4 w-4" /> Dashboard</Link>
            </Button>
            
            <h4 className="px-3 pt-3 pb-1 text-xs font-semibold text-muted-foreground dark:text-neutral-500 uppercase tracking-wider">Core Management</h4>
            <Button variant="ghost" className="w-full justify-start text-sm hover:bg-muted dark:hover:bg-neutral-700" asChild>
                <Link href="/super-admin/schools"><Building className="mr-2 h-4 w-4" /> Manage Schools</Link>
            </Button>
            {/* Add more links as Super Admin features grow, e.g., User Management across system */}
            {/* <Button variant="ghost" className="w-full justify-start text-sm hover:bg-muted dark:hover:bg-neutral-700" asChild>
                <Link href="/super-admin/users"><Users className="mr-2 h-4 w-4" /> Manage Users (soon)</Link>
            </Button> 
            */}

            <h4 className="px-3 pt-3 pb-1 text-xs font-semibold text-muted-foreground dark:text-neutral-500 uppercase tracking-wider">System</h4>
             <Button variant="ghost" className="w-full justify-start text-sm hover:bg-muted dark:hover:bg-neutral-700" asChild>
                <Link href="/super-admin/settings"><Settings className="mr-2 h-4 w-4" /> System Settings (soon)</Link>
            </Button>
          </nav>
        </aside>

        <main className="flex-1 p-6 lg:p-8 ml-60 mt-16"> {/* Adjust ml for sidebar, mt for header */}
          {children} {/* This is where the page content (e.g., dashboard, schools list) will be rendered */}
        </main>
      </div>
    </div>
  );
}