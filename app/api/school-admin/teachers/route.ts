// app/api/school-admin/teachers/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';// Adjust path as needed
import prisma from '@/lib/db'; // Using shared Prisma instance
import { UserRole, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

// Zod schema for creating a new teacher
const createTeacherSchema = z.object({
  email: z.string().email("Invalid email address."),
  firstName: z.string().min(1, "First name is required."),
  lastName: z.string().min(1, "Last name is required."),
  password: z.string().min(6, "Password must be at least 6 characters."),
  phoneNumber: z.string().optional().or(z.literal('')).nullable(),
  dateOfJoining: z.string().optional().refine(val => !val || !isNaN(Date.parse(val)), {
    message: "Invalid date format for date of joining (YYYY-MM-DD or ISO string expected if provided)",
  }).or(z.literal('')).nullable(),
  qualifications: z.string().optional().or(z.literal('')).nullable(),
  specialization: z.string().optional().or(z.literal('')).nullable(),
  teacherIdNumber: z.string().optional().or(z.literal('')).nullable(),
  profilePicture: z.string().url("Profile picture must be a valid URL if provided.").optional().or(z.literal('')).nullable(),
});

// GET Handler: List all teachers for the School Admin's school
export async function GET(req: NextRequest) {
  console.log('[API_TEACHERS_GET] Received request to fetch teachers.');
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      console.log('[API_TEACHERS_GET] No session user ID found. Unauthorized.');
      return NextResponse.json({ message: 'Unauthorized: Not logged in' }, { status: 401 });
    }
    if (session.user.role !== UserRole.SCHOOL_ADMIN) {
      console.log(`[API_TEACHERS_GET] User role is ${session.user.role}, not SCHOOL_ADMIN. Forbidden.`);
      return NextResponse.json({ message: 'Forbidden: Insufficient privileges' }, { status: 403 });
    }

    const schoolAdminUserId = session.user.id;
    // console.log(`[API_TEACHERS_GET] Authenticated School Admin User ID: ${schoolAdminUserId}`); // Can be verbose

    const adminSchoolLink = await prisma.schoolAdmin.findFirst({
        where: { userId: schoolAdminUserId },
        select: { schoolId: true }
    });

    if (!adminSchoolLink?.schoolId) {
      console.error(`[API_TEACHERS_GET] No school associated with School Admin ID: ${schoolAdminUserId}`);
      return NextResponse.json({ message: 'No school associated with your account or school not found.' }, { status: 404 });
    }

    const schoolId = adminSchoolLink.schoolId;
    // console.log(`[API_TEACHERS_GET] Determined School ID: ${schoolId} for Admin ID: ${schoolAdminUserId}`);

    const teachers = await prisma.teacher.findMany({
      where: {
        schoolId: schoolId,
      },
      include: {
        user: { 
          select: {
            id: true, firstName: true, lastName: true, email: true, isActive: true, profilePicture: true, phoneNumber: true,
          },
        },
      },
      orderBy: [
        { user: { lastName: 'asc' } },
        { user: { firstName: 'asc' } },
      ],
    });
    console.log(`[API_TEACHERS_GET] Found ${teachers.length} teachers for school ID: ${schoolId}`);
    return NextResponse.json(teachers, { status: 200 });

  } catch (error: any) {
    console.error('[API_TEACHERS_GET] An error occurred:', error.name, error.message);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
        console.error(`[API_TEACHERS_GET] Prisma Error Code: ${error.code}, Meta: ${JSON.stringify(error.meta)}`);
        return NextResponse.json({ message: `Database error: ${error.message}` }, { status: 500 });
    }
    return NextResponse.json({ message: 'An unexpected error occurred while fetching teachers.' }, { status: 500 });
  }
}


// POST Handler for creating a new teacher
export async function POST(req: NextRequest) {
  console.log('[API_TEACHERS_POST] Received request to create teacher.');
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
    console.log("[API_TEACHERS_POST] Received body:", JSON.stringify(body, null, 2));
    
    const validation = createTeacherSchema.safeParse(body);
    if (!validation.success) {
      console.error("[API_TEACHERS_POST] Zod validation failed:", JSON.stringify(validation.error.flatten().fieldErrors, null, 2));
      return NextResponse.json({ message: 'Invalid input', errors: validation.error.flatten().fieldErrors }, { status: 400 });
    }
    
    const { email, firstName, lastName, password, dateOfJoining, ...teacherDataInput } = validation.data;

    let user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      const existingTeacherLink = await prisma.teacher.findFirst({
        where: { userId: user.id, schoolId: schoolId }
      });
      if (existingTeacherLink) {
        return NextResponse.json({ message: `User with email ${email} is already a teacher at this school.` }, { status: 409 });
      }
      console.log(`User with email ${email} already exists. Linking as teacher to school ${schoolId}. Consider implications for User.role if it's not TEACHER.`);
      // Note: If user exists, their password is not updated here. Their existing User.role is also not changed.
    } else {
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      user = await prisma.user.create({
        data: {
          email,
          firstName,
          lastName,
          hashedPassword,
          role: UserRole.TEACHER, 
          isActive: true,
          phoneNumber: teacherDataInput.phoneNumber || null,
          profilePicture: teacherDataInput.profilePicture || null,
        },
      });
      console.log(`New user created for teacher: ${user.email}`);
    }

    const newTeacher = await prisma.teacher.create({
      data: {
        userId: user.id, // Connects to the existing or newly created user
        schoolId: schoolId, // Connects to the admin's school
        dateOfJoining: dateOfJoining ? new Date(dateOfJoining) : null,
        qualifications: teacherDataInput.qualifications || null,
        specialization: teacherDataInput.specialization || null,
        teacherIdNumber: teacherDataInput.teacherIdNumber || null,
      },
      include: { 
        user: {
          select: { id: true, firstName: true, lastName: true, email: true, isActive: true, profilePicture: true, phoneNumber: true }
        }
      }
    });

    console.log(`Teacher profile created for user ${user.email} at school ${schoolId}`);
    return NextResponse.json(newTeacher, { status: 201 });

  } catch (error: any) { // Ensure 'any' or 'unknown' for broader error catching
    console.error('[API_TEACHERS_POST] An error occurred:', error.name, error.message);
    if (error.stack) {
        console.error('[API_TEACHERS_POST] Error Stack:', error.stack);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      console.error(`[API_TEACHERS_POST] Prisma Error Code: ${error.code}, Meta: ${JSON.stringify(error.meta)}`);
      if (error.code === 'P2002') { // Unique constraint failed
        let fieldMessage = "one of the provided unique fields (e.g., email, teacher ID)";
        if (error.meta?.target) {
          if (Array.isArray(error.meta.target)) {
            fieldMessage = `combination: ${(error.meta.target as string[]).join(', ')}`;
          } else if (typeof error.meta.target === 'string') {
            fieldMessage = `field: ${error.meta.target}`;
          }
        }
        console.error(`[API_TEACHERS_POST] P2002 Unique Constraint Violation. Target fields from Prisma:`, error.meta?.target);
        return NextResponse.json({ message: `A record with the same ${fieldMessage} already exists.` }, { status: 409 });
      }
      return NextResponse.json({ message: `Database error occurred: ${error.message}` }, { status: 500 });
    }
    if (error instanceof z.ZodError) { 
        console.error("[API_TEACHERS_POST] Zod final catch block error:", JSON.stringify(error.errors, null, 2));
        return NextResponse.json({ message: 'Invalid input (Zod final check)', errors: error.errors }, { status: 400 });
    }
    return NextResponse.json({ message: 'An unexpected server error occurred while creating the teacher.' }, { status: 500 });
  }
}