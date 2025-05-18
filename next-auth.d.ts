// next-auth.d.ts
import NextAuth, { DefaultSession, DefaultUser, User as NextAuthDefaultUser } from "next-auth";
import { JWT, DefaultJWT } from "next-auth/jwt";
import { UserRole } from "@prisma/client"; // Import your Prisma UserRole enum

declare module "next-auth" {
  /**
   * Returned by `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
   */
  interface Session {
    user: {
      id: string;
      role: UserRole;
      firstName?: string | null;
      lastName?: string | null;
      // You can add other custom properties here if needed
    } & DefaultSession["user"]; // Keep other default session user properties (name, email, image)
  }

  /**
   * The shape of the user object returned from the `authorize` callback in CredentialsProvider.
   * This is also the `user` argument in the `jwt` callback during sign-in.
   */
  interface User extends NextAuthDefaultUser { // DefaultUser has id (optional), name, email, image
    id: string; // Ensure id is a non-optional string
    role: UserRole;
    firstName?: string | null;
    lastName?: string | null;
    // Ensure this matches what your `authorize` function returns
  }
}

declare module "next-auth/jwt" {
  /** Returned by the `jwt` callback and `getToken`, when using JWT sessions */
  interface JWT extends DefaultJWT { // DefaultJWT has name, email, picture, sub (usually user id)
    // Add your custom token properties here
    uid: string; // Storing user ID as 'uid' because 'sub' is standard for subject (user id)
    role: UserRole;
    firstName?: string | null;
    lastName?: string | null;
    // 'name' and 'email' from DefaultJWT are usually populated from user object
  }
}