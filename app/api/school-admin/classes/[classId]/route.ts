// app/api/school-admin/classes/[classId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route'; // Adjust path as needed
import prisma from '@/lib/db';
import { UserRole, Prisma, TermPeriod } from '@prisma/client'; // TermPeriod for Zod schema
import { z } from 'zod';

// Zod schema for updating a class (all fields optional for PATCH)
const updateClassApiSchema = z.object({
  name: z.string().min(1, "Class name/level is required.").optional(),
  section: z.string().optional().or(z.literal('')).nullable(),
  academicYear: z.string()
    .regex(/^\d{4}-\d{4}$/, "Academic year must be in YYYY-YYYY format.")
    .refine(year => {
        if(!year) return true; 
        const years = year.split('-');
        return parseInt(years[0]) + 1 === parseInt(years[1]);
    }, "Academic year range must be consecutive (e.g., 2024-2025).")
    .optional(),
  homeroomTeacherId: z.string().cuid("Invalid Homeroom Teacher ID format.").optional().nullable(),
});

interface RouteContext {
  params: {
    classId: string;
  };
}

// GET Handler (from previous step)
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
          select: { id: true, user: { select: { firstName: true, lastName: true }}}
        },
        _count: { select: { studentsEnrolled: true } }
      }
    });

    if (!classRecord) { return NextResponse.json({ message: 'Class not found' }, { status: 404 }); }
    if (classRecord.schoolId !== schoolId) {
      return NextResponse.json({ message: 'Forbidden: Class does not belong to your school' }, { status: 403 });
    }
    return NextResponse.json(classRecord, { status: 200 });
  } catch (error) {
    console.error(`[API_CLASS_GET_ID] Error fetching class ${params.classId}:`, error);
    return NextResponse.json({ message: 'An unexpected error occurred while fetching class details' }, { status: 500 });
  }
}

// PATCH Handler (from previous step)
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
    if (!classId) { return NextResponse.json({ message: 'Class ID is required' }, { status: 400 });}

    const existingClass = await prisma.class.findUnique({
      where: { id: classId },
      select: { schoolId: true } 
    });

    if (!existingClass) { return NextResponse.json({ message: 'Class not found' }, { status: 404 });}
    if (existingClass.schoolId !== schoolId) {
      return NextResponse.json({ message: 'Forbidden: Class does not belong to your school' }, { status: 403 });
    }

    const body = await req.json();
    const validation = updateClassApiSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ message: 'Invalid input', errors: validation.error.flatten().fieldErrors }, { status: 400 });
    }

    const { name, section, academicYear, homeroomTeacherId } = validation.data;
    const dataToUpdate: Prisma.ClassUpdateInput = {};
    if (name !== undefined) dataToUpdate.name = name;
    if (section !== undefined) dataToUpdate.section = section === '' ? null : section;
    if (academicYear !== undefined) dataToUpdate.academicYear = academicYear;
    if (homeroomTeacherId !== undefined) dataToUpdate.homeroomTeacherId = homeroomTeacherId === '' || homeroomTeacherId === 'none' ? null : homeroomTeacherId;

    if (dataToUpdate.homeroomTeacherId) {
      const teacherExists = await prisma.teacher.findFirst({
        where: { id: dataToUpdate.homeroomTeacherId as string, schoolId: schoolId }
      });
      if (!teacherExists) {
        return NextResponse.json({ message: `Homeroom teacher with ID ${dataToUpdate.homeroomTeacherId} not found in this school.` }, { status: 400 });
      }
    }
    
    const updatedClass = await prisma.class.update({
      where: { id: classId },
      data: dataToUpdate,
      include: { homeroomTeacher: { select: { id: true, user: { select: { firstName: true, lastName: true }}}}}
    });
    return NextResponse.json(updatedClass, { status: 200 });
  } catch (error) {
    console.error(`[API_CLASS_PATCH_ID] Error updating class ${params.classId}:`, error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') { return NextResponse.json({ message: 'Class record not found to update.' }, { status: 404 });}
      if (error.code === 'P2002') { return NextResponse.json({ message: `A class with the same name, section, and academic year combination already exists. ${error.meta?.target ? `Constraint on: ${(error.meta.target as string[]).join(', ')}` : ''}` }, { status: 409 });}
      if (error.code === 'P2003' && error.meta?.field_name === 'Class_homeroomTeacherId_fkey (index)') {
         return NextResponse.json({ message: 'Invalid Homeroom Teacher ID provided.' }, { status: 400 });
      }
      return NextResponse.json({ message: `Database error: ${error.code}` }, { status: 500 });
    }
    if (error instanceof z.ZodError) { return NextResponse.json({ message: 'Invalid input (Zod final check)', errors: error.errors }, { status: 400 }); }
    return NextResponse.json({ message: 'An unexpected error occurred while updating the class' }, { status: 500 });
  }
}

// NEW DELETE Handler: Delete a class by its Class ID
export async function DELETE(req: NextRequest, { params }: RouteContext) {
  console.log(`[API_CLASS_DELETE_ID] Received request to delete classId: ${params.classId}`);
  try {
    // 1. Authenticate and Authorize School Admin
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.role !== UserRole.SCHOOL_ADMIN) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
    }
    const schoolAdminUserId = session.user.id;

    // 2. Get School ID for this admin
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

    // 3. Verify the class exists and belongs to the admin's school
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

    // 4. Perform the delete operation
    // Note: Prisma's onDelete rules in your schema will handle related records.
    // - Student.currentClassId is SetNull (good, students are unassigned).
    // - TimetableSlot.classId is Cascade (timetable slots for this class are deleted).
    // - Assignment.classId is Cascade (assignments for this class are deleted).
    // - ClassAnnouncement.classId is Cascade (announcements for this class are deleted).
    // If any of these were Restrict and linked records existed, Prisma would throw P2003.
    
    await prisma.class.delete({
      where: { id: classId },
    });
    
    console.log(`[API_CLASS_DELETE_ID] Class ${classId} deleted successfully from school ${schoolId}.`);
    return NextResponse.json({ message: 'Class deleted successfully' }, { status: 200 }); // Or 204 No Content

  } catch (error) {
    console.error(`[API_CLASS_DELETE_ID] Error deleting class ${params.classId}:`, error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') { // Record to delete not found
        return NextResponse.json({ message: 'Class not found to delete.' }, { status: 404 });
      }
      if (error.code === 'P2003') { // Foreign key constraint failed
        // This means the class is still linked to other records (e.g., students, timetable slots, assignments)
        // and one of your schema's onDelete rules is Restrict (or the DB is enforcing it).
        // Our Student.currentClassId is SetNull, so that shouldn't be an issue.
        // Check TimetableSlot, Assignment, ClassAnnouncement if they are not Cascade or SetNull.
        const fieldName = error.meta?.field_name || 'related records';
        return NextResponse.json({ message: `Cannot delete class: It is still referenced by other records (field: ${fieldName}). Please ensure students are moved and timetable/assignments are cleared or contact support.` }, { status: 409 });
      }
      return NextResponse.json({ message: `Database error: ${error.code}. Check server logs.` }, { status: 500 });
    }
    return NextResponse.json({ message: 'An unexpected error occurred while deleting the class' }, { status: 500 });
  }
}