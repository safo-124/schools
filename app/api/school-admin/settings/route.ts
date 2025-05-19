// app/api/school-admin/settings/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth'; // Adjust path as needed
import prisma from '@/lib/db';
import { UserRole, Prisma, TermPeriod } from '@prisma/client';
import { z } from 'zod';

// Zod schema for updating school settings by a School Admin
// Only include fields a School Admin should be able to modify for their school
const updateSchoolSettingsApiSchema = z.object({
  currentAcademicYear: z.string()
    .regex(/^\d{4}-\d{4}$/, "Academic year must be in YYYY-YYYY format (e.g., 2024-2025).")
    .refine(year => {
        if(!year) return true; // Allow optional via .optional() later
        const years = year.split('-');
        return parseInt(years[0]) + 1 === parseInt(years[1]);
    }, "Academic year range must be consecutive (e.g., 2024-2025).")
    .optional().or(z.literal('')).nullable(), // Allow clearing or not sending
  currentTerm: z.nativeEnum(TermPeriod).optional().nullable(), // Allow clearing or not sending
  
  // School-specific contact details they might manage
  phoneNumber: z.string().optional().or(z.literal('')).nullable(),
  website: z.string().url("Invalid URL for website").optional().or(z.literal('')).nullable(),
  // Address components might be editable too, if desired
  address: z.string().optional().or(z.literal('')).nullable(),
  city: z.string().optional().or(z.literal('')).nullable(),
  stateOrRegion: z.string().optional().or(z.literal('')).nullable(),
  country: z.string().optional().or(z.literal('')).nullable(),
  postalCode: z.string().optional().or(z.literal('')).nullable(),
  logoUrl: z.string().url("Logo URL must be a valid URL if provided").optional().or(z.literal('')).nullable(),
  // Note: School 'name' and 'schoolEmail' are typically managed by Super Admin.
});

// GET Handler: Fetch current settings for the School Admin's school
export async function GET(req: NextRequest) {
  console.log('[API_SCH_SETTINGS_GET] Received request to fetch school settings.');
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
      return NextResponse.json({ message: 'Admin not associated with any school.' }, { status: 404 });
    }
    const schoolId = adminSchoolLink.schoolId;

    const schoolSettings = await prisma.school.findUnique({
      where: { id: schoolId },
      // Select fields relevant for display and potential editing by School Admin
      select: {
        id: true,
        name: true, // Display, but not editable by School Admin via this route
        schoolEmail: true, // Display, but not editable
        address: true,
        city: true,
        stateOrRegion: true,
        country: true,
        postalCode: true,
        phoneNumber: true,
        website: true,
        logoUrl: true,
        currentAcademicYear: true,
        currentTerm: true,
        currency: true, // Display, likely not editable by School Admin
        timezone: true, // Display, likely not editable
        isActive: true, // Display, managed by Super Admin
        createdAt: true,
        updatedAt: true,
      }
    });

    if (!schoolSettings) {
      return NextResponse.json({ message: 'School settings not found.' }, { status: 404 });
    }

    return NextResponse.json(schoolSettings, { status: 200 });

  } catch (error) {
    console.error('[API_SCH_SETTINGS_GET] Error fetching school settings:', error);
    return NextResponse.json({ message: 'An unexpected error occurred while fetching school settings.' }, { status: 500 });
  }
}

// PATCH Handler: Update settings for the School Admin's school
export async function PATCH(req: NextRequest) {
  console.log('[API_SCH_SETTINGS_PATCH] Received request to update school settings.');
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
    console.log("[API_SCH_SETTINGS_PATCH] Received body for update:", JSON.stringify(body, null, 2));
    
    const validation = updateSchoolSettingsApiSchema.safeParse(body);
    if (!validation.success) {
      console.error("[API_SCH_SETTINGS_PATCH] Zod validation failed:", JSON.stringify(validation.error.flatten().fieldErrors, null, 2));
      return NextResponse.json({ message: 'Invalid input', errors: validation.error.flatten().fieldErrors }, { status: 400 });
    }

    const dataToUpdate = validation.data;
    
    // Prepare data for Prisma, converting empty strings to null for nullable fields if necessary
    const prismaData: Prisma.SchoolUpdateInput = {};
    for (const key in dataToUpdate) {
        const typedKey = key as keyof typeof dataToUpdate;
        if (dataToUpdate[typedKey] !== undefined) { // Only include fields present in the validated data
            if (dataToUpdate[typedKey] === '' && 
                (typedKey === 'currentAcademicYear' || typedKey === 'currentTerm' || typedKey === 'phoneNumber' || typedKey === 'website' || typedKey === 'address' || typedKey === 'city' || typedKey === 'stateOrRegion' || typedKey === 'country' || typedKey === 'postalCode' || typedKey === 'logoUrl' )) {
                prismaData[typedKey] = null;
            } else {
                (prismaData as any)[typedKey] = dataToUpdate[typedKey];
            }
        }
    }
    
    if (Object.keys(prismaData).length === 0) {
        return NextResponse.json({ message: 'No valid fields provided for update.' }, { status: 400 });
    }

    const updatedSchoolSettings = await prisma.school.update({
      where: { id: schoolId },
      data: prismaData,
    });

    console.log(`[API_SCH_SETTINGS_PATCH] School settings for school ${schoolId} updated successfully.`);
    return NextResponse.json(updatedSchoolSettings, { status: 200 });

  } catch (error) {
    console.error('[API_SCH_SETTINGS_PATCH] Error updating school settings:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') { // Record to update not found
        return NextResponse.json({ message: 'School not found to update.' }, { status: 404 });
      }
      return NextResponse.json({ message: `Database error: ${error.code}. Check server logs.` }, { status: 500 });
    }
    if (error instanceof z.ZodError) { // Should be caught by safeParse
        return NextResponse.json({ message: 'Invalid input (Zod final check)', errors: error.errors }, { status: 400 });
    }
    return NextResponse.json({ message: 'An unexpected error occurred while updating school settings.' }, { status: 500 });
  }
}