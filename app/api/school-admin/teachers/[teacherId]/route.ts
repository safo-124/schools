// app/api/school-admin/teachers/[teacherId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';// Adjust path as needed
import prisma from '@/lib/db'; // Using shared Prisma instance
import { UserRole, Prisma} from '@prisma/client'; // Added TermPeriod just in case, though not used in this teacher schema
import { z } from 'zod';

// Zod schema for updating a teacher (all fields optional for PATCH)
const updateTeacherSchema = z.object({
  // User fields
  firstName: z.string().min(1, "First name is required.").optional(),
  lastName: z.string().min(1, "Last name is required.").optional(),
  email: z.string().email("Invalid email address.").optional(),
  phoneNumber: z.string().optional().or(z.literal('')).nullable(),
  profilePicture: z.string().url("Profile picture must be a valid URL if provided.").optional().or(z.literal('')).nullable(),
  isActive: z.boolean().optional(), // For the User record's active status

  // Teacher-specific fields
  teacherIdNumber: z.string().optional().or(z.literal('')).nullable(),
  dateOfJoining: z.string().optional().refine(val => !val || !isNaN(Date.parse(val)), { // Expects ISO string from client
    message: "Invalid date format for date of joining (YYYY-MM-DD or ISO string expected if provided)",
  }).or(z.literal('')).nullable(),
  qualifications: z.string().optional().or(z.literal('')).nullable(),
  specialization: z.string().optional().or(z.literal('')).nullable(),
});

interface RouteContext {
  params: {
    teacherId: string; // This comes from the folder name [teacherId]
  };
}

// GET Handler: Fetch a single teacher by their Teacher ID
export async function GET(req: NextRequest, { params }: RouteContext) {
  console.log(`[API_TEACHER_GET_ID] Received request for teacherId: ${params.teacherId}`);
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

    const { teacherId } = params;
    if (!teacherId) {
      return NextResponse.json({ message: 'Teacher ID is required' }, { status: 400 });
    }

    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phoneNumber: true,
            profilePicture: true,
            isActive: true,
          }
        }
      }
    });

    if (!teacher) {
      return NextResponse.json({ message: 'Teacher not found' }, { status: 404 });
    }

    // Security check: Ensure the teacher belongs to the admin's school
    if (teacher.schoolId !== schoolId) {
      console.warn(`[API_TEACHER_GET_ID] Authorization attempt: Admin ${schoolAdminUserId} (school ${schoolId}) tried to access teacher ${teacherId} (school ${teacher.schoolId})`);
      return NextResponse.json({ message: 'Forbidden: Teacher does not belong to your school' }, { status: 403 });
    }

    return NextResponse.json(teacher, { status: 200 });

  } catch (error) {
    console.error(`[API_TEACHER_GET_ID] Error fetching teacher ${params.teacherId}:`, error);
    return NextResponse.json({ message: 'An unexpected error occurred while fetching teacher details' }, { status: 500 });
  }
}

// PATCH Handler: Update a teacher by their Teacher ID
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  console.log(`[API_TEACHER_PATCH_ID] Received request to update teacherId: ${params.teacherId}`);
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

    const { teacherId } = params;
    if (!teacherId) {
      return NextResponse.json({ message: 'Teacher ID is required' }, { status: 400 });
    }

    const existingTeacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
      select: { schoolId: true, userId: true, user: { select: { email: true }} }
    });

    if (!existingTeacher) {
      return NextResponse.json({ message: 'Teacher not found' }, { status: 404 });
    }
    if (existingTeacher.schoolId !== schoolId) {
      console.warn(`[API_TEACHER_PATCH_ID] Authorization attempt: Admin ${schoolAdminUserId} (school ${schoolId}) tried to update teacher ${teacherId} (school ${existingTeacher.schoolId})`);
      return NextResponse.json({ message: 'Forbidden: Teacher does not belong to your school' }, { status: 403 });
    }

    const body = await req.json();
    console.log("[API_TEACHER_PATCH_ID] Received body for update:", JSON.stringify(body, null, 2));
    const validation = updateTeacherSchema.safeParse(body);

    if (!validation.success) {
      console.error("[API_TEACHER_PATCH_ID] Zod validation failed:", JSON.stringify(validation.error.flatten().fieldErrors, null, 2));
      return NextResponse.json({ message: 'Invalid input', errors: validation.error.flatten().fieldErrors }, { status: 400 });
    }

    const {
      firstName, lastName, email, phoneNumber, profilePicture, isActive,
      dateOfJoining, qualifications, specialization, teacherIdNumber,
    } = validation.data;

    const userDataToUpdate: Prisma.UserUpdateInput = {};
    if (firstName !== undefined) userDataToUpdate.firstName = firstName;
    if (lastName !== undefined) userDataToUpdate.lastName = lastName;
    if (email !== undefined && email !== existingTeacher.user.email) {
      const userWithNewEmail = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (userWithNewEmail && userWithNewEmail.id !== existingTeacher.userId) {
        return NextResponse.json({ message: `Email ${email} is already in use by another user.` }, { status: 409 });
      }
      userDataToUpdate.email = email;
    }
    // Handle empty strings for nullable fields by converting to null
    if (phoneNumber !== undefined) userDataToUpdate.phoneNumber = phoneNumber === '' ? null : phoneNumber;
    if (profilePicture !== undefined) userDataToUpdate.profilePicture = profilePicture === '' ? null : profilePicture;
    if (isActive !== undefined) userDataToUpdate.isActive = isActive;

    const teacherDataToUpdate: Prisma.TeacherUpdateInput = {};
    if (dateOfJoining !== undefined) teacherDataToUpdate.dateOfJoining = dateOfJoining ? new Date(dateOfJoining) : null;
    if (qualifications !== undefined) teacherDataToUpdate.qualifications = qualifications === '' ? null : qualifications;
    if (specialization !== undefined) teacherDataToUpdate.specialization = specialization === '' ? null : specialization;
    if (teacherIdNumber !== undefined) teacherDataToUpdate.teacherIdNumber = teacherIdNumber === '' ? null : teacherIdNumber;

    const updatedTeacher = await prisma.$transaction(async (tx) => {
      if (Object.keys(userDataToUpdate).length > 0) {
        await tx.user.update({
          where: { id: existingTeacher.userId },
          data: userDataToUpdate,
        });
        console.log(`[API_TEACHER_PATCH_ID] User data updated for userId: ${existingTeacher.userId}`);
      }

      if (Object.keys(teacherDataToUpdate).length > 0) {
         await tx.teacher.update({ // Changed to await, and will refetch below
          where: { id: teacherId },
          data: teacherDataToUpdate,
        });
         console.log(`[API_TEACHER_PATCH_ID] Teacher specific data updated for teacherId: ${teacherId}`);
      }
      // Always refetch the teacher with included user details to return the latest complete state
      return tx.teacher.findUniqueOrThrow({
        where: { id: teacherId },
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, email: true, isActive: true, profilePicture: true, phoneNumber: true }
          }
        }
      });
    });
    
    console.log(`[API_TEACHER_PATCH_ID] Teacher ${teacherId} updated successfully.`);
    return NextResponse.json(updatedTeacher, { status: 200 });

  } catch (error) {
    console.error(`[API_TEACHER_PATCH_ID] Error updating teacher ${params.teacherId}:`, error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') { return NextResponse.json({ message: 'Teacher record not found to update.' }, { status: 404 });}
      if (error.code === 'P2002') { return NextResponse.json({ message: `A record with one of the provided unique fields already exists. ${error.meta?.target ? `Constraint: ${(error.meta.target as string[]).join(', ')}` : ''}` }, { status: 409 });}
      return NextResponse.json({ message: `Database error: ${error.code}` }, { status: 500 });
    }
    if (error instanceof z.ZodError) { return NextResponse.json({ message: 'Invalid input (Zod final check)', errors: error.errors }, { status: 400 }); }
    return NextResponse.json({ message: 'An unexpected error occurred while updating the teacher' }, { status: 500 });
  }
}

// DELETE Handler: Delete a teacher by their Teacher ID
export async function DELETE(req: NextRequest, { params }: RouteContext) {
  console.log(`[API_TEACHER_DELETE_ID] Received request to delete teacherId: ${params.teacherId}`);
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

    const { teacherId } = params;
    if (!teacherId) {
      return NextResponse.json({ message: 'Teacher ID is required' }, { status: 400 });
    }

    const teacherToDelete = await prisma.teacher.findUnique({
      where: { id: teacherId },
      select: { schoolId: true, userId: true }
    });

    if (!teacherToDelete) {
      return NextResponse.json({ message: 'Teacher not found' }, { status: 404 });
    }
    if (teacherToDelete.schoolId !== schoolId) {
      console.warn(`[API_TEACHER_DELETE_ID] Authorization attempt: Admin ${schoolAdminUserId} (school ${schoolId}) tried to delete teacher ${teacherId} (school ${teacherToDelete.schoolId})`);
      return NextResponse.json({ message: 'Forbidden: Teacher does not belong to your school' }, { status: 403 });
    }

    // Handle deletion within a transaction if you also modify the User record
    // For now, just deleting Teacher record. User record remains.
    // Consider implications if teacher has active timetable slots (P2003 if Restrict)
    await prisma.teacher.delete({
      where: { id: teacherId },
    });
    
    // Optional: Logic to deactivate or change role of the associated User if they have no other active Teacher roles.
    // const userTeacherLinks = await prisma.teacher.count({ where: { userId: teacherToDelete.userId } });
    // if (userTeacherLinks === 0) {
    //   await prisma.user.update({
    //     where: { id: teacherToDelete.userId },
    //     data: { isActive: false } // Or another default role
    //   });
    // }

    console.log(`[API_TEACHER_DELETE_ID] Teacher ${teacherId} deleted successfully.`);
    return NextResponse.json({ message: 'Teacher deleted successfully' }, { status: 200 });

  } catch (error) {
    console.error(`[API_TEACHER_DELETE_ID] Error deleting teacher ${params.teacherId}:`, error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        return NextResponse.json({ message: 'Teacher not found to delete.' }, { status: 404 });
      }
      if (error.code === 'P2003') { // Foreign key constraint failed
        return NextResponse.json({ message: `Cannot delete teacher: They are still referenced by other records (e.g., timetable assignments). Please remove these assignments first. Field: ${error.meta?.field_name || 'unknown'}` }, { status: 409 });
      }
      return NextResponse.json({ message: `Database error: ${error.code}` }, { status: 500 });
    }
    return NextResponse.json({ message: 'An unexpected error occurred while deleting the teacher' }, { status: 500 });
  }
}