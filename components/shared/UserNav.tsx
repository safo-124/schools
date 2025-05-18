// components/shared/UserNav.tsx
"use client"; // This must be a client component

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
import { LogOut,  LayoutDashboard } from "lucide-react"; // Example icons
import { UserRole } from "@prisma/client"; // To correctly type session.user.role if needed

export function UserNav() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    // Optional: Render a loading state or a placeholder
    return <div className="h-8 w-20 animate-pulse bg-muted rounded-md"></div>;
  }

  if (!session || !session.user) {
    // User is not authenticated, optionally show a login button
    // However, this component is typically used in layouts where user is expected to be authenticated.
    // So, you might just return null or a simple login link if that makes sense for your UI.
    return (
      <Button asChild variant="outline" size="sm">
        <Link href="/auth/login">Sign In</Link>
      </Button>
    );
  }

  // Get user initials for Avatar Fallback
  const userInitials = 
    `${session.user.firstName?.charAt(0) || ''}${session.user.lastName?.charAt(0) || ''}`.toUpperCase() ||
    session.user.name?.substring(0, 2).toUpperCase() ||
    session.user.email?.substring(0, 2).toUpperCase() || 
    "U";

  const userRole = session.user.role as UserRole; // Cast if using augmented types

  const getDashboardLink = () => {
    switch (userRole) {
      case UserRole.SUPER_ADMIN:
        return "/super-admin/dashboard";
      case UserRole.SCHOOL_ADMIN:
        return "/school-admin/dashboard";
      case UserRole.TEACHER:
        return "/teacher/dashboard";
      case UserRole.STUDENT:
        return "/student/dashboard";
      // case UserRole.PARENT:
      //   return "/parent/dashboard"; // if parents have a web dashboard
      default:
        return "/";
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Avatar className="h-8 w-8">
            {session.user.image && <AvatarImage src={session.user.image} alt={session.user.name || "User Avatar"} />}
            <AvatarFallback>{userInitials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
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
                    Role: <span className="font-medium">{userRole.replace("_", " ")}</span>
                </p>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={getDashboardLink()}>
            <LayoutDashboard className="mr-2 h-4 w-4" />
            <span>Dashboard</span>
          </Link>
        </DropdownMenuItem>
        {/* Add other links here like "Profile", "Settings" if applicable */}
        {/* <DropdownMenuItem disabled>
          <UserCircle className="mr-2 h-4 w-4" />
          <span>Profile (soon)</span>
        </DropdownMenuItem> */}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => signOut({ callbackUrl: '/auth/login' })}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Sign out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}