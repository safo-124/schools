// app/api/school-admin/classes/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route'; // Adjust path as needed
import prisma from '@/lib/db'; // Using shared Prisma instance
import { UserRole, Prisma } from '@prisma/client';
import { z } from 'zod';

// Zod schema for creating a new class
const createClassApiSchema = z.object({
  name: z.string().min(1, "Class name/level is required (e.g., Grade 1, JHS 2)."),
  section: z.string().optional().or(z.literal('')).nullable(), // e.g., A, Blue, Gold. Optional.
  academicYear: z.string().regex(/^\d{4}-\d{4}$/, "Academic year must be in YYYY-YYYY format (e.g., 2024-2025)."),
  homeroomTeacherId: z.string().cuid("Invalid Homeroom Teacher ID format.").optional().nullable(),
});

// GET Handler: List all classes for the School Admin's school
export async function GET(req: NextRequest) {
  console.log('[API_CLASSES_GET_ALL] Received request to fetch all classes.');
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized: Not logged in' }, { status: 401 });
    }
    if (session.user.role !== UserRole.SCHOOL_ADMIN && session.user.role !== UserRole.SUPER_ADMIN) { // Also allow Super Admin if they provide schoolId
      return NextResponse.json({ message: 'Forbidden: Insufficient privileges' }, { status: 403 });
    }

    let schoolId: string | undefined;
    const url = new URL(req.url);

    if (session.user.role === UserRole.SCHOOL_ADMIN) {
      const schoolAdminUserId = session.user.id;
      const adminSchoolLink = await prisma.schoolAdmin.findFirst({
          where: { userId: schoolAdminUserId },
          select: { schoolId: true }
      });
      if (!adminSchoolLink?.schoolId) {
        return NextResponse.json({ message: 'No school associated with your account.' }, { status: 404 });
      }
      schoolId = adminSchoolLink.schoolId;
    } else if (session.user.role === UserRole.SUPER_ADMIN) {
        schoolId = url.searchParams.get('schoolId') || undefined;
        if (!schoolId && !url.searchParams.get('simple')) { // simple list for Super Admin might list all classes across system
            // For a detailed list, Super Admin should specify schoolId
            // For now, if not simple and no schoolId, we won't proceed
            return NextResponse.json({ message: 'Super Admin must specify schoolId for a detailed class list.' }, { status: 400 });
        }
    }

    if (!schoolId && !url.searchParams.get('simple')) { // if no schoolId after checks and not a simple list request
        return NextResponse.json({ message: 'School context could not be determined.'}, { status: 400 });
    }

    const simpleList = url.searchParams.get('simple') === 'true';

    const classes = await prisma.class.findMany({
      where: {
        ...(schoolId && { schoolId: schoolId }), // Filter by schoolId if available
      },
      select: simpleList ? { // For dropdowns
        id: true,
        name: true,
        section: true,
        academicYear: true,
      } : { // For management page list
        id: true,
        name: true,
        section: true,
        academicYear: true,
        homeroomTeacher: {
          select: {
            id: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
              }
            }
          }
        },
        _count: { // Example: count students in each class
          select: { studentsEnrolled: true } 
        }
      },
      orderBy: [
        { academicYear: 'desc' },
        { name: 'asc' },
        { section: 'asc' },
      ],
    });
    console.log(`[API_CLASSES_GET_ALL] Found ${classes.length} classes.`);
    return NextResponse.json(classes, { status: 200 });

  } catch (error) {
    console.error('[API_CLASSES_GET_ALL] An error occurred:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
        return NextResponse.json({ message: `Database error: ${error.message}` }, { status: 500 });
    }
    return NextResponse.json({ message: 'An unexpected error occurred while fetching classes.' }, { status: 500 });
  }
}


// POST Handler for creating a new class
export async function POST(req: NextRequest) {
  console.log('[API_CLASSES_POST] Received request to create class.');
  try {
    // 1. Authenticate and Authorize School Admin
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.role !== UserRole.SCHOOL_ADMIN) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
    }
    const schoolAdminUserId = session.user.id;

    // 2. Get School ID for this admin
    const adminSchoolLink = await prisma.schoolAdmin.findFirst({
      where: { userId: schoolAdminUserId },
      select: { schoolId: true }
    });
    if (!adminSchoolLink?.schoolId) {
      return NextResponse.json({ message: 'Admin not associated with any school.' }, { status: 400 });
    }
    const schoolId = adminSchoolLink.schoolId;

    // 3. Parse and Validate Request Body
    const body = await req.json();
    console.log("[API_CLASSES_POST] Received body:", JSON.stringify(body, null, 2));
    
    const validation = createClassApiSchema.safeParse(body);
    if (!validation.success) {
      console.error("[API_CLASSES_POST] Zod validation failed:", JSON.stringify(validation.error.flatten().fieldErrors, null, 2));
      return NextResponse.json({ message: 'Invalid input', errors: validation.error.flatten().fieldErrors }, { status: 400 });
    }
    
    const { name, section, academicYear, homeroomTeacherId } = validation.data;

    // 4. Additional Validations (e.g., homeroom teacher belongs to this school)
    if (homeroomTeacherId) {
      const teacherExists = await prisma.teacher.findFirst({
        where: {
          id: homeroomTeacherId,
          schoolId: schoolId, // Ensure teacher is from the same school
        }
      });
      if (!teacherExists) {
        return NextResponse.json({ message: `Homeroom teacher with ID ${homeroomTeacherId} not found in this school.` }, { status: 400 });
      }
    }
    
    // Prisma schema's @@unique constraint handles name+section+academicYear+schoolId uniqueness.
    // P2002 will be thrown if violated.

    // 5. Create Class record
    const newClass = await prisma.class.create({
      data: {
        schoolId,
        name,
        section: section || null, // Store empty string as null if preferred
        academicYear,
        homeroomTeacherId: homeroomTeacherId || null,
      },
      include: { // Include details in the response for confirmation
        homeroomTeacher: {
            select: { user: { select: { firstName: true, lastName: true }}}
        }
      }
    });

    console.log(`[API_CLASSES_POST] Class "${newClass.name} - ${newClass.section || ''}" created successfully for school ${schoolId}`);
    return NextResponse.json(newClass, { status: 201 });

  } catch (error) {
    console.error('[API_CLASSES_POST] An error occurred:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') { // Unique constraint failed
        // The unique constraint is on schoolId, name, section, academicYear
        return NextResponse.json({ message: `A class with the same name, section, and academic year already exists in this school. ${error.meta?.target ? `Constraint: ${(error.meta.target as string[]).join(', ')}` : ''}` }, { status: 409 });
      }
      if (error.code === 'P2003' && error.meta?.field_name === 'Class_homeroomTeacherId_fkey (index)') {
         return NextResponse.json({ message: 'Invalid Homeroom Teacher ID provided. The selected teacher does not exist or does not belong to this school.' }, { status: 400 });
      }
      return NextResponse.json({ message: `Database error occurred: ${error.message}` }, { status: 500 });
    }
    if (error instanceof z.ZodError) {
        return NextResponse.json({ message: 'Invalid input (Zod final check)', errors: error.errors }, { status: 400 });
    }
    return NextResponse.json({ message: 'An unexpected error occurred while creating the class.' }, { status: 500 });
  }
}