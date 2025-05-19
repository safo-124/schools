// app/api/school-admin/classes/[classId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth'; // Ensure this path is correct
import prisma from '@/lib/db';
import { UserRole, Prisma } from '@prisma/client';
import { z } from 'zod';

// Zod schema for updating a class (all fields optional for PATCH)
const updateClassApiSchema = z.object({
  name: z.string().min(1, "Class name/level is required.").optional(),
  section: z.string().optional().or(z.literal('')).nullable(),
  academicYear: z.string()
    .regex(/^\d{4}-\d{4}$/, "Academic year must be in YYYY-YYYY format (e.g., 2024-2025).")
    .refine(year => {
        if(!year || year === '') return true; 
        const years = year.split('-');
        if (years.length !== 2 || !/^\d{4}$/.test(years[0]) || !/^\d{4}$/.test(years[1])) return false;
        return parseInt(years[0]) + 1 === parseInt(years[1]);
    }, "Academic year range must be consecutive (e.g., 2024-2025).")
    .optional(),
  homeroomTeacherId: z.string().cuid("Invalid Homeroom Teacher ID format.").optional().nullable(),
});

// GET Handler: Fetch a single class by its Class ID
export async function GET(
  request: NextRequest, 
  context: any // <<< TYPE BYPASS APPLIED HERE
) {
  const params = context.params as { classId: string }; // Internal type assertion
  const { classId } = params;
  
  console.log(`[API_CLASS_GET_ID] Received request for classId: ${classId}`);
  try {
    if (typeof classId !== 'string' || !classId) { // Runtime check
        console.warn('[API_CLASS_GET_ID] classId is missing or not a string from context.params');
        return NextResponse.json({ message: 'Class ID is required and must be a string' }, { status: 400 });
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

    const classRecord = await prisma.class.findUnique({
      where: { id: classId },
      include: {
        homeroomTeacher: {
          select: { id: true, user: { select: { firstName: true, lastName: true }}}
        },
        _count: { select: { currentStudents: true } }
      }
    });

    if (!classRecord) { return NextResponse.json({ message: 'Class not found' }, { status: 404 }); }
    if (classRecord.schoolId !== schoolId) {
      return NextResponse.json({ message: 'Forbidden: Class does not belong to your school' }, { status: 403 });
    }
    return NextResponse.json(classRecord, { status: 200 });
  } catch (error: any) {
    console.error(`[API_CLASS_GET_ID] Error fetching class ${classId || 'unknown'}:`, error.name, error.message);
    return NextResponse.json({ message: 'An unexpected error occurred while fetching class details' }, { status: 500 });
  }
}

// PATCH Handler: Update a class by its Class ID
export async function PATCH(
  request: NextRequest, 
  context: any // <<< TYPE BYPASS APPLIED HERE
) {
  const params = context.params as { classId: string }; // Internal type assertion
  const { classId } = params;

  console.log(`[API_CLASS_PATCH_ID] Received request to update classId: ${classId}`);
  try {
    if (typeof classId !== 'string' || !classId) { // Runtime check
        console.warn('[API_CLASS_PATCH_ID] classId is missing or not a string from context.params');
        return NextResponse.json({ message: 'Class ID is required and must be a string' }, { status: 400 });
    }
    // ... (rest of your PATCH logic remains the same, using the destructured classId) ...
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.role !== UserRole.SCHOOL_ADMIN) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
    }
    // ... (schoolId determination, existingClass check, body validation, update logic as before) ...
    const adminSchoolLink = await prisma.schoolAdmin.findFirst({where: { userId: session.user.id }, select: { schoolId: true }});
    if (!adminSchoolLink?.schoolId) return NextResponse.json({ message: 'Admin not associated with any school.' }, { status: 400 });
    const schoolId = adminSchoolLink.schoolId;

    const existingClass = await prisma.class.findUnique({ where: { id: classId }, select: { schoolId: true } });
    if (!existingClass) return NextResponse.json({ message: 'Class not found' }, { status: 404 });
    if (existingClass.schoolId !== schoolId) return NextResponse.json({ message: 'Forbidden: Class does not belong to your school' }, { status: 403 });

    const body = await request.json();
    const validation = updateClassApiSchema.safeParse(body);
    if (!validation.success) return NextResponse.json({ message: 'Invalid input', errors: validation.error.flatten().fieldErrors }, { status: 400 });

    const dataToUpdateFromSchema = validation.data;
    const dataForPrisma: Prisma.ClassUpdateInput = {};
    if ('name' in dataToUpdateFromSchema && dataToUpdateFromSchema.name !== undefined) dataForPrisma.name = dataToUpdateFromSchema.name;
    if ('section' in dataToUpdateFromSchema) dataForPrisma.section = dataToUpdateFromSchema.section === '' ? null : dataToUpdateFromSchema.section;
    if ('academicYear' in dataToUpdateFromSchema && dataToUpdateFromSchema.academicYear !== undefined) dataForPrisma.academicYear = dataToUpdateFromSchema.academicYear;
    if ('homeroomTeacherId' in dataToUpdateFromSchema) {
        dataForPrisma.homeroomTeacherId = dataToUpdateFromSchema.homeroomTeacherId === '' || dataToUpdateFromSchema.homeroomTeacherId === null || dataToUpdateFromSchema.homeroomTeacherId === 'none' ? null : dataToUpdateFromSchema.homeroomTeacherId;
    }
    
    if (dataForPrisma.homeroomTeacherId) { 
      const teacherExists = await prisma.teacher.findFirst({ where: { id: dataForPrisma.homeroomTeacherId as string, schoolId: schoolId }});
      if (!teacherExists) return NextResponse.json({ message: `Homeroom teacher with ID ${dataForPrisma.homeroomTeacherId} not found in this school.` }, { status: 400 });
    }
    
    if (Object.keys(dataForPrisma).length === 0) return NextResponse.json({ message: 'No valid fields provided for update.' }, { status: 400 });

    const updatedClass = await prisma.class.update({
      where: { id: classId }, data: dataForPrisma,
      include: { homeroomTeacher: { select: { id: true, user: { select: { firstName: true, lastName: true } } } }, _count: { select: { currentStudents: true } } }
    });
    return NextResponse.json(updatedClass, { status: 200 });

  } catch (error: any) {
    console.error(`[API_CLASS_PATCH_ID] Error updating class ${classId || 'unknown'}:`, error.name, error.message);
    // ... (full error handling as before)
    if (error instanceof Prisma.PrismaClientKnownRequestError) { /* ... */ if (error.code === 'P2025') { return NextResponse.json({ message: 'Class record not found to update.' }, { status: 404 });} if (error.code === 'P2002') { return NextResponse.json({ message: `A class with the same unique details already exists. Meta: ${JSON.stringify(error.meta?.target)}` }, { status: 409 });} return NextResponse.json({ message: `Database error: ${error.code}` }, { status: 500 }); }
    if (error instanceof z.ZodError) { return NextResponse.json({ message: 'Invalid input (Zod final check)', errors: error.errors }, { status: 400 }); }
    return NextResponse.json({ message: 'An unexpected error occurred while updating the class' }, { status: 500 });
  }
}

// DELETE Handler: Delete a class by its Class ID
export async function DELETE(
  request: NextRequest, 
  context: any // <<< TYPE BYPASS APPLIED HERE
) {
  const params = context.params as { classId: string }; // Internal type assertion
  const { classId } = params;

  console.log(`[API_CLASS_DELETE_ID] Received request to delete classId: ${classId}`);
  try {
    if (typeof classId !== 'string' || !classId) { // Runtime check
        console.warn('[API_CLASS_DELETE_ID] classId is missing or not a string from context.params');
        return NextResponse.json({ message: 'Class ID is required and must be a string' }, { status: 400 });
    }
    // ... (rest of your DELETE logic remains the same, using the destructured classId) ...
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.role !== UserRole.SCHOOL_ADMIN) { return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });}
    const adminSchoolLink = await prisma.schoolAdmin.findFirst({ where: { userId: session.user.id }, select: { schoolId: true }});
    if (!adminSchoolLink?.schoolId) return NextResponse.json({ message: 'Admin not associated with any school.' }, { status: 400 });
    const schoolId = adminSchoolLink.schoolId;

    const classToDelete = await prisma.class.findUnique({ where: { id: classId }, select: { schoolId: true } });
    if (!classToDelete) { return NextResponse.json({ message: 'Class not found' }, { status: 404 });}
    if (classToDelete.schoolId !== schoolId) { return NextResponse.json({ message: 'Forbidden: Class does not belong to your school' }, { status: 403 });}
    
    await prisma.class.delete({ where: { id: classId } });
    return NextResponse.json({ message: 'Class deleted successfully' }, { status: 200 });

  } catch (error: any) {
    console.error(`[API_CLASS_DELETE_ID] Error deleting class ${classId || 'unknown'}:`, error.name, error.message);
    // ... (full error handling as before) ...
    if (error instanceof Prisma.PrismaClientKnownRequestError) { /* ... */ if (error.code === 'P2025') { return NextResponse.json({ message: 'Class not found to delete.' }, { status: 404 });} if (error.code === 'P2003') { return NextResponse.json({ message: `Cannot delete class: It is still referenced by other records. Field: ${error.meta?.field_name || 'unknown'}` }, { status: 409 });} return NextResponse.json({ message: `Database error: ${error.code}. Check server logs.` }, { status: 500 });}
    return NextResponse.json({ message: 'An unexpected error occurred while deleting the class' }, { status: 500 });
  }
}