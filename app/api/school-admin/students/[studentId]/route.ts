// app/api/school-admin/students/[studentId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/lib/db';
import { UserRole, Prisma, Gender } from '@prisma/client';
import { z } from 'zod';

// Zod schema for updating a student (from previous step)
const updateStudentApiSchema = z.object({
  firstName: z.string().min(1, "First name is required.").optional(),
  lastName: z.string().min(1, "Last name is required.").optional(),
  middleName: z.string().optional().or(z.literal('')).nullable(),
  studentIdNumber: z.string().min(1, "Student ID number is required.").optional(),
  dateOfBirth: z.string().refine(val => !val || !isNaN(Date.parse(val)), { message: "Invalid date of birth" }).optional().nullable(),
  gender: z.nativeEnum(Gender).optional(),
  enrollmentDate: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid enrollment date" }).optional().nullable(),
  currentClassId: z.string().cuid("Invalid class ID format.").optional().nullable(),
  address: z.string().optional().or(z.literal('')).nullable(),
  city: z.string().optional().or(z.literal('')).nullable(),
  stateOrRegion: z.string().optional().or(z.literal('')).nullable(),
  country: z.string().optional().or(z.literal('')).nullable(),
  postalCode: z.string().optional().or(z.literal('')).nullable(),
  emergencyContactName: z.string().optional().or(z.literal('')).nullable(),
  emergencyContactPhone: z.string().optional().or(z.literal('')).nullable(),
  bloodGroup: z.string().optional().or(z.literal('')).nullable(),
  allergies: z.string().optional().or(z.literal('')).nullable(),
  medicalNotes: z.string().optional().or(z.literal('')).nullable(),
  profilePictureUrl: z.string().url("Must be a valid URL if provided").optional().or(z.literal('')).nullable(),
  isActive: z.boolean().optional(),
});

interface RouteContext {
  params: {
    studentId: string;
  };
}

// GET Handler (from previous step)
export async function GET(req: NextRequest, { params }: RouteContext) {
  console.log(`[API_STUDENT_GET_ID] Received request for studentId: ${params.studentId}`);
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

    const { studentId } = params;
    if (!studentId) {
      return NextResponse.json({ message: 'Student ID is required' }, { status: 400 });
    }

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        user: { select: { id: true, email: true, isActive: true, profilePicture: true }},
        currentClass: { select: { id: true, name: true, section: true }}
      }
    });

    if (!student) { return NextResponse.json({ message: 'Student not found' }, { status: 404 }); }
    if (student.schoolId !== schoolId) {
      return NextResponse.json({ message: 'Forbidden: Student does not belong to your school' }, { status: 403 });
    }
    return NextResponse.json(student, { status: 200 });
  } catch (error) {
    console.error(`[API_STUDENT_GET_ID] Error fetching student ${params.studentId}:`, error);
    return NextResponse.json({ message: 'An unexpected error occurred while fetching student details' }, { status: 500 });
  }
}

// PATCH Handler (from previous step)
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  console.log(`[API_STUDENT_PATCH_ID] Received request to update studentId: ${params.studentId}`);
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

    const { studentId } = params;
    if (!studentId) { return NextResponse.json({ message: 'Student ID is required' }, { status: 400 });}

    const existingStudent = await prisma.student.findUnique({
      where: { id: studentId },
      select: { schoolId: true, userId: true, studentIdNumber: true } 
    });

    if (!existingStudent) { return NextResponse.json({ message: 'Student not found' }, { status: 404 });}
    if (existingStudent.schoolId !== schoolId) {
      return NextResponse.json({ message: 'Forbidden: Student does not belong to your school' }, { status: 403 });
    }

    const body = await req.json();
    const validation = updateStudentApiSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ message: 'Invalid input', errors: validation.error.flatten().fieldErrors }, { status: 400 });
    }

    const { currentClassId, dateOfBirth, enrollmentDate, ...studentDataFromSchema } = validation.data;

    if (studentDataFromSchema.studentIdNumber && studentDataFromSchema.studentIdNumber !== existingStudent.studentIdNumber) {
      const studentWithNewId = await prisma.student.findUnique({
        where: { schoolId_studentIdNumber: { schoolId, studentIdNumber: studentDataFromSchema.studentIdNumber } }
      });
      if (studentWithNewId) {
        return NextResponse.json({ message: `Another student with ID Number ${studentDataFromSchema.studentIdNumber} already exists.` }, { status: 409 });
      }
    }
    
    const dataForPrisma: Prisma.StudentUpdateInput = {
      ...studentDataFromSchema,
      ...(dateOfBirth && { dateOfBirth: new Date(dateOfBirth) }),
      ...(enrollmentDate && { enrollmentDate: new Date(enrollmentDate) }),
      ...(currentClassId !== undefined && { currentClassId: currentClassId === '' ? null : currentClassId }),
    };
    
    Object.keys(dataForPrisma).forEach(key => {
        if (dataForPrisma[key as keyof typeof dataForPrisma] === undefined) {
            delete dataForPrisma[key as keyof typeof dataForPrisma];
        }
    });

    const updatedStudent = await prisma.student.update({
      where: { id: studentId },
      data: dataForPrisma,
      include: {
        user: { select: { id: true, email: true, isActive: true, profilePicture: true } },
        currentClass: { select: { id: true, name: true, section: true } }
      }
    });
    return NextResponse.json(updatedStudent, { status: 200 });
  } catch (error) {
    console.error(`[API_STUDENT_PATCH_ID] Error updating student ${params.studentId}:`, error);
    // ... (existing detailed error handling for PATCH)
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') { return NextResponse.json({ message: 'Student record not found to update.' }, { status: 404 });}
      if (error.code === 'P2002') { return NextResponse.json({ message: `A record with one of the provided unique fields already exists. ${error.meta?.target ? `Constraint on: ${(error.meta.target as string[]).join(', ')}` : ''}` }, { status: 409 });}
      if (error.code === 'P2003' && error.meta?.field_name === 'Student_currentClassId_fkey (index)') {
         return NextResponse.json({ message: 'Invalid Class ID provided. The selected class does not exist.' }, { status: 400 });
      }
      return NextResponse.json({ message: `Database error: ${error.code}` }, { status: 500 });
    }
    if (error instanceof z.ZodError) { return NextResponse.json({ message: 'Invalid input (Zod final check)', errors: error.errors }, { status: 400 }); }
    return NextResponse.json({ message: 'An unexpected error occurred while updating the student' }, { status: 500 });
  }
}

// NEW DELETE Handler: Delete a student by their Student ID
export async function DELETE(req: NextRequest, { params }: RouteContext) {
  console.log(`[API_STUDENT_DELETE_ID] Received request to delete studentId: ${params.studentId}`);
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

    const { studentId } = params;
    if (!studentId) {
      return NextResponse.json({ message: 'Student ID is required' }, { status: 400 });
    }

    // 3. Verify the student exists and belongs to the admin's school
    const studentToDelete = await prisma.student.findUnique({
      where: { id: studentId },
      select: { schoolId: true, userId: true } // Select userId if you plan to handle the linked User account
    });

    if (!studentToDelete) {
      return NextResponse.json({ message: 'Student not found' }, { status: 404 });
    }
    if (studentToDelete.schoolId !== schoolId) {
      console.warn(`[API_STUDENT_DELETE_ID] AuthZ attempt: Admin ${schoolAdminUserId} (school ${schoolId}) tried to delete student ${studentId} (school ${studentToDelete.schoolId})`);
      return NextResponse.json({ message: 'Forbidden: Student does not belong to your school' }, { status: 403 });
    }

    // 4. Perform the delete operation
    // Note on related data: Your Prisma schema's `onDelete` rules for relations on Student
    // (e.g., StudentAttendance, StudentGrade, StudentParentLink, StudentClassEnrollment) will apply.
    // If any are `Restrict` and linked records exist, this delete will fail (P2003).
    await prisma.student.delete({
      where: { id: studentId },
    });

    // --- Decision on linked User account ---
    // If a student has a linked User account (studentToDelete.userId is not null),
    // you need to decide what to do with it:
    // Option A: Leave the User account (simplest). It might become orphaned or reused.
    // Option B: Mark the User account as inactive.
    // Option C: Delete the User account (if this user has no other roles/links).
    // For now, we'll implement Option A (do nothing to the User account).
    if (studentToDelete.userId) {
        console.log(`[API_STUDENT_DELETE_ID] Student ${studentId} deleted. Associated User account ${studentToDelete.userId} was NOT deleted.`);
        // To implement Option B:
        // await prisma.user.update({ where: { id: studentToDelete.userId }, data: { isActive: false }});
    }

    console.log(`[API_STUDENT_DELETE_ID] Student ${studentId} deleted successfully from school ${schoolId}.`);
    return NextResponse.json({ message: 'Student deleted successfully' }, { status: 200 }); // Or 204 No Content

  } catch (error) {
    console.error(`[API_STUDENT_DELETE_ID] Error deleting student ${params.studentId}:`, error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') { // Record to delete not found
        return NextResponse.json({ message: 'Student not found to delete.' }, { status: 404 });
      }
      if (error.code === 'P2003') { // Foreign key constraint failed
        // This means the student is still linked to other records (e.g., grades, attendance)
        // and your schema's onDelete rule is Restrict.
        const fieldName = error.meta?.field_name || 'related records';
        return NextResponse.json({ message: `Cannot delete student: They are still referenced by other records (field: ${fieldName}). Please remove these dependencies first.` }, { status: 409 });
      }
      return NextResponse.json({ message: `Database error: ${error.code}. Check server logs.` }, { status: 500 });
    }
    return NextResponse.json({ message: 'An unexpected error occurred while deleting the student' }, { status: 500 });
  }
}