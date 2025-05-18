// app/api/school-admin/communications/announcements/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route'; // Adjust path as needed
import prisma from '@/lib/db'; // Using shared Prisma instance
import { UserRole, Prisma } from '@prisma/client';
import { z } from 'zod';

// Zod schema for creating a new school announcement
const createAnnouncementApiSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters long."),
  content: z.string().min(10, "Content must be at least 10 characters long."),
  publishDate: z.string().refine(val => !val || !isNaN(Date.parse(val)), { 
    message: "Invalid publish date format. Use ISO string or leave empty for now.",
  }).optional().nullable(), // If not provided, defaults to now
  expiryDate: z.string().refine(val => !val || !isNaN(Date.parse(val)), { 
    message: "Invalid expiry date format. Use ISO string.",
  }).optional().nullable(),
  audience: z.string().optional().or(z.literal('')).nullable(), // E.g., "ALL", "PARENTS_GRADE_1", "TEACHERS"
  isPublished: z.boolean().optional().default(true), // Default to published
});

// GET Handler: List all announcements for the School Admin's school
export async function GET(req: NextRequest) {
  console.log('[API_ANNOUNCEMENTS_GET_ALL] Received request to fetch announcements.');
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.role !== UserRole.SCHOOL_ADMIN) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
    }

    const schoolAdminUserId = session.user.id;
    const adminSchoolLink = await prisma.schoolAdmin.findFirst({
        where: { userId: schoolAdminUserId }, // Assuming one user is admin of one school contextually here
        select: { schoolId: true }
    });

    if (!adminSchoolLink?.schoolId) {
      return NextResponse.json({ message: 'Admin not associated with any school.' }, { status: 404 });
    }
    const schoolId = adminSchoolLink.schoolId;
    console.log(`[API_ANNOUNCEMENTS_GET_ALL] Fetching announcements for School ID: ${schoolId}`);

    // Optional: Add query params for filtering by isPublished, audience, or date range
    const announcements = await prisma.schoolAnnouncement.findMany({
      where: {
        schoolId: schoolId,
      },
      include: {
        createdByAdmin: { // To get details of who created it
          select: {
            user: {
              select: { firstName: true, lastName: true, email: true }
            }
          }
        }
      },
      orderBy: [
        { publishDate: 'desc' },
        { createdAt: 'desc' },
      ],
    });
    console.log(`[API_ANNOUNCEMENTS_GET_ALL] Found ${announcements.length} announcements for school ID: ${schoolId}`);
    return NextResponse.json(announcements, { status: 200 });

  } catch (error) {
    console.error('[API_ANNOUNCEMENTS_GET_ALL] An error occurred:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
        return NextResponse.json({ message: `Database error: ${error.message}` }, { status: 500 });
    }
    return NextResponse.json({ message: 'An unexpected error occurred while fetching announcements.' }, { status: 500 });
  }
}


// POST Handler for creating a new school announcement
export async function POST(req: NextRequest) {
  console.log('[API_ANNOUNCEMENTS_POST] Received request to create announcement.');
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.role !== UserRole.SCHOOL_ADMIN) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
    }
    const schoolAdminUserId = session.user.id; // This is User.id

    const adminSchoolLink = await prisma.schoolAdmin.findFirst({
      where: { userId: schoolAdminUserId }, // Find the SchoolAdmin record
      select: { schoolId: true, id: true } // Select schoolId AND the id of the SchoolAdmin record itself
    });

    if (!adminSchoolLink?.schoolId || !adminSchoolLink?.id) {
      return NextResponse.json({ message: 'Admin profile or associated school not found.' }, { status: 400 });
    }
    const schoolId = adminSchoolLink.schoolId;
    const schoolAdminRecordId = adminSchoolLink.id; // This is SchoolAdmin.id

    const body = await req.json();
    console.log("[API_ANNOUNCEMENTS_POST] Received body:", JSON.stringify(body, null, 2));
    
    const validation = createAnnouncementApiSchema.safeParse(body);
    if (!validation.success) {
      console.error("[API_ANNOUNCEMENTS_POST] Zod validation failed:", JSON.stringify(validation.error.flatten().fieldErrors, null, 2));
      return NextResponse.json({ message: 'Invalid input', errors: validation.error.flatten().fieldErrors }, { status: 400 });
    }
    
    const { title, content, publishDate, expiryDate, audience, isPublished } = validation.data;

    const newAnnouncement = await prisma.schoolAnnouncement.create({
      data: {
        schoolId,
        title,
        content,
        publishDate: publishDate ? new Date(publishDate) : new Date(), // Default to now if not specified
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        audience: audience || "ALL", // Default audience to ALL if not specified
        isPublished: isPublished !== undefined ? isPublished : true, // Default to true if not specified
        createdByAdminId: schoolAdminRecordId, // Link to the SchoolAdmin record ID
      },
      include: {
        createdByAdmin: {
          select: { user: { select: { firstName: true, lastName: true }}}
        }
      }
    });

    console.log(`[API_ANNOUNCEMENTS_POST] Announcement "${newAnnouncement.title}" created successfully for school ${schoolId}`);
    return NextResponse.json(newAnnouncement, { status: 201 });

  } catch (error) {
    console.error('[API_ANNOUNCEMENTS_POST] An error occurred:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // Handle specific Prisma errors if needed, e.g., P2002 for unique constraints if any apply
      return NextResponse.json({ message: `Database error occurred: ${error.message}` }, { status: 500 });
    }
    if (error instanceof z.ZodError) { // Should be caught by safeParse earlier
        return NextResponse.json({ message: 'Invalid input (Zod final check)', errors: error.errors }, { status: 400 });
    }
    return NextResponse.json({ message: 'An unexpected error occurred while creating the announcement.' }, { status: 500 });
  }
}