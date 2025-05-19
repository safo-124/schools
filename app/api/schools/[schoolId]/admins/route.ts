// app/api/schools/[schoolId]/admins/route.ts
import { NextRequest, NextResponse } from 'next/server';
// PrismaClient import is not needed here if using shared prisma instance from lib/db
import { UserRole, Prisma } from '@prisma/client'; 
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth'; // Ensure this path is correct
import prisma from '@/lib/db'; // Using shared Prisma instance
import bcrypt from 'bcryptjs';
import { z } from 'zod';

// Zod schema for creating a school admin
const createSchoolAdminSchema = z.object({
  email: z.string().email("Invalid email address."),
  firstName: z.string().min(1, "First name is required."),
  lastName: z.string().min(1, "Last name is required."),
  password: z.string().min(6, "Password must be at least 6 characters long."),
});

// REMOVE the custom RouteContext interface
// interface RouteContext {
//   params: {
//     schoolId: string;
//   };
// }

// POST Handler: Assign/Create a School Admin for a specific school
export async function POST(
  request: NextRequest, 
  context: any // <<< TYPE BYPASS APPLIED HERE
) {
  const params = context.params as { schoolId: string }; // Internal type assertion
  const { schoolId } = params;

  console.log(`[API_SCHOOL_ADMINS_POST] Request to add admin to schoolId: ${schoolId}`);
  try {
    if (typeof schoolId !== 'string' || !schoolId) {
        console.warn('[API_SCHOOL_ADMINS_POST] schoolId is missing or not a string from context.params');
        return NextResponse.json({ message: 'School ID is required and must be a string' }, { status: 400 });
    }

    // 1. Authenticate and Authorize Super Admin
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json({ message: 'Unauthorized: Only Super Admins can assign school admins.' }, { status: 403 });
    }

    // 2. Validate School's Existence
    const school = await prisma.school.findUnique({ where: { id: schoolId } });
    if (!school) {
      return NextResponse.json({ message: 'School not found' }, { status: 404 });
    }

    // 3. Parse and Validate Request Body
    const body = await request.json();
    console.log("[API_SCHOOL_ADMINS_POST] Received body:", JSON.stringify(body, null, 2));
    const validation = createSchoolAdminSchema.safeParse(body);

    if (!validation.success) {
      console.error("[API_SCHOOL_ADMINS_POST] Zod validation failed:", JSON.stringify(validation.error.flatten().fieldErrors, null, 2));
      return NextResponse.json({ message: 'Invalid input', errors: validation.error.flatten().fieldErrors }, { status: 400 });
    }

    const { email, firstName, lastName, password } = validation.data;

    // 4. Handle User Creation or Linking
    let targetUser = await prisma.user.findUnique({
      where: { email },
    });

    if (!targetUser) {
      // User does not exist, create them
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      targetUser = await prisma.user.create({
        data: {
          email,
          firstName,
          lastName,
          hashedPassword,
          role: UserRole.SCHOOL_ADMIN, // Assign SCHOOL_ADMIN role to the User
          isActive: true,
        },
      });
      console.log(`[API_SCHOOL_ADMINS_POST] New user created for School Admin role: ${targetUser.email}`);
    } else {
      // User exists. Check if they are already an admin of THIS school.
      console.log(`[API_SCHOOL_ADMINS_POST] User ${email} already exists. Role: ${targetUser.role}.`);
      // Optionally, update their primary role to SCHOOL_ADMIN if it's different and appropriate
      if (targetUser.role !== UserRole.SCHOOL_ADMIN && targetUser.role !== UserRole.SUPER_ADMIN) {
        // This is a business logic decision: should assigning as SchoolAdmin upgrade their User.role?
        // For now, we won't change User.role if they exist, but this might need refinement.
        // The SchoolAdmin table link is what grants specific school admin rights.
        console.warn(`User ${email} exists with role ${targetUser.role}. They will be linked as a School Admin to school ${schoolId}. Their primary User.role on the User table is not changed by this operation unless explicitly handled.`);
        // If you decide to update User.role:
        // await prisma.user.update({ where: { id: targetUser.id }, data: { role: UserRole.SCHOOL_ADMIN }});
      }
    }

    // 5. Check if user is already an admin for this specific school
    const existingSchoolAdminLink = await prisma.schoolAdmin.findUnique({
      where: {
        userId_schoolId: { // This refers to the @@unique([userId, schoolId]) constraint in SchoolAdmin model
          userId: targetUser.id,
          schoolId: schoolId,
        },
      },
    });

    if (existingSchoolAdminLink) {
      return NextResponse.json({ message: `User ${email} is already an administrator for this school.` }, { status: 409 });
    }

    // 6. Create the SchoolAdmin link
    const newSchoolAdminLink = await prisma.schoolAdmin.create({
      data: {
        userId: targetUser.id, // Link to the User record
        schoolId: schoolId,   // Link to the School record
        jobTitle: "School Administrator", 
      },
      include: { // Include user details in the response
          user: { select: { id: true, email: true, firstName: true, lastName: true, role: true, isActive: true }}
      }
    });

    console.log(`[API_SCHOOL_ADMINS_POST] User ${targetUser.email} successfully assigned as School Administrator for school ${schoolId}.`);
    return NextResponse.json({
      message: `User ${targetUser.email} successfully assigned as School Administrator.`,
      schoolAdmin: newSchoolAdminLink,
    }, { status: 201 });

  } catch (error: any) {
    console.error(`[API_SCHOOL_ADMINS_POST] Error assigning school admin to school ${schoolId || 'unknown'}:`, error.name, error.message, error.stack);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') { 
        return NextResponse.json({ message: `A user with this email might already exist with a conflicting unique constraint, or the SchoolAdmin link already exists.` }, { status: 409 });
      }
      return NextResponse.json({ message: `Database error: ${error.code}` }, { status: 500 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Invalid input (Zod final check)', errors: error.errors }, { status: 400 });
    }
    return NextResponse.json({ message: 'An unexpected error occurred while assigning school admin.' }, { status: 500 });
  }
}

// GET Handler: List all admins for a specific school
export async function GET(
  request: NextRequest, 
  context: any // <<< TYPE BYPASS APPLIED HERE
) {
    const params = context.params as { schoolId: string }; // Internal type assertion
    const { schoolId } = params;

    console.log(`[API_SCHOOL_ADMINS_GET] Request to list admins for schoolId: ${schoolId}`);
    try {
        if (typeof schoolId !== 'string' || !schoolId) {
            console.warn('[API_SCHOOL_ADMINS_GET] schoolId is missing or not a string from context.params');
            return NextResponse.json({ message: 'School ID is required and must be a string' }, { status: 400 });
        }

        const session = await getServerSession(authOptions);
        // Only Super Admin should list admins for any school by ID.
        // School Admins viewing their own colleagues might use a different, non-parameterized route.
        if (!session?.user?.id || session.user.role !== UserRole.SUPER_ADMIN) {
            return NextResponse.json({ message: 'Unauthorized: Insufficient privileges' }, { status: 403 });
        }

        const schoolAdmins = await prisma.schoolAdmin.findMany({
            where: { schoolId: schoolId },
            include: {
                user: {
                    select: { id: true, email: true, firstName: true, lastName: true, isActive: true, role: true }
                }
            },
            orderBy: { user: { firstName: 'asc' } }
        });
        console.log(`[API_SCHOOL_ADMINS_GET] Found ${schoolAdmins.length} admins for school ${schoolId}.`);
        return NextResponse.json(schoolAdmins, { status: 200 });

    } catch (error: any) {
        console.error(`[API_SCHOOL_ADMINS_GET] Error fetching admins for school ${schoolId || 'unknown'}:`, error.name, error.message);
        return NextResponse.json({ message: 'An unexpected error occurred while fetching school administrators.' }, { status: 500 });
    }
}