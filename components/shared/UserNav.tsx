// components/shared/UserNav.tsx
"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton"; // For loading state
import { LogOut, LayoutDashboard, User as UserIcon } from "lucide-react"; // User renamed to UserIcon to avoid conflict
import { UserRole } from "@prisma/client"; // To correctly type session.user.role
import { ThemeToggleButton } from "@/components/theme-toggle-button"; // Import the theme toggle button

export function UserNav() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    // Render a loading state or a placeholder
    return (
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 w-20" /> {/* Placeholder for theme toggle width */}
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
    );
  }

  if (!session || !session.user) {
    // User is not authenticated, show ThemeToggle and Sign In button
    return (
      <div className="flex items-center gap-2">
        <ThemeToggleButton />
        <Button asChild variant="outline" size="sm">
          <Link href="/auth/login">Sign In</Link>
        </Button>
      </div>
    );
  }

  // Get user initials for Avatar Fallback
  const getInitials = () => {
    const firstNameInitial = session.user.firstName?.charAt(0) || "";
    const lastNameInitial = session.user.lastName?.charAt(0) || "";
    if (firstNameInitial && lastNameInitial) {
      return `${firstNameInitial}${lastNameInitial}`.toUpperCase();
    }
    if (session.user.name) {
      const nameParts = session.user.name.split(' ');
      if (nameParts.length > 1) {
        return `${nameParts[0].charAt(0)}${nameParts[1].charAt(0)}`.toUpperCase();
      }
      return nameParts[0].substring(0, 2).toUpperCase();
    }
    if (session.user.email) {
      return session.user.email.substring(0, 2).toUpperCase();
    }
    return "U"; // Default User initial
  };
  const userInitials = getInitials();

  const userRole = session.user.role as UserRole; // Assuming role is correctly typed in your session

  const getDashboardLink = () => {
    switch (userRole) {
      case UserRole.SUPER_ADMIN:
        return "/super-admin/dashboard";
      case UserRole.SCHOOL_ADMIN:
        return "/school-admin/dashboard";
      case UserRole.TEACHER:
        return "/teacher/dashboard"; // Assuming this path will exist
      case UserRole.STUDENT:
        return "/student/dashboard"; // Assuming this path will exist
      case UserRole.PARENT:
        return "/parent/dashboard"; // Assuming this path will exist
      default:
        return "/"; // Fallback to home or a generic dashboard
    }
  };

  return (
    <div className="flex items-center gap-2 md:gap-3"> {/* Added gap for spacing */}
      <ThemeToggleButton /> {/* Theme toggle button */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0"> {/* Adjusted size slightly */}
            <Avatar className="h-9 w-9">
              {session.user.image && <AvatarImage src={session.user.image} alt={session.user.name || "User Avatar"} />}
              <AvatarFallback>{userInitials}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-60" align="end" forceMount> {/* Increased width */}
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">
                {session.user.firstName && session.user.lastName 
                  ? `${session.user.firstName} ${session.user.lastName}` 
                  : session.user.name || "User"}
              </p>
              <p className="text-xs leading-none text-muted-foreground">
                {session.user.email}
              </p>
              {userRole && (
                  <p className="text-xs leading-none text-muted-foreground pt-1">
                      Role: <span className="font-medium capitalize">{userRole.replace("_", " ").toLowerCase()}</span>
                  </p>
              )}
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild className="cursor-pointer">
            <Link href={getDashboardLink()}>
              <LayoutDashboard className="mr-2 h-4 w-4" />
              <span>Dashboard</span>
            </Link>
          </DropdownMenuItem>
          {/* // Example for a profile link - you'd need to create this page
          <DropdownMenuItem asChild className="cursor-pointer" disabled>
            <Link href="/profile/settings"> // Example path
              <UserIcon className="mr-2 h-4 w-4" />
              <span>Profile</span>
            </Link>
          </DropdownMenuItem> 
          */}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => signOut({ callbackUrl: '/auth/login' })} className="cursor-pointer text-red-600 dark:text-red-400 focus:bg-red-100 dark:focus:bg-red-700/50 focus:text-red-700 dark:focus:text-red-300">
            <LogOut className="mr-2 h-4 w-4" />
            <span>Sign out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}