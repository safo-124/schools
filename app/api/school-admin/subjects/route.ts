// app/api/school-admin/subjects/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route'; // Adjust path as needed
import prisma from '@/lib/db'; // Using shared Prisma instance
import { UserRole, Prisma } from '@prisma/client';
import { z } from 'zod';

// Zod schema for creating a new subject
const createSubjectApiSchema = z.object({
  name: z.string().min(1, "Subject name is required (e.g., Mathematics, Integrated Science)."),
  code: z.string().optional().or(z.literal('')).nullable(), // e.g., MATH101, SCI202. Optional but unique per school if provided.
  description: z.string().optional().or(z.literal('')).nullable(),
});

// GET Handler: List all subjects for the School Admin's school
export async function GET(req: NextRequest) {
  console.log('[API_SUBJECTS_GET_ALL] Received request to fetch all subjects.');
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized: Not logged in' }, { status: 401 });
    }
    // Typically, only School Admins manage subjects for their school.
    // Super Admins might view them via a different route or with a schoolId param.
    if (session.user.role !== UserRole.SCHOOL_ADMIN) {
      return NextResponse.json({ message: 'Forbidden: Insufficient privileges' }, { status: 403 });
    }

    const schoolAdminUserId = session.user.id;
    const adminSchoolLink = await prisma.schoolAdmin.findFirst({
        where: { userId: schoolAdminUserId },
        select: { schoolId: true }
    });

    if (!adminSchoolLink?.schoolId) {
      return NextResponse.json({ message: 'No school associated with your account.' }, { status: 404 });
    }
    const schoolId = adminSchoolLink.schoolId;
    console.log(`[API_SUBJECTS_GET_ALL] Fetching subjects for School ID: ${schoolId}`);

    const subjects = await prisma.subject.findMany({
      where: {
        schoolId: schoolId,
      },
      orderBy: [
        { name: 'asc' },
      ],
      // Optionally include counts of related items if needed for the list view
      // include: {
      //   _count: {
      //     select: { assignments: true, timetableSlots: true }
      //   }
      // }
    });
    console.log(`[API_SUBJECTS_GET_ALL] Found ${subjects.length} subjects for school ID: ${schoolId}`);
    return NextResponse.json(subjects, { status: 200 });

  } catch (error) {
    console.error('[API_SUBJECTS_GET_ALL] An error occurred:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
        return NextResponse.json({ message: `Database error: ${error.message}` }, { status: 500 });
    }
    return NextResponse.json({ message: 'An unexpected error occurred while fetching subjects.' }, { status: 500 });
  }
}


// POST Handler for creating a new subject
export async function POST(req: NextRequest) {
  console.log('[API_SUBJECTS_POST] Received request to create subject.');
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.role !== UserRole.SCHOOL_ADMIN) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
    }
    const schoolAdminUserId = session.user.id;

    const adminSchoolLink = await prisma.schoolAdmin.findFirst({
      where: { userId: schoolAdminUserId },
      select: { schoolId: true }
    });
    if (!adminSchoolLink?.schoolId) {
      return NextResponse.json({ message: 'Admin not associated with any school.' }, { status: 400 });
    }
    const schoolId = adminSchoolLink.schoolId;

    const body = await req.json();
    console.log("[API_SUBJECTS_POST] Received body:", JSON.stringify(body, null, 2));
    
    const validation = createSubjectApiSchema.safeParse(body);
    if (!validation.success) {
      console.error("[API_SUBJECTS_POST] Zod validation failed:", JSON.stringify(validation.error.flatten().fieldErrors, null, 2));
      return NextResponse.json({ message: 'Invalid input', errors: validation.error.flatten().fieldErrors }, { status: 400 });
    }
    
    const { name, code, description } = validation.data;

    // Prisma schema has @@unique([schoolId, name]) and @@unique([schoolId, code])
    // So Prisma will throw P2002 if these constraints are violated.

    const newSubject = await prisma.subject.create({
      data: {
        schoolId,
        name,
        code: code || null, // Store empty string as null if preferred and schema allows
        description: description || null,
      },
    });

    console.log(`[API_SUBJECTS_POST] Subject "${newSubject.name}" created successfully for school ${schoolId}`);
    return NextResponse.json(newSubject, { status: 201 });

  } catch (error) {
    console.error('[API_SUBJECTS_POST] An error occurred:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') { 
        // This error is thrown when a unique constraint is violated (e.g., name or code for the same schoolId)
        const target = error.meta?.target as string[] | undefined;
        let fieldMessage = "name or code";
        if (target?.includes('name')) fieldMessage = "name";
        else if (target?.includes('code')) fieldMessage = "code";
        
        return NextResponse.json({ message: `A subject with the same ${fieldMessage} already exists in this school.` }, { status: 409 });
      }
      return NextResponse.json({ message: `Database error occurred: ${error.message}` }, { status: 500 });
    }
    if (error instanceof z.ZodError) { // Should be caught by safeParse earlier
        return NextResponse.json({ message: 'Invalid input (Zod final check)', errors: error.errors }, { status: 400 });
    }
    return NextResponse.json({ message: 'An unexpected error occurred while creating the subject.' }, { status: 500 });
  }
}