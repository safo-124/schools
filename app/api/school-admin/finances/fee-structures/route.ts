// app/api/school-admin/finances/fee-structures/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route'; // Adjust path as needed
import prisma from '@/lib/db'; // Using shared Prisma instance
import { UserRole, Prisma, TermPeriod } from '@prisma/client'; // Ensure TermPeriod is imported
import { z } from 'zod';

// Zod schema for creating a new fee structure
const createFeeStructureApiSchema = z.object({
  name: z.string().min(3, "Fee structure name is required (e.g., Term 1 Tuition - Grade 1)."),
  description: z.string().optional().or(z.literal('')).nullable(),
  amount: z.number().positive("Amount must be a positive number."), // Will be parsed from string input by client
  academicYear: z.string()
    .regex(/^\d{4}-\d{4}$/, "Academic year must be in YYYY-YYYY format (e.g., 2024-2025).")
    .refine(year => {
        const years = year.split('-');
        return parseInt(years[0]) + 1 === parseInt(years[1]);
    }, "Academic year range must be consecutive (e.g., 2024-2025)."),
  term: z.nativeEnum(TermPeriod).optional().nullable(), // Optional: if fee is not term-specific
  frequency: z.string().min(1, "Frequency is required (e.g., Termly, Annually, Monthly, One-time)."),
  // appliesToClassId: z.string().cuid("Invalid Class ID").optional().nullable(), // For future linking to classes
});

// GET Handler: List all fee structures for the School Admin's school
export async function GET(req: NextRequest) {
  console.log('[API_FEE_STRUCTURES_GET_ALL] Received request to fetch all fee structures.');
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
      return NextResponse.json({ message: 'No school associated with your account.' }, { status: 404 });
    }
    const schoolId = adminSchoolLink.schoolId;
    console.log(`[API_FEE_STRUCTURES_GET_ALL] Fetching fee structures for School ID: ${schoolId}`);

    // Optional: Add query params for filtering by academicYear or term
    const url = new URL(req.url);
    const filterAcademicYear = url.searchParams.get('academicYear');
    const filterTerm = url.searchParams.get('term') as TermPeriod | null;

    const whereClause: Prisma.FeeStructureWhereInput = { schoolId };
    if (filterAcademicYear) {
        whereClause.academicYear = filterAcademicYear;
    }
    if (filterTerm) {
        whereClause.term = filterTerm;
    }

    const feeStructures = await prisma.feeStructure.findMany({
      where: whereClause,
      orderBy: [
        { academicYear: 'desc' },
        { term: 'asc' },
        { name: 'asc' },
      ],
      // include: { class: true } // If appliesToClassId is implemented
    });
    console.log(`[API_FEE_STRUCTURES_GET_ALL] Found ${feeStructures.length} fee structures for school ID: ${schoolId}`);
    return NextResponse.json(feeStructures, { status: 200 });

  } catch (error) {
    console.error('[API_FEE_STRUCTURES_GET_ALL] An error occurred:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
        return NextResponse.json({ message: `Database error: ${error.message}` }, { status: 500 });
    }
    return NextResponse.json({ message: 'An unexpected error occurred while fetching fee structures.' }, { status: 500 });
  }
}


// POST Handler for creating a new fee structure
export async function POST(req: NextRequest) {
  console.log('[API_FEE_STRUCTURES_POST] Received request to create fee structure.');
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
    console.log("[API_FEE_STRUCTURES_POST] Received body:", JSON.stringify(body, null, 2));
    
    // Convert amount from string to number before validation if necessary
    if (body.amount && typeof body.amount === 'string') {
        body.amount = parseFloat(body.amount);
    }

    const validation = createFeeStructureApiSchema.safeParse(body);
    if (!validation.success) {
      console.error("[API_FEE_STRUCTURES_POST] Zod validation failed:", JSON.stringify(validation.error.flatten().fieldErrors, null, 2));
      return NextResponse.json({ message: 'Invalid input', errors: validation.error.flatten().fieldErrors }, { status: 400 });
    }
    
    const { name, description, amount, academicYear, term, frequency /*, appliesToClassId */ } = validation.data;
    
    // Prisma schema's @@unique([schoolId, name, academicYear, term]) will handle uniqueness.

    const newFeeStructure = await prisma.feeStructure.create({
      data: {
        schoolId,
        name,
        description: description || null,
        amount, // Prisma expects Decimal, Zod schema ensures positive number
        academicYear,
        term: term || null,
        frequency,
        // appliesToClassId: appliesToClassId || null,
      },
    });

    console.log(`[API_FEE_STRUCTURES_POST] Fee Structure "${newFeeStructure.name}" created successfully for school ${schoolId}`);
    return NextResponse.json(newFeeStructure, { status: 201 });

  } catch (error) {
    console.error('[API_FEE_STRUCTURES_POST] An error occurred:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') { 
        return NextResponse.json({ message: `A fee structure with the same name, academic year, and term already exists. ${error.meta?.target ? `Constraint: ${(error.meta.target as string[]).join(', ')}` : ''}` }, { status: 409 });
      }
      // Add other specific Prisma error codes if needed
      return NextResponse.json({ message: `Database error occurred: ${error.message}` }, { status: 500 });
    }
    if (error instanceof z.ZodError) { // Should be caught by safeParse earlier
        return NextResponse.json({ message: 'Invalid input (Zod final check)', errors: error.errors }, { status: 400 });
    }
    return NextResponse.json({ message: 'An unexpected error occurred while creating the fee structure.' }, { status: 500 });
  }
}