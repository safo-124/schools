// app/api/auth/[...nextauth]/route.ts
import NextAuth, { AuthOptions, User as NextAuthUser } from 'next-auth'; // User here is from 'next-auth' library
import CredentialsProvider from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { PrismaClient, UserRole, User as PrismaUser } from '@prisma/client'; // UserRole and PrismaUser for clarity
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// The `User` type for NextAuth is augmented via `next-auth.d.ts`
// The object returned by `authorize` should match the augmented `User` type.

export const authOptions: AuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: "Email", type: "email", placeholder: "user@example.com" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials): Promise<NextAuthUser | null> { // Return type matches augmented NextAuthUser
        console.log('[AUTH_AUTHORIZE_CB] Attempting to authorize user...');
        if (!credentials?.email || !credentials?.password) {
          console.log('[AUTH_AUTHORIZE_CB] Missing email or password.');
          return null;
        }
        try {
          const dbUser: PrismaUser | null = await prisma.user.findUnique({ // Use PrismaUser for db result
            where: { email: credentials.email }
          });

          if (!dbUser) {
            console.log(`[AUTH_AUTHORIZE_CB] No user found for email: ${credentials.email}`);
            return null;
          }
          if (!dbUser.hashedPassword) {
            console.log(`[AUTH_AUTHORIZE_CB] User ${credentials.email} has no password set.`);
            return null;
          }
          if (!dbUser.isActive) {
            console.log(`[AUTH_AUTHORIZE_CB] User ${credentials.email} is not active.`);
            // For specific error feedback on client: throw new Error("ACCOUNT_INACTIVE");
            return null;
          }

          const isValidPassword = await bcrypt.compare(credentials.password, dbUser.hashedPassword);
          if (!isValidPassword) {
            console.log(`[AUTH_AUTHORIZE_CB] Invalid password for user: ${credentials.email}`);
            return null;
          }

          console.log(`[AUTH_AUTHORIZE_CB] User ${dbUser.email} authorized successfully. Role: ${dbUser.role}`);
          // This object structure must match the augmented `User` type in `next-auth.d.ts`
          return {
            id: dbUser.id, // from PrismaUser
            email: dbUser.email, // from PrismaUser
            firstName: dbUser.firstName, // from PrismaUser
            lastName: dbUser.lastName, // from PrismaUser
            role: dbUser.role, // from PrismaUser
            name: `${dbUser.firstName} ${dbUser.lastName}`, // NextAuth DefaultUser expects name
            image: dbUser.profilePicture, // NextAuth DefaultUser expects image
          };
        } catch (error) {
          console.error('[AUTH_AUTHORIZE_CB] Error:', error);
          return null;
        }
      }
    })
    // Example: GoogleProvider (ensure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are in .env)
    // import GoogleProvider from "next-auth/providers/google";
    // GoogleProvider({
    //   clientId: process.env.GOOGLE_CLIENT_ID as string,
    //   clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    // }),
  ],
  session: {
    strategy: 'jwt', // JSON Web Tokens for session strategy
  },
  callbacks: {
    async jwt({ token, user, account, profile }) {
      // 'user' object is passed on initial sign-in (from authorize or OAuth profile)
      // It should match the augmented 'User' type from next-auth.d.ts
      console.log('[AUTH_JWT_CB] Initial user object (on sign-in):', JSON.stringify(user, null, 2));
      if (user) {
        token.uid = user.id; // Persist user.id to token as uid
        token.role = user.role; // Persist user.role (which should be UserRole type)
        token.firstName = user.firstName; // Persist firstName
        token.lastName = user.lastName;   // Persist lastName
        // token.name and token.email are often automatically populated by NextAuth if user object has them
      }
      console.log('[AUTH_JWT_CB] Token after processing:', JSON.stringify(token, null, 2));
      return token;
    },
    async session({ session, token }) {
      // 'token' here is the JWT object from the 'jwt' callback (should match augmented JWT type)
      // 'session.user' will be augmented by 'next-auth.d.ts'
      console.log('[AUTH_SESSION_CB] Token received to hydrate session:', JSON.stringify(token, null, 2));
      if (token && session.user) {
        session.user.id = token.uid as string; // Get id from token.uid
        session.user.role = token.role as UserRole; // Get role from token.role
        session.user.firstName = token.firstName as string | null | undefined; // Get firstName
        session.user.lastName = token.lastName as string | null | undefined; // Get lastName
        // session.user.name and session.user.email are often automatically populated by NextAuth
      } else {
        console.warn('[AUTH_SESSION_CB] Token or session.user missing. Session might be incomplete.');
      }
      console.log('[AUTH_SESSION_CB] Session object after processing:', JSON.stringify(session, null, 2));
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: '/login', // Your custom login page
    error: '/error', // Optional: A page to display authentication errors (e.g., ?error=CredentialsSignin)
  },
  debug: process.env.NODE_ENV === 'development', // More verbose NextAuth logs in development
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };