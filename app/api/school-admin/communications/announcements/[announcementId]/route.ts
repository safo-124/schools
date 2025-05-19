// app/api/school-admin/communications/announcements/[announcementId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';; // Adjust path
import prisma from '@/lib/db';
import { UserRole, Prisma } from '@prisma/client';
import { z } from 'zod';

// Zod schema for updating an announcement (all fields optional for PATCH)
const updateAnnouncementApiSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters long.").optional(),
  content: z.string().min(10, "Content must be at least 10 characters long.").optional(),
  publishDate: z.string().refine(val => !val || !isNaN(Date.parse(val)), { 
    message: "Invalid publish date format.",
  }).optional().nullable(),
  expiryDate: z.string().refine(val => !val || !isNaN(Date.parse(val)), { 
    message: "Invalid expiry date format.",
  }).optional().nullable(),
  audience: z.string().optional().or(z.literal('')).nullable(),
  isPublished: z.boolean().optional(),
}).refine(data => {
    // Ensure expiryDate is after publishDate if both are provided
    if (data.expiryDate && data.publishDate && new Date(data.expiryDate) < new Date(data.publishDate)) {
        return false;
    }
    return true;
}, {
    message: "Expiry date cannot be before publish date.",
    path: ["expiryDate"],
});


interface RouteContext {
  params: {
    announcementId: string; 
  };
}

// GET Handler: Fetch a single announcement by its ID
export async function GET(req: NextRequest, { params }: RouteContext) {
  console.log(`[API_ANNOUNCEMENT_GET_ID] Received request for announcementId: ${params.announcementId}`);
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

    const { announcementId } = params;
    if (!announcementId) {
      return NextResponse.json({ message: 'Announcement ID is required' }, { status: 400 });
    }

    const announcement = await prisma.schoolAnnouncement.findUnique({
      where: { id: announcementId },
      include: {
        createdByAdmin: {
          select: { user: { select: { firstName: true, lastName: true }}}
        }
      }
    });

    if (!announcement) {
      return NextResponse.json({ message: 'Announcement not found' }, { status: 404 });
    }

    if (announcement.schoolId !== schoolId) {
      console.warn(`[API_ANNOUNCEMENT_GET_ID] AuthZ attempt: Admin ${schoolAdminUserId} (school ${schoolId}) tried to access announcement ${announcementId} (school ${announcement.schoolId})`);
      return NextResponse.json({ message: 'Forbidden: Announcement does not belong to your school' }, { status: 403 });
    }

    return NextResponse.json(announcement, { status: 200 });

  } catch (error) {
    console.error(`[API_ANNOUNCEMENT_GET_ID] Error fetching announcement ${params.announcementId}:`, error);
    return NextResponse.json({ message: 'An unexpected error occurred while fetching announcement details' }, { status: 500 });
  }
}

// PATCH Handler: Update an announcement by its ID
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  console.log(`[API_ANNOUNCEMENT_PATCH_ID] Received request to update announcementId: ${params.announcementId}`);
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

    const { announcementId } = params;
    if (!announcementId) {
      return NextResponse.json({ message: 'Announcement ID is required' }, { status: 400 });
    }

    const existingAnnouncement = await prisma.schoolAnnouncement.findUnique({
      where: { id: announcementId },
      select: { schoolId: true } 
    });

    if (!existingAnnouncement) {
      return NextResponse.json({ message: 'Announcement not found' }, { status: 404 });
    }
    if (existingAnnouncement.schoolId !== schoolId) {
      return NextResponse.json({ message: 'Forbidden: Announcement does not belong to your school' }, { status: 403 });
    }

    const body = await req.json();
    console.log("[API_ANNOUNCEMENT_PATCH_ID] Received body for update:", JSON.stringify(body, null, 2));
    
    const validation = updateAnnouncementApiSchema.safeParse(body);
    if (!validation.success) {
      console.error("[API_ANNOUNCEMENT_PATCH_ID] Zod validation failed:", JSON.stringify(validation.error.flatten().fieldErrors, null, 2));
      return NextResponse.json({ message: 'Invalid input', errors: validation.error.flatten().fieldErrors }, { status: 400 });
    }

    const dataToUpdateFromSchema = validation.data;
    
    const dataForPrisma: Prisma.SchoolAnnouncementUpdateInput = {};
    if (dataToUpdateFromSchema.title !== undefined) dataForPrisma.title = dataToUpdateFromSchema.title;
    if (dataToUpdateFromSchema.content !== undefined) dataForPrisma.content = dataToUpdateFromSchema.content;
    if (dataToUpdateFromSchema.publishDate !== undefined) dataForPrisma.publishDate = dataToUpdateFromSchema.publishDate ? new Date(dataToUpdateFromSchema.publishDate) : null;
    if (dataToUpdateFromSchema.expiryDate !== undefined) dataForPrisma.expiryDate = dataToUpdateFromSchema.expiryDate ? new Date(dataToUpdateFromSchema.expiryDate) : null;
    if (dataToUpdateFromSchema.audience !== undefined) dataForPrisma.audience = dataToUpdateFromSchema.audience === '' ? null : dataToUpdateFromSchema.audience;
    if (dataToUpdateFromSchema.isPublished !== undefined) dataForPrisma.isPublished = dataToUpdateFromSchema.isPublished;
    
    if (Object.keys(dataForPrisma).length === 0) {
        return NextResponse.json({ message: 'No valid fields provided for update.' }, { status: 400 });
    }

    const updatedAnnouncement = await prisma.schoolAnnouncement.update({
      where: { id: announcementId },
      data: dataForPrisma,
      include: {
        createdByAdmin: { select: { user: { select: { firstName: true, lastName: true }}}}
      }
    });
    
    console.log(`[API_ANNOUNCEMENT_PATCH_ID] Announcement ${announcementId} updated successfully.`);
    return NextResponse.json(updatedAnnouncement, { status: 200 });

  } catch (error) {
    console.error(`[API_ANNOUNCEMENT_PATCH_ID] Error updating announcement ${params.announcementId}:`, error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') { return NextResponse.json({ message: 'Announcement record not found to update.' }, { status: 404 });}
      // Add other specific Prisma errors if needed
      return NextResponse.json({ message: `Database error: ${error.code}` }, { status: 500 });
    }
    if (error instanceof z.ZodError) { return NextResponse.json({ message: 'Invalid input (Zod final check)', errors: error.errors }, { status: 400 }); }
    return NextResponse.json({ message: 'An unexpected error occurred while updating the announcement' }, { status: 500 });
  }
}

// DELETE Handler: Delete an announcement by its ID
export async function DELETE(req: NextRequest, { params }: RouteContext) {
  console.log(`[API_ANNOUNCEMENT_DELETE_ID] Received request to delete announcementId: ${params.announcementId}`);
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

    const { announcementId } = params;
    if (!announcementId) {
      return NextResponse.json({ message: 'Announcement ID is required' }, { status: 400 });
    }

    const announcementToDelete = await prisma.schoolAnnouncement.findUnique({
      where: { id: announcementId },
      select: { schoolId: true } 
    });

    if (!announcementToDelete) {
      return NextResponse.json({ message: 'Announcement not found' }, { status: 404 });
    }
    if (announcementToDelete.schoolId !== schoolId) {
      return NextResponse.json({ message: 'Forbidden: Announcement does not belong to your school' }, { status: 403 });
    }
    
    await prisma.schoolAnnouncement.delete({
      where: { id: announcementId },
    });
    
    console.log(`[API_ANNOUNCEMENT_DELETE_ID] Announcement ${announcementId} deleted successfully from school ${schoolId}.`);
    return NextResponse.json({ message: 'Announcement deleted successfully' }, { status: 200 });

  } catch (error) {
    console.error(`[API_ANNOUNCEMENT_DELETE_ID] Error deleting announcement ${params.announcementId}:`, error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        return NextResponse.json({ message: 'Announcement not found to delete.' }, { status: 404 });
      }
      // P2003 (Foreign key constraint) is less likely for SchoolAnnouncement unless other models directly depend on it with Restrict.
      return NextResponse.json({ message: `Database error: ${error.code}. Check server logs.` }, { status: 500 });
    }
    return NextResponse.json({ message: 'An unexpected error occurred while deleting the announcement' }, { status: 500 });
  }
}