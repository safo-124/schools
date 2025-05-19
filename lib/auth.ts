// lib/auth.ts
import { AuthOptions, User as NextAuthUserFromLib } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { UserRole, User as PrismaUser } from '@prisma/client'; // Prisma types
import bcrypt from 'bcryptjs';
import prisma from '@/lib/db'; // Your shared Prisma client instance

// Ensure your next-auth.d.ts file is in the root or types/ folder and correctly augments these types
// Specifically, Session['user'] and User (from 'next-auth') should have id, role, firstName, lastName

export const authOptions: AuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: "Email", type: "email", placeholder: "user@example.com" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials): Promise<NextAuthUserFromLib | null> {
        // console.log('[AUTH_AUTHORIZE_CB] Attempting to authorize user...'); // Keep for debugging if needed
        if (!credentials?.email || !credentials?.password) {
          // console.log('[AUTH_AUTHORIZE_CB] Missing email or password.');
          return null;
        }
        try {
          const dbUser: PrismaUser | null = await prisma.user.findUnique({
            where: { email: credentials.email }
          });

          if (!dbUser) {
            // console.log(`[AUTH_AUTHORIZE_CB] No user found for email: ${credentials.email}`);
            return null;
          }
          if (!dbUser.hashedPassword) {
            // console.log(`[AUTH_AUTHORIZE_CB] User ${credentials.email} has no password set.`);
            return null;
          }
          if (!dbUser.isActive) {
            // console.log(`[AUTH_AUTHORIZE_CB] User ${credentials.email} is not active.`);
            return null; 
          }

          const isValidPassword = await bcrypt.compare(credentials.password, dbUser.hashedPassword);
          if (!isValidPassword) {
            // console.log(`[AUTH_AUTHORIZE_CB] Invalid password for user: ${credentials.email}`);
            return null;
          }

          // console.log(`[AUTH_AUTHORIZE_CB] User ${dbUser.email} authorized. Role: ${dbUser.role}`);
          // This object must match the augmented 'User' type in next-auth.d.ts
          return {
            id: dbUser.id,
            email: dbUser.email,
            firstName: dbUser.firstName,
            lastName: dbUser.lastName,
            role: dbUser.role, // This is your Prisma UserRole enum type
            name: `${dbUser.firstName} ${dbUser.lastName}`, // Expected by DefaultUser
            image: dbUser.profilePicture, // Expected by DefaultUser
          };
        } catch (error) {
          console.error('[AUTH_AUTHORIZE_CB] Error:', error);
          return null;
        }
      }
    })
    // Add other providers like GoogleProvider here if needed in the future
  ],
  session: {
    strategy: 'jwt', // Using JWT for session strategy
  },
  callbacks: {
    async jwt({ token, user }) {
      // The 'user' object is passed on initial sign-in from the 'authorize' function or OAuth profile.
      // It should match the augmented 'User' type from next-auth.d.ts
      // console.log('[AUTH_JWT_CB] User object on sign-in:', JSON.stringify(user, null, 2));
      if (user) {
        token.uid = user.id;                // Persist user.id (from PrismaUser) as uid in token
        token.role = user.role as UserRole; // Persist user.role (from PrismaUser)
        token.firstName = user.firstName;   // Persist firstName
        token.lastName = user.lastName;     // Persist lastName
        // token.name and token.email are often automatically populated by NextAuth if present in user obj
      }
      // console.log('[AUTH_JWT_CB] Token after processing:', JSON.stringify(token, null, 2));
      return token;
    },
    async session({ session, token }) {
      // 'token' here is the JWT object from the 'jwt' callback (should match augmented JWT type from next-auth.d.ts)
      // 'session.user' will be augmented by 'next-auth.d.ts'.
      // console.log('[AUTH_SESSION_CB] Token received to hydrate session:', JSON.stringify(token, null, 2));
      if (token && session.user) {
        session.user.id = token.uid as string; // Get id from token.uid
        session.user.role = token.role as UserRole; // Get role from token.role
        session.user.firstName = token.firstName as string | null | undefined;
        session.user.lastName = token.lastName as string | null | undefined;
        // session.user.name and session.user.email are often automatically populated by NextAuth from token
      }
      // console.log('[AUTH_SESSION_CB] Session object after processing:', JSON.stringify(session, null, 2));
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET, // Your NextAuth secret from .env
  pages: {
    signIn: '/login',      // Path to your custom login page
    error: '/error',       // Optional: Path to a custom error page for auth errors
    // signOut: '/auth/logout', // Optional: Custom sign out page
    // verifyRequest: '/auth/verify-request', // For E-mail provider
    // newUser: '/auth/new-user' // New users will be directed here on first sign in
  },
  debug: process.env.NODE_ENV === 'development', // Enable more verbose NextAuth logging in development
};