// app/api/school-admin/finances/invoices/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/lib/db';
import { UserRole, Prisma, TermPeriod, PaymentStatus } from '@prisma/client';
import { z } from 'zod';

// Zod schema for individual line items when creating an invoice
const invoiceLineItemCreateSchema = z.object({
  feeStructureId: z.string().cuid("Invalid Fee Structure ID.").optional().nullable(),
  description: z.string().min(1, "Line item description is required."),
  quantity: z.preprocess(
    (val) => {
        const num = parseInt(String(val), 10);
        return isNaN(num) ? undefined : num;
    }, 
    z.number({required_error: "Quantity is required.", invalid_type_error: "Quantity must be a number."})
     .int({message: "Quantity must be a whole number."})
     .positive("Quantity must be a positive integer.").default(1)
  ),
  unitPrice: z.preprocess(
    (val) => {
        const num = parseFloat(String(val));
        return isNaN(num) ? undefined : num;
    },
    z.number({required_error: "Unit price is required.", invalid_type_error: "Unit price must be a number."})
     .positive("Unit price must be a positive number.")
  ),
});

// Zod schema for creating a new invoice
const createInvoiceApiSchema = z.object({
  studentId: z.string().cuid("Invalid Student ID."),
  academicYear: z.string()
    .regex(/^\d{4}-\d{4}$/, "Academic year format must be قوم-YYYY (e.g., 2024-2025).")
    .refine(year => {
        const years = year.split('-');
        return parseInt(years[0]) + 1 === parseInt(years[1]);
    }, "Academic year range must be consecutive (e.g., 2024-2025)."),
  term: z.nativeEnum(TermPeriod, { errorMap: () => ({ message: "Invalid term selected."})}),
  issueDate: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid issue date."}),
  dueDate: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid due date."}),
  notes: z.string().optional().or(z.literal('')).nullable(),
  lineItems: z.array(invoiceLineItemCreateSchema).min(1, "Invoice must have at least one line item."),
});

async function generateInvoiceNumber(schoolId: string): Promise<string> {
  // console.log(`[generateInvoiceNumber] Generating for schoolId: ${schoolId}`); // Verbose
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const prefix = `INV-${year}${month}-`;
  
  const lastInvoice = await prisma.invoice.findFirst({
    where: { 
        schoolId,
        invoiceNumber: { startsWith: prefix }
    },
    orderBy: { invoiceNumber: 'desc' },
    select: { invoiceNumber: true }
  });

  let sequence = 1;
  if (lastInvoice?.invoiceNumber) {
    const lastSeqStr = lastInvoice.invoiceNumber.substring(prefix.length);
    const lastSeq = parseInt(lastSeqStr, 10);
    if (!isNaN(lastSeq)) {
      sequence = lastSeq + 1;
    }
  }
  const newInvoiceNumber = `${prefix}${sequence.toString().padStart(4, '0')}`;
  console.log(`[generateInvoiceNumber] Generated new invoice number: ${newInvoiceNumber}`);
  return newInvoiceNumber;
}

export async function POST(req: NextRequest) {
  console.log('[API_INVOICES_POST] === Received request to create invoice (Full Version) ===');
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.role !== UserRole.SCHOOL_ADMIN) {
      console.warn('[API_INVOICES_POST] Unauthorized access attempt. Session:', JSON.stringify(session, null, 2));
      return NextResponse.json({ message: 'Unauthorized: User not authenticated or not a School Admin.' }, { status: 403 });
    }
    const schoolAdminUserId = session.user.id;

    const adminSchoolLink = await prisma.schoolAdmin.findFirst({
      where: { userId: schoolAdminUserId },
      select: { schoolId: true }
    });
    if (!adminSchoolLink?.schoolId) {
      console.warn(`[API_INVOICES_POST] Admin user ${schoolAdminUserId} not associated with any school.`);
      return NextResponse.json({ message: 'Admin not associated with any school.' }, { status: 400 });
    }
    const schoolIdFromAdmin = adminSchoolLink.schoolId; 
    console.log(`[API_INVOICES_POST] Admin ${schoolAdminUserId} processing for school ${schoolIdFromAdmin}.`);

    let body;
    try {
        body = await req.json();
        console.log("[API_INVOICES_POST] Received body:", JSON.stringify(body, null, 2));
    } catch (parseError: any) {
        console.error("[API_INVOICES_POST] CRITICAL: Failed to parse request body as JSON:", parseError.message);
        return NextResponse.json({ message: 'Invalid JSON payload provided.' }, { status: 400 });
    }
    
    const validation = createInvoiceApiSchema.safeParse(body);
    if (!validation.success) {
      console.error("[API_INVOICES_POST] Zod validation failed:", JSON.stringify(validation.error.flatten(), null, 2));
      return NextResponse.json({ message: 'Invalid input for invoice creation.', errors: validation.error.flatten().fieldErrors }, { status: 400 });
    }
    
    const { studentId: validatedStudentId, academicYear, term, issueDate, dueDate, notes, lineItems } = validation.data;
    console.log("[API_INVOICES_POST] Zod validation successful.");

    const student = await prisma.student.findFirst({
        where: { id: validatedStudentId, schoolId: schoolIdFromAdmin }
    });
    if (!student) {
        console.warn(`[API_INVOICES_POST] Student with ID ${validatedStudentId} not found in school ${schoolIdFromAdmin}.`);
        return NextResponse.json({ message: `Student with ID ${validatedStudentId} not found in this school.`}, { status: 404 });
    }
    console.log(`[API_INVOICES_POST] Validated student: ${student.id}`);

    for (const item of lineItems) {
        if (item.feeStructureId) {
            const feeStructure = await prisma.feeStructure.findFirst({
                where: { id: item.feeStructureId, schoolId: schoolIdFromAdmin }
            });
            if (!feeStructure) {
                console.warn(`[API_INVOICES_POST] Fee Structure ID ${item.feeStructureId} in line item "${item.description}" is invalid or does not belong to school ${schoolIdFromAdmin}.`);
                return NextResponse.json({ message: `Fee Structure ID ${item.feeStructureId} in line item "${item.description}" is invalid or does not belong to this school.`}, { status: 400 });
            }
        }
    }
    console.log("[API_INVOICES_POST] Line item fee structures validated (if any).");

    const invoiceNumberGenerated = await generateInvoiceNumber(schoolIdFromAdmin);
    let totalAmountCalculated = 0; // Renamed for clarity
    const preparedLineItems = lineItems.map(item => {
        const quantity = Number(item.quantity); // Zod preprocess should ensure these are numbers
        const unitPrice = Number(item.unitPrice);
        if (isNaN(quantity) || isNaN(unitPrice)) {
            // This should ideally be caught by Zod validation now with required_error
            console.error(`[API_INVOICES_POST] Invalid numeric value in line item (post-Zod, should not happen): Q=${item.quantity}, P=${item.unitPrice}`);
            throw new Error(`Invalid quantity or unit price in line item: "${item.description}".`);
        }
        const itemTotal = quantity * unitPrice;
        totalAmountCalculated += itemTotal;
        return {
            description: item.description,
            quantity: quantity,
            unitPrice: new Prisma.Decimal(unitPrice.toFixed(2)),
            amount: new Prisma.Decimal(itemTotal.toFixed(2)),
            feeStructureId: item.feeStructureId || null,
        };
    });
    console.log(`[API_INVOICES_POST] Calculated total amount: ${totalAmountCalculated.toFixed(2)}. Preparing to create invoice with number ${invoiceNumberGenerated}...`);

    const newInvoice = await prisma.invoice.create({
      data: {
        // Using direct scalar foreign keys (which worked in minimal create)
        schoolId: schoolIdFromAdmin,
        studentId: validatedStudentId, 
        
        invoiceNumber: invoiceNumberGenerated,
        issueDate: new Date(issueDate), // Zod ensures these are valid date strings
        dueDate: new Date(dueDate),
        totalAmount: new Prisma.Decimal(totalAmountCalculated.toFixed(2)), // Use the calculated total
        paidAmount: new Prisma.Decimal(0.00),
        status: PaymentStatus.PENDING,
        notes: notes || null,
        academicYear,
        term,
        lineItems: { // Nested create for line items
          create: preparedLineItems,
        },
      },
      include: {
        lineItems: true,
        student: { select: { firstName: true, lastName: true, studentIdNumber: true }}
      }
    });

    console.log(`[API_INVOICES_POST] Invoice ${newInvoice.invoiceNumber} created successfully for student ${validatedStudentId} in school ${schoolIdFromAdmin}`);
    return NextResponse.json(newInvoice, { status: 201 });

  } catch (error: any) {
    console.error('--- [API_INVOICES_POST] CRITICAL ERROR IN CATCH BLOCK ---');
    console.error('Error Name:', error.name);
    console.error('Error Message:', error.message);
    if (error.stack) {
      console.error('Error Stack:', error.stack);
    }
    console.error('Full Error Object (if useful):', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    console.error('--- END CRITICAL ERROR IN CATCH BLOCK ---');
    
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      console.error(`[API_INVOICES_POST] Prisma Error Code: ${error.code}, Meta: ${JSON.stringify(error.meta)}`);
      if (error.code === 'P2002') { 
        return NextResponse.json({ message: `An invoice with similar unique details already exists. ${error.meta?.target ? `Constraint: ${(error.meta.target as string[]).join(', ')}` : ''}` }, { status: 409 });
      }
      if (error.code === 'P2003') { // Foreign key constraint failed
        return NextResponse.json({ message: `Database constraint violation: Invalid Student or Fee Structure ID, or other linked entity. Field: ${error.meta?.field_name}` }, { status: 400 });
      }
      return NextResponse.json({ message: `Database error occurred: ${error.message}` }, { status: 500 });
    }
    if (error instanceof z.ZodError) { // Should be caught by safeParse earlier
        console.error("[API_INVOICES_POST] Zod final catch block error:", JSON.stringify(error.errors, null, 2));
        return NextResponse.json({ message: 'Invalid input (Zod final check)', errors: error.errors }, { status: 400 });
    }
    return NextResponse.json({ message: 'An unexpected server error occurred while creating the invoice. Check server logs for details.' }, { status: 500 });
  }
}

// GET handler for listing invoices (remains the same)
export async function GET(req: NextRequest) {
    // console.log('[API_INVOICES_GET_ALL] Received request to fetch all invoices.'); // Can be verbose
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

        const invoices = await prisma.invoice.findMany({
            where: { schoolId },
            include: {
                student: { 
                    select: { 
                        firstName: true, 
                        lastName: true, 
                        studentIdNumber: true, 
                        currentClass: {select: {name: true, section: true}} 
                    } 
                },
                lineItems: true,
            },
            orderBy: { issueDate: 'desc' }
        });
        // console.log(`[API_INVOICES_GET_ALL] Found ${invoices.length} invoices for school ID: ${schoolId}`);
        return NextResponse.json(invoices, { status: 200 });

    } catch (error: any) {
        console.error('[API_INVOICES_GET_ALL] An error occurred:', error, 'Stack:', error?.stack);
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            return NextResponse.json({ message: `Database error: ${error.message}` }, { status: 500 });
        }
        return NextResponse.json({ message: 'An unexpected error occurred while fetching invoices.' }, { status: 500 });
    }
}