// app/api/school-admin/students/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route'; // Adjust path as needed
import prisma from '@/lib/db'; // Using shared Prisma instance
import { UserRole, Prisma, Gender } from '@prisma/client';
import { z } from 'zod';

// Zod schema for creating a new student (API side - from previous step)
const createStudentApiSchema = z.object({
  firstName: z.string().min(1, "First name is required."),
  lastName: z.string().min(1, "Last name is required."),
  studentIdNumber: z.string().min(1, "Student ID number is required."),
  dateOfBirth: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid date of birth" }), // Expecting ISO string
  gender: z.nativeEnum(Gender),
  enrollmentDate: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid enrollment date" }).optional(), // Expecting ISO string
  currentClassId: z.string().cuid("Invalid class ID format.").optional().nullable(),
  middleName: z.string().optional().or(z.literal('')).nullable(),
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
  isActive: z.boolean().optional().default(true),
});

// GET Handler: List students for the School Admin's school
export async function GET(req: NextRequest) {
  console.log('[API_STUDENTS_GET] Received request to fetch students.');
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      console.log('[API_STUDENTS_GET] No session user ID found. Unauthorized.');
      return NextResponse.json({ message: 'Unauthorized: Not logged in' }, { status: 401 });
    }
    if (session.user.role !== UserRole.SCHOOL_ADMIN) {
      console.log(`[API_STUDENTS_GET] User role is ${session.user.role}, not SCHOOL_ADMIN. Forbidden.`);
      return NextResponse.json({ message: 'Forbidden: Insufficient privileges' }, { status: 403 });
    }

    const schoolAdminUserId = session.user.id;
    // console.log(`[API_STUDENTS_GET] Authenticated School Admin User ID: ${schoolAdminUserId}`);

    const adminSchoolLink = await prisma.schoolAdmin.findFirst({
        where: { userId: schoolAdminUserId },
        select: { schoolId: true }
    });

    if (!adminSchoolLink?.schoolId) {
      console.error(`[API_STUDENTS_GET] No school associated with School Admin ID: ${schoolAdminUserId}`);
      return NextResponse.json({ message: 'No school associated with your account or school not found.' }, { status: 404 });
    }
    const schoolId = adminSchoolLink.schoolId;

    const url = new URL(req.url);
    const activeOnly = url.searchParams.get('activeOnly') === 'true';
    
    console.log(`[API_STUDENTS_GET] Fetching students for School ID: ${schoolId}. Active only: ${activeOnly}`);

    const whereClause: Prisma.StudentWhereInput = { schoolId };
    if (activeOnly) {
      whereClause.isActive = true; // Filter for active students (on the Student model)
    }

    const students = await prisma.student.findMany({
      where: whereClause,
      include: {
        user: { 
          select: { email: true, isActive: true, profilePicture: true },
        },
        currentClass: { 
            select: { id: true, name: true, section: true }
        },
      },
      orderBy: [
        { lastName: 'asc' },
        { firstName: 'asc' },
      ],
    });
    console.log(`[API_STUDENTS_GET] Found ${students.length} students.`);
    return NextResponse.json(students, { status: 200 });

  } catch (error: any) {
    console.error('[API_STUDENTS_GET] An error occurred:', error.name, error.message);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
        console.error(`[API_STUDENTS_GET] Prisma Error Code: ${error.code}, Meta: ${JSON.stringify(error.meta)}`);
        return NextResponse.json({ message: `Database error: ${error.message}` }, { status: 500 });
    }
    return NextResponse.json({ message: 'An unexpected error occurred while fetching students.' }, { status: 500 });
  }
}

// POST Handler for creating a new student (from previous step)
export async function POST(req: NextRequest) {
  console.log('[API_STUDENTS_POST] Received request to create student.');
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
    // console.log("[API_STUDENTS_POST] Received body:", JSON.stringify(body, null, 2));
    
    const validation = createStudentApiSchema.safeParse(body);
    if (!validation.success) {
      console.error("[API_STUDENTS_POST] Zod validation failed:", JSON.stringify(validation.error.flatten().fieldErrors, null, 2));
      return NextResponse.json({ message: 'Invalid input', errors: validation.error.flatten().fieldErrors }, { status: 400 });
    }
    
    const { 
        firstName, lastName, studentIdNumber, dateOfBirth, gender, enrollmentDate,
        currentClassId, ...optionalStudentData 
    } = validation.data;

    const existingStudentById = await prisma.student.findUnique({
        where: { schoolId_studentIdNumber: { schoolId, studentIdNumber } }
    });
    if (existingStudentById) {
        return NextResponse.json({ message: `Student with ID Number ${studentIdNumber} already exists in this school.` }, { status: 409 });
    }
    
    const newStudent = await prisma.student.create({
      data: {
        schoolId,
        firstName,
        lastName,
        studentIdNumber,
        dateOfBirth: new Date(dateOfBirth),
        gender,
        enrollmentDate: enrollmentDate ? new Date(enrollmentDate) : new Date(),
        currentClassId: currentClassId || null,
        middleName: optionalStudentData.middleName || null,
        address: optionalStudentData.address || null,
        city: optionalStudentData.city || null,
        stateOrRegion: optionalStudentData.stateOrRegion || null,
        country: optionalStudentData.country || null,
        postalCode: optionalStudentData.postalCode || null,
        emergencyContactName: optionalStudentData.emergencyContactName || null,
        emergencyContactPhone: optionalStudentData.emergencyContactPhone || null,
        bloodGroup: optionalStudentData.bloodGroup || null,
        allergies: optionalStudentData.allergies || null,
        medicalNotes: optionalStudentData.medicalNotes || null,
        profilePictureUrl: optionalStudentData.profilePictureUrl || null,
        isActive: optionalStudentData.isActive !== undefined ? optionalStudentData.isActive : true,
      },
      include: { 
        currentClass: { select: { name: true, section: true } }
      }
    });

    console.log(`[API_STUDENTS_POST] Student ${newStudent.firstName} ${newStudent.lastName} created successfully for school ${schoolId}`);
    return NextResponse.json(newStudent, { status: 201 });

  } catch (error: any) {
    console.error('[API_STUDENTS_POST] An error occurred:', error.name, error.message);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') { 
        return NextResponse.json({ message: `A student with similar unique details (e.g., ID number) already exists. ${error.meta?.target ? `Constraint: ${(error.meta.target as string[]).join(', ')}` : ''}` }, { status: 409 });
      }
      if (error.code === 'P2003' && error.meta?.field_name === 'Student_currentClassId_fkey (index)') {
         return NextResponse.json({ message: 'Invalid Class ID provided. The selected class does not exist.' }, { status: 400 });
      }
      return NextResponse.json({ message: `Database error occurred: ${error.message}` }, { status: 500 });
    }
    if (error instanceof z.ZodError) {
        return NextResponse.json({ message: 'Invalid input (Zod final check)', errors: error.errors }, { status: 400 });
    }
    return NextResponse.json({ message: 'An unexpected error occurred while creating the student.' }, { status: 500 });
  }
}