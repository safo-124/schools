// app/api/school-admin/subjects/[subjectId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth'; // Ensure this path is correct
import prisma from '@/lib/db';
import { UserRole, Prisma } from '@prisma/client';
import { z } from 'zod';

// Zod schema for updating a subject (all fields optional for PATCH)
const updateSubjectApiSchema = z.object({
  name: z.string().min(1, "Subject name is required.").optional(),
  code: z.string().optional().or(z.literal('')).nullable(),
  description: z.string().optional().or(z.literal('')).nullable(),
});

// REMOVE the custom RouteContext interface
// interface RouteContext {
//   params: {
//     subjectId: string;
//   };
// }

// GET Handler: Fetch a single subject by its Subject ID
export async function GET(
  request: NextRequest, 
  context: any // <<< TYPE BYPASS APPLIED HERE
) {
  const params = context.params as { subjectId: string }; // Internal type assertion
  const { subjectId } = params;
  
  console.log(`[API_SUBJECT_GET_ID] Received request for subjectId: ${subjectId}`);
  try {
    if (typeof subjectId !== 'string' || !subjectId) {
        console.warn('[API_SUBJECT_GET_ID] subjectId is missing or not a string from context.params');
        return NextResponse.json({ message: 'Subject ID is required and must be a string' }, { status: 400 });
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

    const subject = await prisma.subject.findUnique({
      where: { id: subjectId },
    });

    if (!subject) { 
      return NextResponse.json({ message: 'Subject not found' }, { status: 404 });
    }
    if (subject.schoolId !== schoolId) {
      console.warn(`[API_SUBJECT_GET_ID] AuthZ attempt: Admin ${schoolAdminUserId} (school ${schoolId}) tried to access subject ${subjectId} (school ${subject.schoolId})`);
      return NextResponse.json({ message: 'Forbidden: Subject does not belong to your school' }, { status: 403 });
    }
    return NextResponse.json(subject, { status: 200 });

  } catch (error: any) {
    console.error(`[API_SUBJECT_GET_ID] Error fetching subject ${subjectId || 'unknown'}:`, error.name, error.message);
    return NextResponse.json({ message: 'An unexpected error occurred while fetching subject details' }, { status: 500 });
  }
}

// PATCH Handler: Update a subject by its Subject ID
export async function PATCH(
  request: NextRequest, 
  context: any // <<< TYPE BYPASS APPLIED HERE
) {
  const params = context.params as { subjectId: string }; // Internal type assertion
  const { subjectId } = params;

  console.log(`[API_SUBJECT_PATCH_ID] Received request to update subjectId: ${subjectId}`);
  try {
    if (typeof subjectId !== 'string' || !subjectId) {
        console.warn('[API_SUBJECT_PATCH_ID] subjectId is missing or not a string from context.params');
        return NextResponse.json({ message: 'Subject ID is required and must be a string' }, { status: 400 });
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

    const existingSubject = await prisma.subject.findUnique({
      where: { id: subjectId },
      select: { schoolId: true } 
    });

    if (!existingSubject) { 
      return NextResponse.json({ message: 'Subject not found' }, { status: 404 });
    }
    if (existingSubject.schoolId !== schoolId) {
      console.warn(`[API_SUBJECT_PATCH_ID] AuthZ attempt for subjectId ${subjectId}`);
      return NextResponse.json({ message: 'Forbidden: Subject does not belong to your school' }, { status: 403 });
    }

    const body = await request.json();
    console.log("[API_SUBJECT_PATCH_ID] Received body for update:", JSON.stringify(body, null, 2));
    const validation = updateSubjectApiSchema.safeParse(body);

    if (!validation.success) {
      console.error("[API_SUBJECT_PATCH_ID] Zod validation failed:", JSON.stringify(validation.error.flatten().fieldErrors, null, 2));
      return NextResponse.json({ message: 'Invalid input', errors: validation.error.flatten().fieldErrors }, { status: 400 });
    }

    const dataToUpdateFromSchema = validation.data;
    const dataForPrisma: Prisma.SubjectUpdateInput = {};
    if ('name' in dataToUpdateFromSchema && dataToUpdateFromSchema.name !== undefined) dataForPrisma.name = dataToUpdateFromSchema.name;
    if ('code' in dataToUpdateFromSchema) dataForPrisma.code = dataToUpdateFromSchema.code === '' ? null : dataToUpdateFromSchema.code;
    if ('description' in dataToUpdateFromSchema) dataForPrisma.description = dataToUpdateFromSchema.description === '' ? null : dataToUpdateFromSchema.description;
    
    if (Object.keys(dataForPrisma).length === 0) {
        return NextResponse.json({ message: 'No valid fields provided for update.' }, { status: 400 });
    }

    const updatedSubject = await prisma.subject.update({
      where: { id: subjectId },
      data: dataForPrisma,
    });
    
    console.log(`[API_SUBJECT_PATCH_ID] Subject ${subjectId} updated successfully.`);
    return NextResponse.json(updatedSubject, { status: 200 });

  } catch (error: any) {
    console.error(`[API_SUBJECT_PATCH_ID] Error updating subject ${subjectId || 'unknown'}:`, error.name, error.message);
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

// DELETE Handler: Delete a subject by its Subject ID
export async function DELETE(
  request: NextRequest, 
  context: any // <<< TYPE BYPASS APPLIED HERE
) {
  const params = context.params as { subjectId: string }; // Internal type assertion
  const { subjectId } = params;

  console.log(`[API_SUBJECT_DELETE_ID] Received request to delete subjectId: ${subjectId}`);
  try {
    if (typeof subjectId !== 'string' || !subjectId) {
        console.warn('[API_SUBJECT_DELETE_ID] subjectId is missing or not a string');
        return NextResponse.json({ message: 'Subject ID is required and must be a string' }, { status: 400 });
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

    const subjectToDelete = await prisma.subject.findUnique({
      where: { id: subjectId },
      select: { schoolId: true } 
    });

    if (!subjectToDelete) {
      return NextResponse.json({ message: 'Subject not found' }, { status: 404 });
    }
    if (subjectToDelete.schoolId !== schoolId) {
      console.warn(`[API_SUBJECT_DELETE_ID] AuthZ attempt on subjectId ${subjectId}`);
      return NextResponse.json({ message: 'Forbidden: Subject does not belong to your school' }, { status: 403 });
    }
    
    // Note: Relations to Subject (TimetableSlot, Assignment, StudentGrade)
    // in your schema are set to onDelete: Cascade.
    await prisma.subject.delete({
      where: { id: subjectId },
    });
    
    console.log(`[API_SUBJECT_DELETE_ID] Subject ${subjectId} deleted successfully from school ${schoolId}.`);
    return NextResponse.json({ message: 'Subject deleted successfully' }, { status: 200 });

  } catch (error: any) {
    console.error(`[API_SUBJECT_DELETE_ID] Error deleting subject ${subjectId || 'unknown'}:`, error.name, error.message);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        return NextResponse.json({ message: 'Subject not found to delete.' }, { status: 404 });
      }
      if (error.code === 'P2003') { 
        const fieldName = error.meta?.field_name || 'related records';
        return NextResponse.json({ message: `Cannot delete subject: It is still referenced by other records (field: ${fieldName}) where deletion is restricted.` }, { status: 409 });
      }
      return NextResponse.json({ message: `Database error: ${error.code}. Check server logs.` }, { status: 500 });
    }
    return NextResponse.json({ message: 'An unexpected error occurred while deleting the subject' }, { status: 500 });
  }
}