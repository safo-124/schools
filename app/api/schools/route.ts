// app/api/schools/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient, UserRole } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route'; // Adjust path if your authOptions are elsewhere
import { z } from 'zod';

const prisma = new PrismaClient();

// Define a schema for validating the request body using Zod
const createSchoolSchema = z.object({
  name: z.string().min(3, { message: "School name must be at least 3 characters long" }),
  schoolEmail: z.string().email({ message: "Invalid email address for school" }),
  address: z.string().optional(),
  city: z.string().optional(),
  stateOrRegion: z.string().optional(),
  country: z.string().optional(),
  phoneNumber: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate and Authorize the user
    const session = await getServerSession(authOptions);

    if (!session?.user?.id || session.user.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
    }

    const loggedInUserRecordId = session.user.id; // This is the ID from the User table

    // --- START FIX ---
    // Find the SuperAdmin profile linked to this User ID
    const superAdminProfile = await prisma.superAdmin.findUnique({
      where: { userId: loggedInUserRecordId }, // Find SuperAdmin record using the User.id
      select: { id: true } // We only need the SuperAdmin record's own ID
    });

    if (!superAdminProfile) {
      // This should not happen if role is SUPER_ADMIN and data is consistent
      console.error(`Critical Error: No SuperAdmin profile found for User ID: ${loggedInUserRecordId} who has SUPER_ADMIN role.`);
      return NextResponse.json({ message: 'Associated Super Admin profile not found for authenticated user.' }, { status: 500 });
    }
    const actualSuperAdminTableId = superAdminProfile.id; // This is the ID from the SuperAdmin table
    // --- END FIX ---

    // 2. Parse and Validate the request body
    const body = await req.json();
    const validation = createSchoolSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ message: 'Invalid input', errors: validation.error.flatten().fieldErrors }, { status: 400 });
    }

    const { name, schoolEmail, ...otherSchoolData } = validation.data;

    // 3. Check if a school with this email already exists
    const existingSchool = await prisma.school.findUnique({
      where: { schoolEmail },
    });

    if (existingSchool) {
      return NextResponse.json({ message: `School with email ${schoolEmail} already exists` }, { status: 409 });
    }
    
    // 4. Create the School in the database
    const newSchool = await prisma.school.create({
      data: {
        name,
        schoolEmail,
        ...otherSchoolData,
        createdBySuperAdminId: actualSuperAdminTableId, // Use the correct ID from the SuperAdmin table
      },
    });

    return NextResponse.json(newSchool, { status: 201 });

  } catch (error) {
    console.error('Error creating school:', error);
    if (error instanceof z.ZodError) {
        return NextResponse.json({ message: 'Invalid input during final processing', errors: error.errors }, { status: 400 });
    }
    // Check for Prisma known request errors (like P2003 if the fix didn't cover all cases)
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2003') {
            return NextResponse.json({ message: `Foreign key constraint failed. Field: ${error.meta?.field_name || 'unknown'}` }, { status: 400 });
        }
    }
    return NextResponse.json({ message: 'An unexpected error occurred while creating the school' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id || session.user.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
    }

    const schools = await prisma.school.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
    return NextResponse.json(schools, { status: 200 });

  } catch (error) {
    console.error('Error fetching schools:', error);
    return NextResponse.json({ message: 'An unexpected error occurred while fetching schools' }, { status: 500 });
  }
}