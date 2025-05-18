// app/api/schools/[schoolId]/admins/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient, UserRole, Prisma } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route'; // Adjust path
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const prisma = new PrismaClient();

// Zod schema for creating a school admin
const createSchoolAdminSchema = z.object({
  email: z.string().email("Invalid email address."),
  firstName: z.string().min(1, "First name is required."),
  lastName: z.string().min(1, "Last name is required."),
  password: z.string().min(6, "Password must be at least 6 characters long."), // For creating a new user
  // phoneNumber: z.string().optional(), // Optional
});

interface RouteContext {
  params: {
    schoolId: string;
  };
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    // 1. Authenticate and Authorize Super Admin
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
    }

    const { schoolId } = params;
    if (!schoolId) {
      return NextResponse.json({ message: 'School ID is required' }, { status: 400 });
    }

    // 2. Validate School's Existence
    const school = await prisma.school.findUnique({ where: { id: schoolId } });
    if (!school) {
      return NextResponse.json({ message: 'School not found' }, { status: 404 });
    }

    // 3. Parse and Validate Request Body
    const body = await req.json();
    const validation = createSchoolAdminSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ message: 'Invalid input', errors: validation.error.flatten().fieldErrors }, { status: 400 });
    }

    const { email, firstName, lastName, password } = validation.data;

    // 4. Handle User Creation or Linking
    let targetUser = await prisma.user.findUnique({
      where: { email },
    });

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    if (!targetUser) {
      // User does not exist, create them
      targetUser = await prisma.user.create({
        data: {
          email,
          firstName,
          lastName,
          hashedPassword, // Set the hashed password
          role: UserRole.SCHOOL_ADMIN, // Assign SCHOOL_ADMIN role
          isActive: true, // New users are active by default
          // phoneNumber: validation.data.phoneNumber, // If you collect it
        },
      });
      console.log(`New user created for School Admin: ${targetUser.email}`);
    } else {
      // User exists. Check if they are already an admin of this school.
      // Also, consider if you want to update their role or password.
      // For simplicity now, if user exists, we'll just link them if not already linked.
      // You might want to prevent assigning an existing user who isn't already a SCHOOL_ADMIN
      // or has a different critical role, or update their User.role if appropriate.
      // For now, we assume if they exist, we are just linking them to this school as an admin.
      // If their User.role is not SCHOOL_ADMIN, you might want to update it or throw an error.
      // This part can get complex depending on business rules.
      if (targetUser.role !== UserRole.SCHOOL_ADMIN && targetUser.role !== UserRole.SUPER_ADMIN) {
        // Optionally update the user's general role if they are being made a school admin
        // This is a design decision: does becoming a SchoolAdmin change their primary User.role?
        // For now, let's assume their primary role might not change, or if it does, handle with care.
        // For this implementation, we'll prioritize creating the SchoolAdmin link.
        // A more robust solution might update User.role or have a multi-role system.
        console.warn(`User ${email} exists with role ${targetUser.role}. Assigning as School Admin for school ${schoolId}. Their primary User.role remains ${targetUser.role} unless updated separately.`);
      }
    }

    // 5. Check if user is already an admin for this school
    const existingSchoolAdminLink = await prisma.schoolAdmin.findUnique({
      where: {
        userId_schoolId: {
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
        userId: targetUser.id,
        schoolId: schoolId,
        jobTitle: "School Administrator", // Default job title
      },
    });

    return NextResponse.json({
      message: `User ${targetUser.email} successfully assigned as School Administrator.`,
      schoolAdmin: newSchoolAdminLink,
      user: { id: targetUser.id, email: targetUser.email, role: targetUser.role } // Return some user info
    }, { status: 201 });

  } catch (error) {
    console.error(`Error assigning school admin to school ${params.schoolId}:`, error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') { // Unique constraint failed (e.g. if email was meant to be globally unique and user creation failed)
        return NextResponse.json({ message: `A user with this email might already exist or another unique constraint failed.` }, { status: 409 });
      }
      return NextResponse.json({ message: `Database error: ${error.code}` }, { status: 500 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Invalid input (Zod)', errors: error.errors }, { status: 400 });
    }
    return NextResponse.json({ message: 'An unexpected error occurred' }, { status: 500 });
  }
}

// You might also want a GET handler here to list all admins for a school
export async function GET(req: NextRequest, { params }: RouteContext) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id || session.user.role !== UserRole.SUPER_ADMIN) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
        }

        const { schoolId } = params;
        if (!schoolId) {
            return NextResponse.json({ message: 'School ID is required' }, { status: 400 });
        }

        const schoolAdmins = await prisma.schoolAdmin.findMany({
            where: { schoolId: schoolId },
            include: {
                user: {
                    select: { id: true, email: true, firstName: true, lastName: true, isActive: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json(schoolAdmins, { status: 200 });

    } catch (error) {
        console.error(`Error fetching admins for school ${params.schoolId}:`, error);
        return NextResponse.json({ message: 'An unexpected error occurred' }, { status: 500 });
    }
}