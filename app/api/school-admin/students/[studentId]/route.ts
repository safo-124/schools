// app/api/school-admin/students/[studentId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth'; // Ensure this path is correct
import prisma from '@/lib/db';
import { UserRole, Prisma, Gender } from '@prisma/client';
import { z } from 'zod';

// Zod schema for updating a student (all fields optional for PATCH)
const updateStudentApiSchema = z.object({
  firstName: z.string().min(1, "First name is required.").optional(),
  lastName: z.string().min(1, "Last name is required.").optional(),
  middleName: z.string().optional().or(z.literal('')).nullable(),
  studentIdNumber: z.string().min(1, "Student ID number is required.").optional(),
  dateOfBirth: z.string().refine(val => !val || !isNaN(Date.parse(val)), { message: "Invalid date of birth (expected ISO string)" }).optional().nullable(),
  gender: z.nativeEnum(Gender).optional(),
  enrollmentDate: z.string().refine(val => !val || !isNaN(Date.parse(val)), { message: "Invalid enrollment date (expected ISO string)" }).optional().nullable(),
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

// REMOVE the custom RouteContext interface
// interface RouteContext {
//   params: {
//     studentId: string;
//   };
// }

// GET Handler: Fetch a single student by their Student ID
export async function GET(
  request: NextRequest, 
  context: any // <<< TYPE BYPASS APPLIED HERE
) {
  const params = context.params as { studentId: string }; // Internal type assertion
  const { studentId } = params;
  
  console.log(`[API_STUDENT_GET_ID] Received request for studentId: ${studentId}`);
  try {
    if (typeof studentId !== 'string' || !studentId) {
        console.warn('[API_STUDENT_GET_ID] studentId is missing or not a string from context.params');
        return NextResponse.json({ message: 'Student ID is required and must be a string' }, { status: 400 });
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

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        user: { select: { id: true, email: true, isActive: true, profilePicture: true } },
        currentClass: { select: { id: true, name: true, section: true } }
      }
    });

    if (!student) { return NextResponse.json({ message: 'Student not found' }, { status: 404 }); }
    if (student.schoolId !== schoolId) {
      return NextResponse.json({ message: 'Forbidden: Student does not belong to your school' }, { status: 403 });
    }
    return NextResponse.json(student, { status: 200 });
  } catch (error: any) {
    console.error(`[API_STUDENT_GET_ID] Error fetching student ${studentId || 'unknown'}:`, error.name, error.message);
    return NextResponse.json({ message: 'An unexpected error occurred while fetching student details' }, { status: 500 });
  }
}

// PATCH Handler: Update a student by their Student ID
export async function PATCH(
  request: NextRequest, 
  context: any // <<< TYPE BYPASS APPLIED HERE
) {
  const params = context.params as { studentId: string }; // Internal type assertion
  const { studentId } = params;

  console.log(`[API_STUDENT_PATCH_ID] Received request to update studentId: ${studentId}`);
  try {
    if (typeof studentId !== 'string' || !studentId) {
        console.warn('[API_STUDENT_PATCH_ID] studentId is missing or not a string from context.params');
        return NextResponse.json({ message: 'Student ID is required and must be a string' }, { status: 400 });
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

    const existingStudent = await prisma.student.findUnique({
      where: { id: studentId },
      select: { schoolId: true, userId: true, studentIdNumber: true, isActive: true } 
    });

    if (!existingStudent) { return NextResponse.json({ message: 'Student not found' }, { status: 404 });}
    if (existingStudent.schoolId !== schoolId) {
      return NextResponse.json({ message: 'Forbidden: Student does not belong to your school' }, { status: 403 });
    }

    const body = await request.json();
    const validation = updateStudentApiSchema.safeParse(body);

    if (!validation.success) {
      console.error("[API_STUDENT_PATCH_ID] Zod validation failed:", JSON.stringify(validation.error.flatten().fieldErrors, null, 2));
      return NextResponse.json({ message: 'Invalid input', errors: validation.error.flatten().fieldErrors }, { status: 400 });
    }

    const { currentClassId, dateOfBirth, enrollmentDate, isActive: newStudentIsActiveStatus, ...otherStudentData } = validation.data;
    
    if (otherStudentData.studentIdNumber && otherStudentData.studentIdNumber !== existingStudent.studentIdNumber) {
      const studentWithNewId = await prisma.student.findUnique({
        where: { schoolId_studentIdNumber: { schoolId, studentIdNumber: otherStudentData.studentIdNumber } }
      });
      if (studentWithNewId) {
        return NextResponse.json({ message: `Another student with ID Number ${otherStudentData.studentIdNumber} already exists in this school.` }, { status: 409 });
      }
    }
    
    const dataForStudentUpdate: Prisma.StudentUpdateInput = { ...otherStudentData };
    if (dateOfBirth !== undefined) dataForStudentUpdate.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;
    if (enrollmentDate !== undefined) dataForStudentUpdate.enrollmentDate = enrollmentDate ? new Date(enrollmentDate) : null;
    if (currentClassId !== undefined) dataForStudentUpdate.currentClassId = currentClassId === '' || currentClassId === null ? null : currentClassId;
    if (newStudentIsActiveStatus !== undefined) dataForStudentUpdate.isActive = newStudentIsActiveStatus;
    
    // Clean undefined fields from dataForStudentUpdate
    Object.keys(dataForStudentUpdate).forEach(key => {
        if (dataForStudentUpdate[key as keyof typeof dataForStudentUpdate] === undefined) {
            delete dataForStudentUpdate[key as keyof typeof dataForStudentUpdate];
        } else if (typeof dataForStudentUpdate[key as keyof typeof dataForStudentUpdate] === 'string' && (key === 'middleName' || key === 'address' || key === 'city' || key === 'stateOrRegion' || key === 'country' || key === 'postalCode' || key === 'emergencyContactName' || key === 'emergencyContactPhone' || key === 'bloodGroup' || key === 'allergies' || key === 'medicalNotes' || key === 'profilePictureUrl' || key === 'studentIdNumber' ) && dataForStudentUpdate[key as keyof typeof dataForStudentUpdate] === '') {
            (dataForStudentUpdate as any)[key] = null; // Convert empty strings for nullable fields to null
        }
    });

    if (Object.keys(dataForStudentUpdate).length === 0) {
        return NextResponse.json({ message: "No changes provided to update." }, { status: 400 });
    }

    const updatedStudent = await prisma.$transaction(async (tx) => {
        const studentUpdateResult = await tx.student.update({
            where: { id: studentId },
            data: dataForStudentUpdate,
        });

        if (newStudentIsActiveStatus !== undefined && existingStudent.userId && newStudentIsActiveStatus !== existingStudent.isActive) {
            await tx.user.update({
                where: { id: existingStudent.userId },
                data: { isActive: newStudentIsActiveStatus }
            });
            console.log(`[API_STUDENT_PATCH_ID] Synced isActive status for User ${existingStudent.userId} to ${newStudentIsActiveStatus}`);
        }
        
        return tx.student.findUniqueOrThrow({
            where: { id: studentId },
            include: {
                user: { select: { id: true, email: true, isActive: true, profilePicture: true } },
                currentClass: { select: { id: true, name: true, section: true } }
            }
        });
    });
    
    return NextResponse.json(updatedStudent, { status: 200 });

  } catch (error: any) {
    console.error(`[API_STUDENT_PATCH_ID] Error updating student ${studentId || 'unknown'}:`, error.name, error.message);
    if (error instanceof Prisma.PrismaClientKnownRequestError) { /* ... */ }
    if (error instanceof z.ZodError) { /* ... */ }
    return NextResponse.json({ message: 'An unexpected error occurred while updating the student' }, { status: 500 });
  }
}

// DELETE Handler: Deactivates (soft delete) a student by their Student ID
export async function DELETE(
  request: NextRequest, 
  context: any // <<< TYPE BYPASS APPLIED HERE
) {
  const params = context.params as { studentId: string }; // Internal type assertion
  const { studentId } = params;

  console.log(`[API_STUDENT_DEACTIVATE_ID] Received request to deactivate studentId: ${studentId}`);
  try {
    if (typeof studentId !== 'string' || !studentId) {
        console.warn('[API_STUDENT_DEACTIVATE_ID] studentId is missing or not a string');
        return NextResponse.json({ message: 'Student ID is required and must be a string' }, { status: 400 });
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

    const studentToDeactivate = await prisma.student.findUnique({
      where: { id: studentId },
      select: { schoolId: true, userId: true, isActive: true } 
    });

    if (!studentToDeactivate) {
      return NextResponse.json({ message: 'Student not found' }, { status: 404 });
    }
    if (studentToDeactivate.schoolId !== schoolId) {
      return NextResponse.json({ message: 'Forbidden: Student does not belong to your school' }, { status: 403 });
    }

    if (!studentToDeactivate.isActive) {
        return NextResponse.json({ message: 'Student is already inactive.' }, { status: 200 }); 
    }

    await prisma.$transaction(async (tx) => {
        await tx.student.update({
            where: { id: studentId },
            data: { isActive: false },
        });
        if (studentToDeactivate.userId) {
            await tx.user.update({
                where: { id: studentToDeactivate.userId },
                data: { isActive: false } 
            });
        }
    });
    
    console.log(`[API_STUDENT_DEACTIVATE_ID] Student ${studentId} deactivated successfully in school ${schoolId}.`);
    return NextResponse.json({ message: 'Student deactivated successfully' }, { status: 200 });

  } catch (error: any) {
    console.error(`[API_STUDENT_DEACTIVATE_ID] Error deactivating student ${studentId || 'unknown'}:`, error.name, error.message);
    if (error instanceof Prisma.PrismaClientKnownRequestError) { /* ... */ }
    return NextResponse.json({ message: 'An unexpected error occurred while deactivating the student' }, { status: 500 });
  }
}