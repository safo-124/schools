// next-auth.d.ts
import  { DefaultSession, DefaultUser } from "next-auth";
import { DefaultJWT } from "next-auth/jwt";
import { UserRole } from "@prisma/client"; // Import your Prisma UserRole

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      firstName?: string | null;
      lastName?: string | null;
    } & DefaultSession["user"]; 
  }

  interface User extends DefaultUser {
    id: string; 
    role: UserRole;
    firstName?: string | null;
    lastName?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    uid: string; // Storing user ID as 'uid'
    role: UserRole;
    firstName?: string | null;
    lastName?: string | null;
  }
}