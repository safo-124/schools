// app/api/school-admin/students/[studentId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
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
  isActive: z.boolean().optional(), // Student's enrollment status (true for active, false for inactive/withdrawn)
  
  // Fields for linked User account (if student has one and admin can update these)
  // For simplicity, we'll assume User.email is not changed here. User.isActive is synced with Student.isActive.
});

interface RouteContext {
  params: {
    studentId: string;
  };
}

// GET Handler: Fetch a single student by their Student ID
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
        user: { // Include linked User details if they exist
          select: { id: true, email: true, isActive: true, profilePicture: true }
        },
        currentClass: { // Include current class details
          select: { id: true, name: true, section: true }
        }
      }
    });

    if (!student) {
      return NextResponse.json({ message: 'Student not found' }, { status: 404 });
    }

    if (student.schoolId !== schoolId) {
      console.warn(`[API_STUDENT_GET_ID] AuthZ attempt: Admin ${schoolAdminUserId} (school ${schoolId}) tried to access student ${studentId} (school ${student.schoolId})`);
      return NextResponse.json({ message: 'Forbidden: Student does not belong to your school' }, { status: 403 });
    }

    return NextResponse.json(student, { status: 200 });

  } catch (error) {
    console.error(`[API_STUDENT_GET_ID] Error fetching student ${params.studentId}:`, error);
    return NextResponse.json({ message: 'An unexpected error occurred while fetching student details' }, { status: 500 });
  }
}

// PATCH Handler: Update a student by their Student ID
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
      select: { schoolId: true, userId: true, studentIdNumber: true, isActive: true } 
    });

    if (!existingStudent) { return NextResponse.json({ message: 'Student not found' }, { status: 404 });}
    if (existingStudent.schoolId !== schoolId) {
      return NextResponse.json({ message: 'Forbidden: Student does not belong to your school' }, { status: 403 });
    }

    const body = await req.json();
    console.log("[API_STUDENT_PATCH_ID] Received body for update:", JSON.stringify(body, null, 2));
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
    
    const dataForStudentUpdate: Prisma.StudentUpdateInput = {
      ...otherStudentData, // Includes firstName, lastName, studentIdNumber, etc.
      // Handle date conversions
      ...(dateOfBirth !== undefined && { dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null }),
      ...(enrollmentDate !== undefined && { enrollmentDate: enrollmentDate ? new Date(enrollmentDate) : null }),
      // Handle currentClassId explicitly to allow unsetting to null
      ...(currentClassId !== undefined && { currentClassId: currentClassId === '' || currentClassId === null ? null : currentClassId }),
    };
    // Only add isActive to update if it was actually provided in the PATCH payload
    if (newStudentIsActiveStatus !== undefined) {
        dataForStudentUpdate.isActive = newStudentIsActiveStatus;
    }
    
    // Remove undefined fields from dataForStudentUpdate to avoid Prisma errors
    Object.keys(dataForStudentUpdate).forEach(key => {
        if (dataForStudentUpdate[key as keyof typeof dataForStudentUpdate] === undefined) {
            delete dataForStudentUpdate[key as keyof typeof dataForStudentUpdate];
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

        // If Student.isActive status was explicitly changed in this PATCH request
        // and there's a linked User, sync User.isActive
        if (newStudentIsActiveStatus !== undefined && existingStudent.userId) {
            await tx.user.update({
                where: { id: existingStudent.userId },
                data: { isActive: newStudentIsActiveStatus } // Sync User.isActive
            });
            console.log(`[API_STUDENT_PATCH_ID] Synced isActive status for User ${existingStudent.userId} to ${newStudentIsActiveStatus}`);
        }
        
        return tx.student.findUniqueOrThrow({ // Re-fetch with includes for the response
            where: { id: studentId },
            include: {
                user: { select: { id: true, email: true, isActive: true, profilePicture: true } },
                currentClass: { select: { id: true, name: true, section: true } }
            }
        });
    });
    
    console.log(`[API_STUDENT_PATCH_ID] Student ${studentId} updated successfully.`);
    return NextResponse.json(updatedStudent, { status: 200 });

  } catch (error: any) {
    console.error(`[API_STUDENT_PATCH_ID] Error updating student ${params.studentId}:`, error.name, error.message, error.stack);
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

// DELETE Handler: Deactivates (soft delete) a student by their Student ID
export async function DELETE(req: NextRequest, { params }: RouteContext) {
  console.log(`[API_STUDENT_DEACTIVATE_ID] Received request to deactivate studentId: ${params.studentId}`);
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
        console.log(`[API_STUDENT_DEACTIVATE_ID] Student ${studentId} is already inactive.`);
        // Returning a success-like response as the desired state is achieved.
        // Or return 400 if you want to indicate "no action taken".
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
            console.log(`[API_STUDENT_DEACTIVATE_ID] Linked User account ${studentToDeactivate.userId} also marked as inactive.`);
        }
    });
    
    console.log(`[API_STUDENT_DEACTIVATE_ID] Student ${studentId} deactivated successfully in school ${schoolId}.`);
    return NextResponse.json({ message: 'Student deactivated successfully' }, { status: 200 });

  } catch (error: any) {
    console.error(`[API_STUDENT_DEACTIVATE_ID] Error deactivating student ${params.studentId}:`, error.name, error.message, error.stack);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') { 
        return NextResponse.json({ message: 'Student not found to deactivate.' }, { status: 404 });
      }
      return NextResponse.json({ message: `Database error: ${error.code}. Check server logs.` }, { status: 500 });
    }
    return NextResponse.json({ message: 'An unexpected error occurred while deactivating the student' }, { status: 500 });
  }
}