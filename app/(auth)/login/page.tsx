// app/(auth)/login/page.tsx
"use client";

import { useState, useEffect } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';


// Shadcn/ui components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { LogIn } from 'lucide-react'; // Example Icon

// A simple helper to determine dashboard path based on role
// This is client-side, so UserRole might not be available directly from Prisma.
// We rely on the role string from the session.
const getDashboardPath = (role?: string | null): string => {
  switch (role) {
    case 'SUPER_ADMIN':
      return '/super-admin/dashboard';
    case 'SCHOOL_ADMIN':
      return '/school-admin/dashboard';
    case 'TEACHER':
      return '/teacher/dashboard';
    case 'STUDENT':
      return '/student/dashboard';
    // Add PARENT if applicable
    default:
      return '/'; // Fallback
  }
};


export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();

  // Get callbackUrl from query parameters, default to "/"
  // This might be set by middleware if an unauthenticated user tries to access a protected route.
  const callbackUrlFromParams = searchParams.get("callbackUrl");
  const errorParam = searchParams.get("error");

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (errorParam) {
      if (errorParam === "CredentialsSignin") {
        setError("Invalid email or password. Please try again.");
      } else if (errorParam === "AccessDenied") {
        setError("Access Denied. You do not have permission to view that page.");
      } else {
        setError("An authentication error occurred: " + errorParam);
      }
    }
  }, [errorParam]);
  
  useEffect(() => {
    // If user is already authenticated, redirect them away from login page
    if (status === "authenticated" && session?.user) {
      const dashboardPath = getDashboardPath(session.user.role);
      console.log(`[LOGIN_PAGE] User already authenticated. Role: ${session.user.role}. Redirecting to: ${dashboardPath}`);
      router.replace(dashboardPath); // Use replace to avoid login page in history
    }
  }, [session, status, router]);


  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null); // Clear previous errors
    setIsLoading(true);

    try {
      const result = await signIn('credentials', {
        redirect: false, // We'll handle the redirect manually to show errors or success
        email,
        password,
        // callbackUrl is not directly used by signIn when redirect:false,
        // but NextAuth might use it if redirect was true or if an error occurs that redirects to error page with callbackUrl
      });

      setIsLoading(false);

      if (result?.error) {
        // Display specific error messages based on result.error
        if (result.error === "CredentialsSignin") {
          setError("Invalid email or password. Please try again.");
        } else {
          setError(result.error); // Or a more generic message
        }
        console.error("NextAuth SignIn Error:", result.error);
      } else if (result?.ok && !result.error) {
        // Successful login
        // Determine where to redirect. If callbackUrl was provided (e.g. by middleware), use it.
        // Otherwise, determine based on role (though middleware should handle this too after redirect to '/')
        let finalCallbackUrl = callbackUrlFromParams || "/"; // Default to root, middleware will handle role-based redirect

        // If already on login page because of a specific callback, respect it.
        // Otherwise, after a direct login, the root path '/' will be handled by middleware.
        console.log(`[LOGIN_PAGE] Login successful. Determined callbackUrl: ${finalCallbackUrl}. Redirecting...`);
        router.push(finalCallbackUrl);
      } else {
        setError("Login failed. Please try again.");
      }
    } catch (err) {
      setIsLoading(false);
      setError("An unexpected error occurred during login. Please try again.");
      console.error("Login Page Submit Error:", err);
    }
  };
  
  // Do not render form if authenticated and redirecting
  if (status === "authenticated") {
    return <div className="flex justify-center items-center min-h-screen"><p>Loading your dashboard...</p></div>;
  }


  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-muted/40 p-4 dark:bg-neutral-900">
      <Card className="w-full max-w-sm shadow-xl dark:bg-neutral-800">
        <CardHeader className="text-center">
          <div className="inline-block p-3 bg-primary/10 rounded-full mx-auto mb-4 dark:bg-primary/20">
            <LogIn className="h-8 w-8 text-primary dark:text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">Welcome Back!</CardTitle>
          <CardDescription>Sign in to access your school management portal.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertTitle>Login Failed</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-1">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                disabled={isLoading}
                autoComplete="email"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                disabled={isLoading}
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Signing In...' : 'Sign In'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col items-center text-xs text-muted-foreground">
          <p className="mt-2">
            {/* Add Forgot Password link if you implement it */}
            {/* <Link href="/auth/forgot-password" legacyBehavior><a className="underline hover:text-primary">Forgot password?</a></Link> */}
          </p>
          <p className="mt-4">
            &copy; {new Date().getFullYear()} School Management System.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}