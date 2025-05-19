// app/api/school-admin/finances/fee-structures/[feeStructureId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth'; // Adjust path as needed
import prisma from '@/lib/db';
import { UserRole, Prisma, TermPeriod } from '@prisma/client';
import { z } from 'zod';

// Zod schema for updating a fee structure (all fields optional for PATCH)
const updateFeeStructureApiSchema = z.object({
  name: z.string().min(3, "Fee structure name is required.").optional(),
  description: z.string().optional().or(z.literal('')).nullable(),
  amount: z.preprocess(
    (val) => (val === "" || val === null || val === undefined) ? undefined : parseFloat(String(val)), 
    z.number({invalid_type_error: "Amount must be a number."}).positive("Amount must be positive.").optional()
  ),
  academicYear: z.string()
    .regex(/^\d{4}-\d{4}$/, "Academic year format: YYYY-YYYY (e.g., 2024-2025).")
    .refine(year => {
        if(!year || year === '') return true; // Allow optional via .optional()
        const years = year.split('-');
        return parseInt(years[0]) + 1 === parseInt(years[1]);
    }, "Academic year range must be consecutive (e.g., 2024-2025).")
    .optional(),
  term: z.nativeEnum(TermPeriod).optional().nullable(),
  frequency: z.string().min(1, "Frequency is required.").optional(),
});

interface RouteContext {
  params: {
    feeStructureId: string; 
  };
}

// GET Handler: Fetch a single fee structure by its ID
export async function GET(req: NextRequest, { params }: RouteContext) {
  console.log(`[API_FEE_STRUCTURE_GET_ID] Received request for feeStructureId: ${params.feeStructureId}`);
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

    const { feeStructureId } = params;
    if (!feeStructureId) {
      return NextResponse.json({ message: 'Fee Structure ID is required' }, { status: 400 });
    }

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

  } catch (error) {
    console.error(`[API_FEE_STRUCTURE_GET_ID] Error fetching fee structure ${params.feeStructureId}:`, error);
    return NextResponse.json({ message: 'An unexpected error occurred while fetching fee structure details' }, { status: 500 });
  }
}

// PATCH Handler: Update a fee structure by its ID
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  console.log(`[API_FEE_STRUCTURE_PATCH_ID] Received request to update feeStructureId: ${params.feeStructureId}`);
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

    const { feeStructureId } = params;
    if (!feeStructureId) {
      return NextResponse.json({ message: 'Fee Structure ID is required' }, { status: 400 });
    }

    const existingFeeStructure = await prisma.feeStructure.findUnique({
      where: { id: feeStructureId },
      select: { schoolId: true } 
    });

    if (!existingFeeStructure) {
      return NextResponse.json({ message: 'Fee Structure not found' }, { status: 404 });
    }
    if (existingFeeStructure.schoolId !== schoolId) {
      console.warn(`[API_FEE_STRUCTURE_PATCH_ID] AuthZ attempt: Admin ${schoolAdminUserId} (school ${schoolId}) tried to update fee structure ${feeStructureId} (school ${existingFeeStructure.schoolId})`);
      return NextResponse.json({ message: 'Forbidden: Fee Structure does not belong to your school' }, { status: 403 });
    }

    const body = await req.json();
    console.log("[API_FEE_STRUCTURE_PATCH_ID] Received body for update:", JSON.stringify(body, null, 2));
    
    if (body.amount && typeof body.amount === 'string') {
        body.amount = parseFloat(body.amount);
        if (isNaN(body.amount)) { // Check if parseFloat resulted in NaN
             // Remove amount or handle as invalid if parsing fails to prevent Zod error on type
            delete body.amount; 
        }
    }
    
    const validation = updateFeeStructureApiSchema.safeParse(body);

    if (!validation.success) {
      console.error("[API_FEE_STRUCTURE_PATCH_ID] Zod validation failed:", JSON.stringify(validation.error.flatten().fieldErrors, null, 2));
      return NextResponse.json({ message: 'Invalid input', errors: validation.error.flatten().fieldErrors }, { status: 400 });
    }

    const dataToUpdateFromSchema = validation.data;
    
    const dataForPrisma: Prisma.FeeStructureUpdateInput = {};
    if (dataToUpdateFromSchema.name !== undefined) dataForPrisma.name = dataToUpdateFromSchema.name;
    if (dataToUpdateFromSchema.description !== undefined) dataForPrisma.description = dataToUpdateFromSchema.description === '' ? null : dataToUpdateFromSchema.description;
    if (dataToUpdateFromSchema.amount !== undefined) dataForPrisma.amount = dataToUpdateFromSchema.amount;
    if (dataToUpdateFromSchema.academicYear !== undefined) dataForPrisma.academicYear = dataToUpdateFromSchema.academicYear;
    if (dataToUpdateFromSchema.term !== undefined) dataForPrisma.term = dataToUpdateFromSchema.term;
    if (dataToUpdateFromSchema.frequency !== undefined) dataForPrisma.frequency = dataToUpdateFromSchema.frequency;
    
    if (Object.keys(dataForPrisma).length === 0) {
        return NextResponse.json({ message: 'No valid fields provided for update.' }, { status: 400 });
    }

    const updatedFeeStructure = await prisma.feeStructure.update({
      where: { id: feeStructureId },
      data: dataForPrisma,
    });
    
    console.log(`[API_FEE_STRUCTURE_PATCH_ID] Fee Structure ${feeStructureId} updated successfully.`);
    return NextResponse.json(updatedFeeStructure, { status: 200 });

  } catch (error) {
    console.error(`[API_FEE_STRUCTURE_PATCH_ID] Error updating fee structure ${params.feeStructureId}:`, error);
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
export async function DELETE(req: NextRequest, { params }: RouteContext) {
  console.log(`[API_FEE_STRUCTURE_DELETE_ID] Received request to delete feeStructureId: ${params.feeStructureId}`);
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

    const { feeStructureId } = params;
    if (!feeStructureId) {
      return NextResponse.json({ message: 'Fee Structure ID is required' }, { status: 400 });
    }

    const feeStructureToDelete = await prisma.feeStructure.findUnique({
      where: { id: feeStructureId },
      select: { schoolId: true, invoiceLineItems: { take: 1 } } // Check if it's linked to any invoice line items
    });

    if (!feeStructureToDelete) {
      return NextResponse.json({ message: 'Fee Structure not found' }, { status: 404 });
    }
    if (feeStructureToDelete.schoolId !== schoolId) {
      console.warn(`[API_FEE_STRUCTURE_DELETE_ID] AuthZ attempt: Admin ${schoolAdminUserId} (school ${schoolId}) tried to delete fee structure ${feeStructureId} (school ${feeStructureToDelete.schoolId})`);
      return NextResponse.json({ message: 'Forbidden: Fee Structure does not belong to your school' }, { status: 403 });
    }

    // Check if the fee structure is used in any invoice line items
    // Your schema has onDelete: SetNull for InvoiceLineItem.feeStructureId, so direct deletion of FeeStructure is allowed
    // but it will nullify the link in InvoiceLineItems. This is often desirable.
    // If you wanted to prevent deletion if it's used, you would check count here:
    // if (feeStructureToDelete.invoiceLineItems.length > 0) {
    //   return NextResponse.json({ message: 'Cannot delete fee structure: It is currently used in one or more invoices. Consider deactivating it instead or removing it from invoices first.' }, { status: 409 });
    // }
    
    await prisma.feeStructure.delete({
      where: { id: feeStructureId },
    });
    
    console.log(`[API_FEE_STRUCTURE_DELETE_ID] Fee Structure ${feeStructureId} deleted successfully from school ${schoolId}.`);
    return NextResponse.json({ message: 'Fee structure deleted successfully' }, { status: 200 });

  } catch (error) {
    console.error(`[API_FEE_STRUCTURE_DELETE_ID] Error deleting fee structure ${params.feeStructureId}:`, error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        return NextResponse.json({ message: 'Fee Structure not found to delete.' }, { status: 404 });
      }
      // P2003 might occur if another relation had onDelete: Restrict
      if (error.code === 'P2003') { 
        const fieldName = error.meta?.field_name || 'related records';
        return NextResponse.json({ message: `Cannot delete fee structure: It is still referenced by other records (field: ${fieldName}) where deletion is restricted.` }, { status: 409 });
      }
      return NextResponse.json({ message: `Database error: ${error.code}. Check server logs.` }, { status: 500 });
    }
    return NextResponse.json({ message: 'An unexpected error occurred while deleting the fee structure' }, { status: 500 });
  }
}