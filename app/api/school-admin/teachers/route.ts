// app/api/school-admin/teachers/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/lib/db';
import { UserRole, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

// Zod schema for creating/validating a new teacher (API side)
const createTeacherApiSchema = z.object({
  email: z.string().email("Invalid email address."),
  firstName: z.string().min(1, "First name is required."),
  lastName: z.string().min(1, "Last name is required."),
  password: z.string().min(6, "Password must be at least 6 characters."),
  phoneNumber: z.string().optional().or(z.literal('')).nullable(),
  dateOfJoining: z.string().optional().refine(val => !val || !isNaN(Date.parse(val)), {
    message: "Invalid date format for date of joining (YYYY-MM-DD or ISO string expected if provided)",
  }).or(z.literal('')).nullable(), // Client sends ISO string or undefined
  qualifications: z.string().optional().or(z.literal('')).nullable(),
  specialization: z.string().optional().or(z.literal('')).nullable(),
  teacherIdNumber: z.string().optional().or(z.literal('')).nullable(),
  profilePicture: z.string().url("Profile picture must be a valid URL if provided.").optional().or(z.literal('')).nullable(),
});

// GET Handler: List teachers for the School Admin's school
export async function GET(req: NextRequest) {
  // console.log('[API_TEACHERS_GET] Received request to fetch teachers.');
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized: Not logged in' }, { status: 401 });
    }
    if (session.user.role !== UserRole.SCHOOL_ADMIN) {
      return NextResponse.json({ message: 'Forbidden: Insufficient privileges' }, { status: 403 });
    }
    const schoolAdminUserId = session.user.id;

    const adminSchoolLink = await prisma.schoolAdmin.findFirst({
        where: { userId: schoolAdminUserId },
        select: { schoolId: true }
    });

    if (!adminSchoolLink?.schoolId) {
      return NextResponse.json({ message: 'No school associated with your account or school not found.' }, { status: 404 });
    }
    const schoolId = adminSchoolLink.schoolId;

    const teachers = await prisma.teacher.findMany({
      where: { schoolId: schoolId },
      include: {
        user: { 
          select: { id: true, firstName: true, lastName: true, email: true, isActive: true, profilePicture: true, phoneNumber: true },
        },
      },
      orderBy: [ { user: { lastName: 'asc' } }, { user: { firstName: 'asc' } } ],
    });
    return NextResponse.json(teachers, { status: 200 });

  } catch (error) {
    console.error('[API_TEACHERS_GET] An error occurred:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
        return NextResponse.json({ message: `Database error: ${error.message}` }, { status: 500 });
    }
    return NextResponse.json({ message: 'An unexpected error occurred while fetching teachers.' }, { status: 500 });
  }
}

// POST Handler: Create a new teacher for the School Admin's school
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
    
    const validation = createTeacherApiSchema.safeParse(body); // Use the API-specific schema
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
      // If user exists, we'll link them. Consider User.role implications if it's not already TEACHER.
      console.log(`User with email ${email} already exists. Linking as teacher to school ${schoolId}.`);
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
        userId: user.id,
        schoolId: schoolId,
        dateOfJoining: dateOfJoining ? new Date(dateOfJoining) : null, // dateOfJoining from API is string (ISO)
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

  } catch (error) {
    console.error('[API_TEACHERS_POST] An error occurred:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') { // Unique constraint failed
        return NextResponse.json({ message: `A record with one of the provided unique fields (e.g., email, teacher ID) already exists. ${error.meta?.target ? `Constraint: ${(error.meta.target as string[]).join(', ')}` : ''}` }, { status: 409 });
      }
      return NextResponse.json({ message: `Database error occurred: ${error.message}` }, { status: 500 });
    }
    if (error instanceof z.ZodError) {
        return NextResponse.json({ message: 'Invalid input (Zod final check)', errors: error.errors }, { status: 400 });
    }
    return NextResponse.json({ message: 'An unexpected error occurred while creating the teacher.' }, { status: 500 });
  }
}