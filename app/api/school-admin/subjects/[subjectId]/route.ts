// app/api/school-admin/subjects/[subjectId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route'; // Adjust path
import prisma from '@/lib/db';
import { UserRole, Prisma } from '@prisma/client';
import { z } from 'zod';

// Zod schema for updating a subject (from previous step)
const updateSubjectApiSchema = z.object({
  name: z.string().min(1, "Subject name is required.").optional(),
  code: z.string().optional().or(z.literal('')).nullable(),
  description: z.string().optional().or(z.literal('')).nullable(),
});

interface RouteContext {
  params: {
    subjectId: string;
  };
}

// GET Handler (from previous step)
export async function GET(req: NextRequest, { params }: RouteContext) {
  console.log(`[API_SUBJECT_GET_ID] Received request for subjectId: ${params.subjectId}`);
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

    const { subjectId } = params;
    if (!subjectId) {
      return NextResponse.json({ message: 'Subject ID is required' }, { status: 400 });
    }

    const subject = await prisma.subject.findUnique({
      where: { id: subjectId },
    });

    if (!subject) { return NextResponse.json({ message: 'Subject not found' }, { status: 404 });}
    if (subject.schoolId !== schoolId) {
      return NextResponse.json({ message: 'Forbidden: Subject does not belong to your school' }, { status: 403 });
    }
    return NextResponse.json(subject, { status: 200 });
  } catch (error) {
    console.error(`[API_SUBJECT_GET_ID] Error fetching subject ${params.subjectId}:`, error);
    return NextResponse.json({ message: 'An unexpected error occurred while fetching subject details' }, { status: 500 });
  }
}

// PATCH Handler (from previous step)
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  console.log(`[API_SUBJECT_PATCH_ID] Received request to update subjectId: ${params.subjectId}`);
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

    const { subjectId } = params;
    if (!subjectId) { return NextResponse.json({ message: 'Subject ID is required' }, { status: 400 });}

    const existingSubject = await prisma.subject.findUnique({
      where: { id: subjectId },
      select: { schoolId: true } 
    });

    if (!existingSubject) { return NextResponse.json({ message: 'Subject not found' }, { status: 404 });}
    if (existingSubject.schoolId !== schoolId) {
      return NextResponse.json({ message: 'Forbidden: Subject does not belong to your school' }, { status: 403 });
    }

    const body = await req.json();
    const validation = updateSubjectApiSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ message: 'Invalid input', errors: validation.error.flatten().fieldErrors }, { status: 400 });
    }

    const dataToUpdateFromSchema = validation.data;
    const dataForPrisma: Prisma.SubjectUpdateInput = {};
    if (dataToUpdateFromSchema.name !== undefined) dataForPrisma.name = dataToUpdateFromSchema.name;
    if (dataToUpdateFromSchema.code !== undefined) {
        dataForPrisma.code = dataToUpdateFromSchema.code === '' ? null : dataToUpdateFromSchema.code;
    }
    if (dataToUpdateFromSchema.description !== undefined) {
        dataForPrisma.description = dataToUpdateFromSchema.description === '' ? null : dataToUpdateFromSchema.description;
    }
    
    const updatedSubject = await prisma.subject.update({
      where: { id: subjectId },
      data: dataForPrisma,
    });
    return NextResponse.json(updatedSubject, { status: 200 });
  } catch (error) {
    console.error(`[API_SUBJECT_PATCH_ID] Error updating subject ${params.subjectId}:`, error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') { return NextResponse.json({ message: 'Subject record not found to update.' }, { status: 404 });}
      if (error.code === 'P2002') { 
        const target = error.meta?.target as string[] | undefined;
        let fieldMessage = "name or code";
        if (target?.includes('name') && target?.includes('schoolId')) fieldMessage = "name for this school";
        else if (target?.includes('code') && target?.includes('schoolId')) fieldMessage = "code for this school";
        return NextResponse.json({ message: `A subject with the same ${fieldMessage} already exists.` }, { status: 409 });
      }
      return NextResponse.json({ message: `Database error: ${error.code}` }, { status: 500 });
    }
    if (error instanceof z.ZodError) { return NextResponse.json({ message: 'Invalid input (Zod final check)', errors: error.errors }, { status: 400 }); }
    return NextResponse.json({ message: 'An unexpected error occurred while updating the subject' }, { status: 500 });
  }
}

// NEW DELETE Handler: Delete a subject by its Subject ID
export async function DELETE(req: NextRequest, { params }: RouteContext) {
  console.log(`[API_SUBJECT_DELETE_ID] Received request to delete subjectId: ${params.subjectId}`);
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

    const { subjectId } = params;
    if (!subjectId) {
      return NextResponse.json({ message: 'Subject ID is required' }, { status: 400 });
    }

    // 3. Verify the subject exists and belongs to the admin's school
    const subjectToDelete = await prisma.subject.findUnique({
      where: { id: subjectId },
      select: { schoolId: true } 
    });

    if (!subjectToDelete) {
      return NextResponse.json({ message: 'Subject not found' }, { status: 404 });
    }
    if (subjectToDelete.schoolId !== schoolId) {
      console.warn(`[API_SUBJECT_DELETE_ID] AuthZ attempt: Admin ${schoolAdminUserId} (school ${schoolId}) tried to delete subject ${subjectId} (school ${subjectToDelete.schoolId})`);
      return NextResponse.json({ message: 'Forbidden: Subject does not belong to your school' }, { status: 403 });
    }

    // 4. Perform the delete operation
    // Note: Relations to Subject (TimetableSlot, Assignment, StudentGrade)
    // in your schema are set to onDelete: Cascade. This means related records
    // in those tables WILL BE DELETED if they reference this subject.
    // This is a significant operation.
    
    await prisma.subject.delete({
      where: { id: subjectId },
    });
    
    console.log(`[API_SUBJECT_DELETE_ID] Subject ${subjectId} deleted successfully from school ${schoolId}.`);
    return NextResponse.json({ message: 'Subject deleted successfully' }, { status: 200 }); // Or 204 No Content with no body

  } catch (error) {
    console.error(`[API_SUBJECT_DELETE_ID] Error deleting subject ${params.subjectId}:`, error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') { // Record to delete not found
        return NextResponse.json({ message: 'Subject not found to delete.' }, { status: 404 });
      }
      // P2003 (Foreign key constraint violation) might occur if a relation was NOT set to Cascade or SetNull
      // and instead had Restrict, and linked records still exist.
      // Given current schema (TimetableSlot, Assignment, StudentGrade on Subject are Cascade), P2003 is less likely here
      // unless another unhandled relation with Restrict exists.
      if (error.code === 'P2003') { 
        const fieldName = error.meta?.field_name || 'related records';
        return NextResponse.json({ message: `Cannot delete subject: It is still referenced by other records (field: ${fieldName}) where deletion is restricted. Please remove these dependencies first.` }, { status: 409 });
      }
      return NextResponse.json({ message: `Database error: ${error.code}. Check server logs.` }, { status: 500 });
    }
    return NextResponse.json({ message: 'An unexpected error occurred while deleting the subject' }, { status: 500 });
  }
}