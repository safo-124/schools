// app/api/school-admin/timetable/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import { UserRole, Prisma, DayOfWeek } from '@prisma/client';
import { z } from 'zod';

// Zod schema for creating a new timetable slot
const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/; // HH:MM format

const createTimetableSlotApiSchema = z.object({
  classId: z.string().cuid("Invalid Class ID."),
  subjectId: z.string().cuid("Invalid Subject ID."),
  teacherId: z.string().cuid("Invalid Teacher ID."),
  dayOfWeek: z.nativeEnum(DayOfWeek, { errorMap: () => ({ message: "Invalid day of the week."})}),
  startTime: z.string().regex(timeRegex, "Invalid start time format. Use HH:MM."),
  endTime: z.string().regex(timeRegex, "Invalid end time format. Use HH:MM."),
  room: z.string().optional().or(z.literal('')).nullable(),
}).refine(data => {
    // Basic time validation: endTime must be after startTime
    if (data.startTime && data.endTime) {
        const [startH, startM] = data.startTime.split(':').map(Number);
        const [endH, endM] = data.endTime.split(':').map(Number);
        return (endH > startH) || (endH === startH && endM > startM);
    }
    return true; // Pass if one is missing, individual regex will catch format
}, {
  message: "End time must be after start time.",
  path: ["endTime"], // Attach error to endTime field
});


// GET Handler: List all timetable slots for the School Admin's school
export async function GET(req: NextRequest) {
  console.log('[API_TIMETABLE_GET_ALL] Received request to fetch timetable slots.');
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
    console.log(`[API_TIMETABLE_GET_ALL] Fetching timetable for School ID: ${schoolId}`);

    const timetableSlots = await prisma.timetableSlot.findMany({
      where: { schoolId: schoolId },
      include: {
        class: { select: { id: true, name: true, section: true } },
        subject: { select: { id: true, name: true, code: true } },
        teacher: { select: { id: true, user: { select: { firstName: true, lastName: true, id: true } } } },
      },
      orderBy: [
        // Prisma doesn't allow ordering by enum directly in the same way for all DBs.
        // We'll order by dayOfWeek as string/int on client or fetch day by day.
        // For now, let's order by what's easily available.
        // A common approach is to have a numerical representation of DayOfWeek for sorting.
        // Our DayOfWeek enum is string based. Client-side sorting for day order might be needed,
        // or store dayOfWeek as an int (0-6) in DB.
        // For now, just by startTime.
        { startTime: 'asc' },
        // { dayOfWeek: 'asc' } // This will sort alphabetically by enum string name.
      ],
    });
    console.log(`[API_TIMETABLE_GET_ALL] Found ${timetableSlots.length} timetable slots for school ID: ${schoolId}`);
    return NextResponse.json(timetableSlots, { status: 200 });

  } catch (error) {
    console.error('[API_TIMETABLE_GET_ALL] An error occurred:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
        return NextResponse.json({ message: `Database error: ${error.message}` }, { status: 500 });
    }
    return NextResponse.json({ message: 'An unexpected error occurred while fetching timetable slots.' }, { status: 500 });
  }
}


// POST Handler for creating a new timetable slot
export async function POST(req: NextRequest) {
  console.log('[API_TIMETABLE_POST] Received request to create timetable slot.');
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

    const body = await req.json();
    console.log("[API_TIMETABLE_POST] Received body:", JSON.stringify(body, null, 2));
    
    const validation = createTimetableSlotApiSchema.safeParse(body);
    if (!validation.success) {
      console.error("[API_TIMETABLE_POST] Zod validation failed:", JSON.stringify(validation.error.flatten().fieldErrors, null, 2));
      return NextResponse.json({ message: 'Invalid input', errors: validation.error.flatten().fieldErrors }, { status: 400 });
    }
    
    const { classId, subjectId, teacherId, dayOfWeek, startTime, endTime, room } = validation.data;

    // Validate that class, subject, and teacher belong to the admin's school
    const [classExists, subjectExists, teacherExists] = await Promise.all([
        prisma.class.findFirst({ where: { id: classId, schoolId } }),
        prisma.subject.findFirst({ where: { id: subjectId, schoolId } }),
        prisma.teacher.findFirst({ where: { id: teacherId, schoolId } })
    ]);

    if (!classExists) return NextResponse.json({ message: `Class with ID ${classId} not found in your school.`}, { status: 400 });
    if (!subjectExists) return NextResponse.json({ message: `Subject with ID ${subjectId} not found in your school.`}, { status: 400 });
    if (!teacherExists) return NextResponse.json({ message: `Teacher with ID ${teacherId} not found in your school.`}, { status: 400 });

    // Basic Clash Detection:
    // 1. Teacher Clash: Is this teacher already assigned at this day/time?
    const teacherClash = await prisma.timetableSlot.findFirst({
        where: {
            teacherId,
            dayOfWeek,
            schoolId, // Ensure clash detection is within the same school
            OR: [ // Overlapping time condition
                { startTime: { lt: endTime }, endTime: { gt: startTime } }
            ]
        }
    });
    if (teacherClash) {
        return NextResponse.json({ message: `Teacher is already assigned to another class at this time on ${dayOfWeek}.` }, { status: 409 });
    }

    // 2. Class Clash: Is this class already assigned a subject/teacher at this day/time?
    const classClash = await prisma.timetableSlot.findFirst({
        where: {
            classId,
            dayOfWeek,
            schoolId,
            OR: [
                { startTime: { lt: endTime }, endTime: { gt: startTime } }
            ]
        }
    });
    if (classClash) {
        return NextResponse.json({ message: `This class is already scheduled for another subject/teacher at this time on ${dayOfWeek}.` }, { status: 409 });
    }
    
    // 3. Room Clash (if room is provided): Is this room already booked at this day/time?
    if (room) {
        const roomClash = await prisma.timetableSlot.findFirst({
            where: {
                room,
                dayOfWeek,
                schoolId,
                OR: [
                    { startTime: { lt: endTime }, endTime: { gt: startTime } }
                ]
            }
        });
        if (roomClash) {
            return NextResponse.json({ message: `Room "${room}" is already booked at this time on ${dayOfWeek}.` }, { status: 409 });
        }
    }

    const newTimetableSlot = await prisma.timetableSlot.create({
      data: {
        schoolId,
        classId,
        subjectId,
        teacherId,
        dayOfWeek,
        startTime,
        endTime,
        room: room || null,
      },
      include: { // Include details for confirmation
        class: { select: { name: true, section: true } },
        subject: { select: { name: true } },
        teacher: { select: { user: { select: { firstName: true, lastName: true } } } }
      }
    });

    console.log(`[API_TIMETABLE_POST] Timetable slot created successfully for school ${schoolId}`);
    return NextResponse.json(newTimetableSlot, { status: 201 });

  } catch (error) {
    console.error('[API_TIMETABLE_POST] An error occurred:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // P2003 can happen if classId, subjectId, or teacherId are invalid despite earlier checks (e.g., deleted between check and create)
      if (error.code === 'P2003') {
        return NextResponse.json({ message: `Database constraint violation: Invalid Class, Subject, or Teacher ID provided. Field: ${error.meta?.field_name}` }, { status: 400 });
      }
      return NextResponse.json({ message: `Database error occurred: ${error.message}` }, { status: 500 });
    }
    if (error instanceof z.ZodError) {
        return NextResponse.json({ message: 'Invalid input (Zod final check)', errors: error.errors }, { status: 400 });
    }
    return NextResponse.json({ message: 'An unexpected error occurred while creating the timetable slot.' }, { status: 500 });
  }
}