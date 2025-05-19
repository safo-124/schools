// app/api/school-admin/finances/fee-structures/[feeStructureId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth'; // Ensure this path points to your authOptions file
import prisma from '@/lib/db';
import { UserRole, Prisma, TermPeriod } from '@prisma/client';
import { z } from 'zod';

// Zod schema for updating a fee structure (all fields optional for PATCH)
const updateFeeStructureApiSchema = z.object({
  name: z.string().min(3, "Fee structure name is required.").optional(),
  description: z.string().optional().or(z.literal('')).nullable(),
  amount: z.preprocess(
    (val) => {
        const strVal = String(val).trim();
        if (strVal === '') return undefined; // Allow empty string to mean "no change" if optional
        const num = parseFloat(strVal);
        return isNaN(num) ? undefined : num; // Let Zod handle if it's still undefined and required
    }, 
    z.number({invalid_type_error: "Amount must be a number."})
     .positive("Amount must be positive.")
     .optional() // Amount is optional for PATCH
  ),
  academicYear: z.string()
    .regex(/^\d{4}-\d{4}$/, "Academic year format must be YYYY-YYYY (e.g., 2024-2025).")
    .refine(year => {
        if(!year || year === '') return true; // Optional, so empty or undefined is fine
        const years = year.split('-');
        if (years.length !== 2 || !/^\d{4}$/.test(years[0]) || !/^\d{4}$/.test(years[1])) return false;
        return parseInt(years[0]) + 1 === parseInt(years[1]);
    }, "Academic year range must be consecutive (e.g., 2024-2025).")
    .optional(),
  term: z.nativeEnum(TermPeriod).optional().nullable(),
  frequency: z.string().min(1, "Frequency is required.").optional(),
});

// GET Handler: Fetch a single fee structure by its ID
export async function GET(
  request: NextRequest, 
  context: any // TYPE BYPASS
) {
  const params = context.params as { feeStructureId: string }; // Internal type assertion
  const { feeStructureId } = params;
  
  console.log(`[API_FEE_STRUCTURE_GET_ID] Received request for feeStructureId: ${feeStructureId}`);
  try {
    if (typeof feeStructureId !== 'string' || !feeStructureId) {
        console.warn('[API_FEE_STRUCTURE_GET_ID] feeStructureId is missing or not a string');
        return NextResponse.json({ message: 'Fee Structure ID is required and must be a string' }, { status: 400 });
    }

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

    const feeStructure = await prisma.feeStructure.findUnique({
      where: { id: feeStructureId },
    });

    if (!feeStructure) {
      return NextResponse.json({ message: 'Fee Structure not found' }, { status: 404 });
    }

    if (feeStructure.schoolId !== schoolId) {
      console.warn(`[API_FEE_STRUCTURE_GET_ID] AuthZ attempt: Admin ${schoolAdminUserId} (school ${schoolId}) tried to access fee structure ${feeStructureId} (school ${feeStructure.schoolId})`);
      return NextResponse.json({ message: 'Forbidden: Fee Structure does not belong to your school' }, { status: 403 });
    }

    return NextResponse.json(feeStructure, { status: 200 });

  } catch (error: any) {
    console.error(`[API_FEE_STRUCTURE_GET_ID] Error fetching fee structure ${feeStructureId || 'unknown'}:`, error.name, error.message);
    return NextResponse.json({ message: 'An unexpected error occurred while fetching fee structure details' }, { status: 500 });
  }
}

// PATCH Handler: Update a fee structure by its ID
export async function PATCH(
  request: NextRequest, 
  context: any // TYPE BYPASS
) {
  const params = context.params as { feeStructureId: string }; // Internal type assertion
  const { feeStructureId } = params;

  console.log(`[API_FEE_STRUCTURE_PATCH_ID] Received request to update feeStructureId: ${feeStructureId}`);
  try {
    if (typeof feeStructureId !== 'string' || !feeStructureId) {
        console.warn('[API_FEE_STRUCTURE_PATCH_ID] feeStructureId is missing or not a string');
        return NextResponse.json({ message: 'Fee Structure ID is required and must be a string' }, { status: 400 });
    }
    
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

    const existingFeeStructure = await prisma.feeStructure.findUnique({
      where: { id: feeStructureId },
      select: { schoolId: true } 
    });

    if (!existingFeeStructure) {
      return NextResponse.json({ message: 'Fee Structure not found' }, { status: 404 });
    }
    if (existingFeeStructure.schoolId !== schoolId) {
      console.warn(`[API_FEE_STRUCTURE_PATCH_ID] AuthZ attempt for feeStructureId ${feeStructureId}`);
      return NextResponse.json({ message: 'Forbidden: Fee Structure does not belong to your school' }, { status: 403 });
    }

    const body = await request.json();
    console.log("[API_FEE_STRUCTURE_PATCH_ID] Received body for update:", JSON.stringify(body, null, 2));
        
    const validation = updateFeeStructureApiSchema.safeParse(body);

    if (!validation.success) {
      console.error("[API_FEE_STRUCTURE_PATCH_ID] Zod validation failed:", JSON.stringify(validation.error.flatten().fieldErrors, null, 2));
      return NextResponse.json({ message: 'Invalid input', errors: validation.error.flatten().fieldErrors }, { status: 400 });
    }

    const dataToUpdateFromSchema = validation.data;
    
    const dataForPrisma: Prisma.FeeStructureUpdateInput = {};
    // Only include fields that are present in the validated data (i.e., user intended to update them)
    if ('name' in dataToUpdateFromSchema && dataToUpdateFromSchema.name !== undefined) {
      dataForPrisma.name = dataToUpdateFromSchema.name;
    }
    if ('description' in dataToUpdateFromSchema) { // Can be set to null if empty string was passed and schema allows null
      dataForPrisma.description = dataToUpdateFromSchema.description === '' ? null : dataToUpdateFromSchema.description;
    }
    if ('amount' in dataToUpdateFromSchema && dataToUpdateFromSchema.amount !== undefined) {
      dataForPrisma.amount = new Prisma.Decimal(dataToUpdateFromSchema.amount.toFixed(2));
    }
    if ('academicYear' in dataToUpdateFromSchema && dataToUpdateFromSchema.academicYear !== undefined) {
      dataForPrisma.academicYear = dataToUpdateFromSchema.academicYear;
    }
    if ('term' in dataToUpdateFromSchema) { // Term can be explicitly set to null
      dataForPrisma.term = dataToUpdateFromSchema.term;
    }
    if ('frequency' in dataToUpdateFromSchema && dataToUpdateFromSchema.frequency !== undefined) {
      dataForPrisma.frequency = dataToUpdateFromSchema.frequency;
    }
    
    if (Object.keys(dataForPrisma).length === 0) {
        return NextResponse.json({ message: 'No valid fields provided for update.' }, { status: 400 });
    }

    const updatedFeeStructure = await prisma.feeStructure.update({
      where: { id: feeStructureId },
      data: dataForPrisma,
    });
    
    console.log(`[API_FEE_STRUCTURE_PATCH_ID] Fee Structure ${feeStructureId} updated successfully.`);
    return NextResponse.json(updatedFeeStructure, { status: 200 });

  } catch (error: any) {
    console.error(`[API_FEE_STRUCTURE_PATCH_ID] Error updating fee structure ${feeStructureId || 'unknown'}:`, error.name, error.message);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') { 
        return NextResponse.json({ message: 'Fee Structure record not found to update.' }, { status: 404 });
      }
      if (error.code === 'P2002') { 
        const target = error.meta?.target as string[] | undefined;
        return NextResponse.json({ message: `A fee structure with the same unique details (e.g., name, academic year, term combination) already exists. Constraint: ${target?.join(', ')}` }, { status: 409 });
      }
      return NextResponse.json({ message: `Database error: ${error.code}` }, { status: 500 });
    }
    if (error instanceof z.ZodError) { 
      return NextResponse.json({ message: 'Invalid input (Zod final check)', errors: error.errors }, { status: 400 }); 
    }
    return NextResponse.json({ message: 'An unexpected error occurred while updating the fee structure' }, { status: 500 });
  }
}

// DELETE Handler: Delete a fee structure by its ID
export async function DELETE(
  request: NextRequest, 
  context: any // TYPE BYPASS
) {
  const params = context.params as { feeStructureId: string }; // Internal type assertion
  const { feeStructureId } = params;

  console.log(`[API_FEE_STRUCTURE_DELETE_ID] Received request to delete feeStructureId: ${feeStructureId}`);
  try {
    if (typeof feeStructureId !== 'string' || !feeStructureId) {
        console.warn('[API_FEE_STRUCTURE_DELETE_ID] feeStructureId is missing or not a string');
        return NextResponse.json({ message: 'Fee Structure ID is required and must be a string' }, { status: 400 });
    }
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

    const feeStructureToDelete = await prisma.feeStructure.findUnique({
      where: { id: feeStructureId },
      select: { schoolId: true } // No need to check invoiceLineItems here if onDelete: SetNull
    });

    if (!feeStructureToDelete) {
      return NextResponse.json({ message: 'Fee Structure not found' }, { status: 404 });
    }
    if (feeStructureToDelete.schoolId !== schoolId) {
      console.warn(`[API_FEE_STRUCTURE_DELETE_ID] AuthZ attempt on feeStructureId ${feeStructureId}`);
      return NextResponse.json({ message: 'Forbidden: Fee Structure does not belong to your school' }, { status: 403 });
    }
    
    // onDelete: SetNull on InvoiceLineItem.feeStructureId will handle unlinking.
    await prisma.feeStructure.delete({
      where: { id: feeStructureId },
    });
    
    console.log(`[API_FEE_STRUCTURE_DELETE_ID] Fee Structure ${feeStructureId} deleted successfully from school ${schoolId}.`);
    return NextResponse.json({ message: 'Fee structure deleted successfully' }, { status: 200 });

  } catch (error: any) {
    console.error(`[API_FEE_STRUCTURE_DELETE_ID] Error deleting fee structure ${feeStructureId || 'unknown'}:`, error.name, error.message);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        return NextResponse.json({ message: 'Fee Structure not found to delete.' }, { status: 404 });
      }
      if (error.code === 'P2003') { 
        const fieldName = error.meta?.field_name || 'related records';
        return NextResponse.json({ message: `Cannot delete fee structure: It is still referenced by other records (field: ${fieldName}) where deletion is restricted.` }, { status: 409 });
      }
      return NextResponse.json({ message: `Database error: ${error.code}. Check server logs.` }, { status: 500 });
    }
    return NextResponse.json({ message: 'An unexpected error occurred while deleting the fee structure' }, { status: 500 });
  }
}