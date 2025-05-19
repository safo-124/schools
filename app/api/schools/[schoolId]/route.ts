// app/api/schools/[schoolId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient, UserRole, Prisma, TermPeriod } from '@prisma/client'; // TermPeriod is IMPORTED HERE
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth'; // Adjust path if your authOptions are elsewhere
import { z } from 'zod';

const prisma = new PrismaClient();

// Schema for updating a school (all fields optional for PATCH)
const updateSchoolSchema = z.object({
  name: z.string().min(3, "School name must be at least 3 characters").optional(),
  schoolEmail: z.string().email("Invalid email address").optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  stateOrRegion: z.string().optional(),
  country: z.string().optional(),
  phoneNumber: z.string().optional(),
  website: z.string().url("Invalid URL for website").optional().or(z.literal('')), // Allow empty string or valid URL
  currentAcademicYear: z.string().optional(),
  currentTerm: z.nativeEnum(TermPeriod).optional(), // TermPeriod is now defined via import
  currency: z.string().optional(),
  timezone: z.string().optional(),
  isActive: z.boolean().optional(),
});

interface RouteContext {
  params: {
    schoolId: string;
  };
}

// GET Handler: Fetch a single school by ID
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

    const school = await prisma.school.findUnique({
      where: { id: schoolId },
    });

    if (!school) {
      return NextResponse.json({ message: 'School not found' }, { status: 404 });
    }

    return NextResponse.json(school, { status: 200 });

  } catch (error) {
    console.error(`Error fetching school ${params.schoolId}:`, error);
    return NextResponse.json({ message: 'An unexpected error occurred while fetching school details' }, { status: 500 });
  }
}


// PATCH Handler: Update a school by ID
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
    }

    const { schoolId } = params;
    if (!schoolId) {
      return NextResponse.json({ message: 'School ID is required' }, { status: 400 });
    }

    const body = await req.json();
    const validation = updateSchoolSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ message: 'Invalid input', errors: validation.error.flatten().fieldErrors }, { status: 400 });
    }

    const dataToUpdate = validation.data;

    // If schoolEmail is being updated, check for uniqueness if it's different from the current one
    if (dataToUpdate.schoolEmail) {
      const currentSchool = await prisma.school.findUnique({ where: { id: schoolId }, select: { schoolEmail: true } });
      if (currentSchool && currentSchool.schoolEmail !== dataToUpdate.schoolEmail) {
        const existingSchoolWithNewEmail = await prisma.school.findUnique({
          where: { schoolEmail: dataToUpdate.schoolEmail },
          select: { id: true }
        });
        if (existingSchoolWithNewEmail) {
          return NextResponse.json({ message: `Another school already uses the email ${dataToUpdate.schoolEmail}` }, { status: 409 });
        }
      }
    }

    const updatedSchool = await prisma.school.update({
      where: { id: schoolId },
      data: dataToUpdate,
    });

    return NextResponse.json(updatedSchool, { status: 200 });

  } catch (error) {
    console.error(`Error updating school ${params.schoolId}:`, error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') { // Record to update not found
        return NextResponse.json({ message: 'School not found to update' }, { status: 404 });
      }
      // Handle other specific Prisma errors if needed
      return NextResponse.json({ message: `Database error: ${error.code}. Check server logs.` }, { status: 500 });
    }
    // ZodError should be caught by safeParse, but this is a fallback
    if (error instanceof z.ZodError) { 
      return NextResponse.json({ message: 'Invalid input during final processing.', errors: error.errors }, { status: 400 });
    }
    return NextResponse.json({ message: 'An unexpected error occurred while updating the school' }, { status: 500 });
  }
}