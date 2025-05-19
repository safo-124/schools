// app/api/schools/[schoolId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth'; // Ensure this path is correct
import prisma from '@/lib/db'; // Using shared Prisma instance
import { UserRole, Prisma, TermPeriod } from '@prisma/client';
import { z } from 'zod';

// Schema for updating a school (all fields optional for PATCH)
const updateSchoolSchema = z.object({
  name: z.string().min(3, "School name must be at least 3 characters").optional(),
  schoolEmail: z.string().email("Invalid email address").optional(),
  address: z.string().optional().or(z.literal('')).nullable(),
  city: z.string().optional().or(z.literal('')).nullable(),
  stateOrRegion: z.string().optional().or(z.literal('')).nullable(),
  country: z.string().optional().or(z.literal('')).nullable(),
  phoneNumber: z.string().optional().or(z.literal('')).nullable(),
  website: z.string().url("Invalid URL for website").optional().or(z.literal('')).nullable(),
  currentAcademicYear: z.string()
    .regex(/^\d{4}-\d{4}$/, "Academic year format must be YYYY-YYYY (e.g., 2024-2025).")
    .refine(year => {
        if(!year || year === '') return true;
        const years = year.split('-');
        if (years.length !== 2 || !/^\d{4}$/.test(years[0]) || !/^\d{4}$/.test(years[1])) return false;
        return parseInt(years[0]) + 1 === parseInt(years[1]);
    }, "Academic year range must be consecutive (e.g., 2024-2025).")
    .optional().or(z.literal('')).nullable(),
  currentTerm: z.nativeEnum(TermPeriod).optional().nullable(),
  currency: z.string().optional().or(z.literal('')).nullable(),
  timezone: z.string().optional().or(z.literal('')).nullable(),
  isActive: z.boolean().optional(),
});

// REMOVE the custom RouteContext interface
// interface RouteContext {
//   params: {
//     schoolId: string;
//   };
// }

// GET Handler: Fetch a single school by ID
export async function GET(
  request: NextRequest, 
  context: any // <<< TYPE BYPASS APPLIED HERE
) {
  const params = context.params as { schoolId: string }; // Internal type assertion
  const { schoolId } = params;

  console.log(`[API_SCHOOL_GET_ID] Received request for schoolId: ${schoolId}`);
  try {
    if (typeof schoolId !== 'string' || !schoolId) {
        console.warn('[API_SCHOOL_GET_ID] schoolId is missing or not a string from context.params');
        return NextResponse.json({ message: 'School ID is required and must be a string' }, { status: 400 });
    }

    const session = await getServerSession(authOptions);
    // This route is for Super Admin or potentially a School Admin viewing their own school (if logic permits)
    // For now, let's assume Super Admin access or a more general authenticated access if needed later.
    // The provided code had SUPER_ADMIN check, so we'll keep that.
    if (!session?.user?.id || session.user.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json({ message: 'Unauthorized: Insufficient privileges' }, { status: 403 });
    }

    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      // You might want to include linked admins or other details here if needed
      // include: { admins: { include: { user: true } } }
    });

    if (!school) {
      return NextResponse.json({ message: 'School not found' }, { status: 404 });
    }

    // If this route were also for School Admins viewing their own school, an ownership check would be here:
    // if (session.user.role === UserRole.SCHOOL_ADMIN) {
    //   const adminSchoolLink = await prisma.schoolAdmin.findFirst({ where: { userId: session.user.id, schoolId: schoolId }});
    //   if (!adminSchoolLink) return NextResponse.json({ message: 'Forbidden: Not your school' }, { status: 403 });
    // }


    return NextResponse.json(school, { status: 200 });

  } catch (error: any) {
    console.error(`[API_SCHOOL_GET_ID] Error fetching school ${schoolId || 'unknown'}:`, error.name, error.message);
    return NextResponse.json({ message: 'An unexpected error occurred while fetching school details' }, { status: 500 });
  }
}


// PATCH Handler: Update a school by ID (Super Admin only)
export async function PATCH(
  request: NextRequest, 
  context: any // <<< TYPE BYPASS APPLIED HERE
) {
  const params = context.params as { schoolId: string }; // Internal type assertion
  const { schoolId } = params;

  console.log(`[API_SCHOOL_PATCH_ID] Received request to update schoolId: ${schoolId}`);
  try {
    if (typeof schoolId !== 'string' || !schoolId) {
        console.warn('[API_SCHOOL_PATCH_ID] schoolId is missing or not a string from context.params');
        return NextResponse.json({ message: 'School ID is required and must be a string' }, { status: 400 });
    }

    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.role !== UserRole.SUPER_ADMIN) {
      // Only Super Admin can update general school details through this route
      return NextResponse.json({ message: 'Unauthorized: Insufficient privileges' }, { status: 403 });
    }

    // Verify the school exists (Super Admin can edit any school)
    const existingSchool = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { schoolEmail: true } // Select current email for comparison if it's being changed
    });

    if (!existingSchool) {
      return NextResponse.json({ message: 'School not found' }, { status: 404 });
    }

    const body = await request.json();
    console.log("[API_SCHOOL_PATCH_ID] Received body for update:", JSON.stringify(body, null, 2));
    
    // Preprocess amount if it's part of this schema (it's not currently, but if it were)
    // if (body.someAmountField && typeof body.someAmountField === 'string') {
    //     body.someAmountField = parseFloat(body.someAmountField);
    // }

    const validation = updateSchoolSchema.safeParse(body);

    if (!validation.success) {
      console.error("[API_SCHOOL_PATCH_ID] Zod validation failed:", JSON.stringify(validation.error.flatten().fieldErrors, null, 2));
      return NextResponse.json({ message: 'Invalid input', errors: validation.error.flatten().fieldErrors }, { status: 400 });
    }

    const dataToUpdateFromSchema = validation.data;

    // If schoolEmail is being updated, check for uniqueness if it's different from the current one
    if (dataToUpdateFromSchema.schoolEmail && dataToUpdateFromSchema.schoolEmail !== existingSchool.schoolEmail) {
      const schoolWithNewEmail = await prisma.school.findUnique({
        where: { schoolEmail: dataToUpdateFromSchema.schoolEmail },
        select: { id: true }
      });
      if (schoolWithNewEmail && schoolWithNewEmail.id !== schoolId) { // Check it's not the same school record
        return NextResponse.json({ message: `Another school already uses the email ${dataToUpdateFromSchema.schoolEmail}` }, { status: 409 });
      }
    }
    
    const dataForPrisma: Prisma.SchoolUpdateInput = {};
    // Only include fields if they are present in the validated data
    Object.keys(dataToUpdateFromSchema).forEach(key => {
        const typedKey = key as keyof typeof dataToUpdateFromSchema;
        if (dataToUpdateFromSchema[typedKey] !== undefined) {
            if (dataToUpdateFromSchema[typedKey] === '' && 
                (typedKey === 'address' || typedKey === 'city' || typedKey === 'stateOrRegion' || 
                 typedKey === 'country' || typedKey === 'postalCode' || typedKey === 'phoneNumber' || 
                 typedKey === 'website' || typedKey === 'logoUrl' || typedKey === 'currentAcademicYear' ||
                 typedKey === 'currency' || typedKey === 'timezone' || typedKey === 'section' // If section was here
                )
            ) {
                (dataForPrisma as any)[typedKey] = null;
            } else {
                 (dataForPrisma as any)[typedKey] = dataToUpdateFromSchema[typedKey];
            }
        }
    });

    if (Object.keys(dataForPrisma).length === 0) {
        return NextResponse.json({ message: 'No valid fields provided for update.' }, { status: 400 });
    }

    const updatedSchool = await prisma.school.update({
      where: { id: schoolId },
      data: dataForPrisma,
    });
    
    console.log(`[API_SCHOOL_PATCH_ID] School ${schoolId} updated successfully by Super Admin.`);
    return NextResponse.json(updatedSchool, { status: 200 });

  } catch (error: any) {
    console.error(`[API_SCHOOL_PATCH_ID] Error updating school ${schoolId || 'unknown'}:`, error.name, error.message);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') { 
        return NextResponse.json({ message: 'School record not found to update.' }, { status: 404 });
      }
      if (error.code === 'P2002') { // Unique constraint failed (e.g. schoolEmail or name if unique constraint is added)
        const target = error.meta?.target as string[] | undefined;
        return NextResponse.json({ message: `A school with the same unique details already exists. Constraint on: ${target?.join(', ')}` }, { status: 409 });
      }
      return NextResponse.json({ message: `Database error: ${error.code}` }, { status: 500 });
    }
    if (error instanceof z.ZodError) { 
      return NextResponse.json({ message: 'Invalid input (Zod final check)', errors: error.errors }, { status: 400 }); 
    }
    return NextResponse.json({ message: 'An unexpected error occurred while updating the school' }, { status: 500 });
  }
}

// Note: A DELETE handler for a school would typically be in a Super Admin specific route
// and would involve significant considerations for cascading deletes or deactivation.
// For now, this file only handles GET and PATCH for a single school by Super Admin.