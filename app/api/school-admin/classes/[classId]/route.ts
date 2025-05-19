// app/api/school-admin/classes/[classId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/lib/db';
import { UserRole, Prisma } from '@prisma/client'; // TermPeriod removed as not directly used in this Zod schema
import { z } from 'zod';

// Zod schema for updating a class (all fields optional for PATCH)
const updateClassApiSchema = z.object({
  name: z.string().min(1, "Class name/level is required.").optional(),
  section: z.string().optional().or(z.literal('')).nullable(), // Allow empty string or null
  academicYear: z.string()
    .regex(/^\d{4}-\d{4}$/, "Academic year must be in YYYY-YYYY format (e.g., 2024-2025).")
    .refine(year => {
        if(!year || year === '') return true; // Handled by optional, but good for explicit check if value exists
        const years = year.split('-');
        if (years.length !== 2 || !/^\d{4}$/.test(years[0]) || !/^\d{4}$/.test(years[1])) return false; // Basic format check
        return parseInt(years[0]) + 1 === parseInt(years[1]);
    }, "Academic year range must be consecutive (e.g., 2024-2025).")
    .optional(),
  homeroomTeacherId: z.string().cuid("Invalid Homeroom Teacher ID format.").optional().nullable(), // Allow unsetting to null
});

interface RouteContext {
  params: {
    classId: string;
  };
}

// GET Handler: Fetch a single class by its Class ID
export async function GET(req: NextRequest, { params }: RouteContext) {
  console.log(`[API_CLASS_GET_ID] Received request for classId: ${params.classId}`);
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

    const { classId } = params;
    if (!classId) {
      return NextResponse.json({ message: 'Class ID is required' }, { status: 400 });
    }

    const classRecord = await prisma.class.findUnique({
      where: { id: classId },
      include: {
        homeroomTeacher: {
          select: {
            id: true,
            user: {
              select: { firstName: true, lastName: true }
            }
          }
        },
        _count: { 
          select: { currentStudents: true } // Corrected student count
        }
      }
    });

    if (!classRecord) {
      return NextResponse.json({ message: 'Class not found' }, { status: 404 });
    }

    if (classRecord.schoolId !== schoolId) {
      console.warn(`[API_CLASS_GET_ID] AuthZ attempt: Admin ${schoolAdminUserId} (school ${schoolId}) tried to access class ${classId} (school ${classRecord.schoolId})`);
      return NextResponse.json({ message: 'Forbidden: Class does not belong to your school' }, { status: 403 });
    }

    return NextResponse.json(classRecord, { status: 200 });

  } catch (error: any) {
    console.error(`[API_CLASS_GET_ID] Error fetching class ${params.classId}:`, error.name, error.message, error.stack);
    return NextResponse.json({ message: 'An unexpected error occurred while fetching class details' }, { status: 500 });
  }
}

// PATCH Handler: Update a class by its Class ID
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  console.log(`[API_CLASS_PATCH_ID] Received request to update classId: ${params.classId}`);
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

    const { classId } = params;
    if (!classId) {
      return NextResponse.json({ message: 'Class ID is required' }, { status: 400 });
    }

    const existingClass = await prisma.class.findUnique({
      where: { id: classId },
      select: { schoolId: true } 
    });

    if (!existingClass) {
      return NextResponse.json({ message: 'Class not found' }, { status: 404 });
    }
    if (existingClass.schoolId !== schoolId) {
      console.warn(`[API_CLASS_PATCH_ID] AuthZ attempt: Admin ${schoolAdminUserId} (school ${schoolId}) tried to update class ${classId} (school ${existingClass.schoolId})`);
      return NextResponse.json({ message: 'Forbidden: Class does not belong to your school' }, { status: 403 });
    }

    const body = await req.json();
    console.log("[API_CLASS_PATCH_ID] Received body for update:", JSON.stringify(body, null, 2));
    
    const validation = updateClassApiSchema.safeParse(body);
    if (!validation.success) {
      console.error("[API_CLASS_PATCH_ID] Zod validation failed:", JSON.stringify(validation.error.flatten().fieldErrors, null, 2));
      return NextResponse.json({ message: 'Invalid input', errors: validation.error.flatten().fieldErrors }, { status: 400 });
    }

    const dataToUpdateFromSchema = validation.data;
    
    // Prepare data for Prisma, only including fields that were actually sent and validated
    const dataForPrisma: Prisma.ClassUpdateInput = {};
    if ('name' in dataToUpdateFromSchema) dataForPrisma.name = dataToUpdateFromSchema.name;
    if ('section' in dataToUpdateFromSchema) dataForPrisma.section = dataToUpdateFromSchema.section === '' ? null : dataToUpdateFromSchema.section;
    if ('academicYear' in dataToUpdateFromSchema) dataForPrisma.academicYear = dataToUpdateFromSchema.academicYear;
    if ('homeroomTeacherId' in dataToUpdateFromSchema) {
        dataForPrisma.homeroomTeacherId = dataToUpdateFromSchema.homeroomTeacherId === '' || dataToUpdateFromSchema.homeroomTeacherId === 'none' ? null : dataToUpdateFromSchema.homeroomTeacherId;
    }
    
    // Additional validation for homeroomTeacherId if it's being set (not unset to null)
    if (dataForPrisma.homeroomTeacherId) { 
      const teacherExists = await prisma.teacher.findFirst({
        where: {
          id: dataForPrisma.homeroomTeacherId as string, // Already validated as CUID if present
          schoolId: schoolId, 
        }
      });
      if (!teacherExists) {
        return NextResponse.json({ message: `Homeroom teacher with ID ${dataForPrisma.homeroomTeacherId} not found in this school.` }, { status: 400 });
      }
    }
    
    if (Object.keys(dataForPrisma).length === 0) {
        return NextResponse.json({ message: 'No valid fields provided for update.' }, { status: 400 });
    }

    const updatedClass = await prisma.class.update({
      where: { id: classId },
      data: dataForPrisma,
      include: {
        homeroomTeacher: {
          select: { id: true, user: { select: { firstName: true, lastName: true } } }
        },
        _count: { select: { currentStudents: true } }
      }
    });
    
    console.log(`[API_CLASS_PATCH_ID] Class ${classId} updated successfully.`);
    return NextResponse.json(updatedClass, { status: 200 });

  } catch (error: any) {
    console.error(`[API_CLASS_PATCH_ID] Error updating class ${params.classId}:`, error.name, error.message, error.stack);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') { return NextResponse.json({ message: 'Class record not found to update.' }, { status: 404 });}
      if (error.code === 'P2002') { // Unique constraint (schoolId, name, section, academicYear)
        const target = error.meta?.target as string[] | undefined;
        return NextResponse.json({ message: `A class with the same name, section, and academic year combination already exists. Constraint on: ${target?.join(', ')}` }, { status: 409 });
      }
      if (error.code === 'P2003' && error.meta?.field_name === 'Class_homeroomTeacherId_fkey (index)') { // Example, check exact field_name from error.meta if this occurs
         return NextResponse.json({ message: 'Invalid Homeroom Teacher ID provided (foreign key constraint).' }, { status: 400 });
      }
      return NextResponse.json({ message: `Database error: ${error.code}` }, { status: 500 });
    }
    if (error instanceof z.ZodError) { return NextResponse.json({ message: 'Invalid input (Zod final check)', errors: error.errors }, { status: 400 }); }
    return NextResponse.json({ message: 'An unexpected error occurred while updating the class' }, { status: 500 });
  }
}

// DELETE Handler: Delete a class by its Class ID
export async function DELETE(req: NextRequest, { params }: RouteContext) {
  console.log(`[API_CLASS_DELETE_ID] Received request to delete classId: ${params.classId}`);
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

    const { classId } = params;
    if (!classId) {
      return NextResponse.json({ message: 'Class ID is required' }, { status: 400 });
    }

    const classToDelete = await prisma.class.findUnique({
      where: { id: classId },
      select: { schoolId: true } 
    });

    if (!classToDelete) {
      return NextResponse.json({ message: 'Class not found' }, { status: 404 });
    }
    if (classToDelete.schoolId !== schoolId) {
      console.warn(`[API_CLASS_DELETE_ID] AuthZ attempt: Admin ${schoolAdminUserId} (school ${schoolId}) tried to delete class ${classId} (school ${classToDelete.schoolId})`);
      return NextResponse.json({ message: 'Forbidden: Class does not belong to your school' }, { status: 403 });
    }
    
    // Prisma onDelete rules:
    // Student.currentClassId is SetNull.
    // TimetableSlot.classId is Cascade.
    // Assignment.classId is Cascade.
    // ClassAnnouncement.classId is Cascade.
    await prisma.class.delete({
      where: { id: classId },
    });
    
    console.log(`[API_CLASS_DELETE_ID] Class ${classId} deleted successfully from school ${schoolId}.`);
    return NextResponse.json({ message: 'Class deleted successfully' }, { status: 200 });

  } catch (error: any) {
    console.error(`[API_CLASS_DELETE_ID] Error deleting class ${params.classId}:`, error.name, error.message, error.stack);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        return NextResponse.json({ message: 'Class not found to delete.' }, { status: 404 });
      }
      if (error.code === 'P2003') { 
        const fieldName = error.meta?.field_name || 'related records';
        return NextResponse.json({ message: `Cannot delete class: It is still referenced by other records (field: ${fieldName}) where deletion is restricted. Please remove these dependencies first.` }, { status: 409 });
      }
      return NextResponse.json({ message: `Database error: ${error.code}. Check server logs.` }, { status: 500 });
    }
    return NextResponse.json({ message: 'An unexpected error occurred while deleting the class' }, { status: 500 });
  }
}