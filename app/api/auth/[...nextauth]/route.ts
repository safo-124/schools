// app/api/auth/[...nextauth]/route.ts
import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth'; // <-- IMPORT FROM THE NEW LOCATION

// The actual NextAuth handler, using the imported options
const handler = NextAuth(authOptions);

// Export the handler for GET and POST requests as Next.js expects
export { handler as GET, handler as POST };