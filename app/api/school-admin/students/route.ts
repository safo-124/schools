// app/api/school-admin/students/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/lib/db';
import { UserRole, Prisma, Gender } from '@prisma/client'; // Added Gender
import { z } from 'zod';

// Zod schema for creating a new student (API side)
const createStudentApiSchema = z.object({
  // Student model fields
  firstName: z.string().min(1, "First name is required."),
  lastName: z.string().min(1, "Last name is required."),
  studentIdNumber: z.string().min(1, "Student ID number is required."), // Should be unique within the school
  dateOfBirth: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid date of birth" }), // Expecting ISO string
  gender: z.nativeEnum(Gender),
  enrollmentDate: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid enrollment date" }).optional(), // Expecting ISO string
  
  currentClassId: z.string().cuid("Invalid class ID format.").optional().nullable(),

  // Optional Student fields
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
  isActive: z.boolean().optional().default(true), // Student enrollment status

  // Optional: Fields for creating a linked User account for the student
  // createUserAccount: z.boolean().optional(),
  // email: z.string().email().optional(), // Required if createUserAccount is true
  // password: z.string().min(6).optional(), // Required if createUserAccount is true
});


// GET Handler (from previous step)
export async function GET(req: NextRequest) {
  // console.log('[API_STUDENTS_GET] Received request to fetch students.');
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

    const students = await prisma.student.findMany({
      where: { schoolId: schoolId },
      include: {
        user: { 
          select: { email: true, isActive: true, profilePicture: true },
        },
        currentClass: { 
            select: { id: true, name: true, section: true }
        },
      },
      orderBy: [ { lastName: 'asc' }, { firstName: 'asc' } ],
    });
    return NextResponse.json(students, { status: 200 });
  } catch (error) {
    console.error('[API_STUDENTS_GET] An error occurred:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
        return NextResponse.json({ message: `Database error: ${error.message}` }, { status: 500 });
    }
    return NextResponse.json({ message: 'An unexpected error occurred while fetching students.' }, { status: 500 });
  }
}

// POST Handler for creating a new student
export async function POST(req: NextRequest) {
  console.log('[API_STUDENTS_POST] Received request to create student.');
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

    // 3. Parse and Validate Request Body
    const body = await req.json();
    console.log("[API_STUDENTS_POST] Received body:", JSON.stringify(body, null, 2));
    
    const validation = createStudentApiSchema.safeParse(body);
    if (!validation.success) {
      console.error("[API_STUDENTS_POST] Zod validation failed:", JSON.stringify(validation.error.flatten().fieldErrors, null, 2));
      return NextResponse.json({ message: 'Invalid input', errors: validation.error.flatten().fieldErrors }, { status: 400 });
    }
    
    const { 
        firstName, lastName, studentIdNumber, dateOfBirth, gender, enrollmentDate,
        currentClassId, ...optionalStudentData 
    } = validation.data;

    // Ensure studentIdNumber is unique within the school
    const existingStudentById = await prisma.student.findUnique({
        where: { schoolId_studentIdNumber: { schoolId, studentIdNumber } }
    });
    if (existingStudentById) {
        return NextResponse.json({ message: `Student with ID Number ${studentIdNumber} already exists in this school.` }, { status: 409 });
    }
    
    // For now, we are not creating a linked User account automatically. Student.userId will be null.
    // This can be an enhancement later.

    // 4. Create Student record
    const newStudent = await prisma.student.create({
      data: {
        schoolId,
        firstName,
        lastName,
        studentIdNumber,
        dateOfBirth: new Date(dateOfBirth), // Convert ISO string to Date
        gender,
        enrollmentDate: enrollmentDate ? new Date(enrollmentDate) : new Date(), // Default to now if not provided
        currentClassId: currentClassId || null, // Link to class if ID is provided
        
        // Spread optional fields, ensuring null if they were empty strings or null
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
        // userId: linkedUser?.id // If/when creating linked user account
      },
      include: { // Include details in the response for confirmation
        currentClass: { select: { name: true, section: true } }
      }
    });

    console.log(`[API_STUDENTS_POST] Student ${newStudent.firstName} ${newStudent.lastName} created successfully for school ${schoolId}`);
    return NextResponse.json(newStudent, { status: 201 });

  } catch (error) {
    console.error('[API_STUDENTS_POST] An error occurred:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') { // Unique constraint failed
        // This could be on studentIdNumber if somehow the earlier check missed it (race condition, unlikely)
        // or another unique field if you add one to Student model
        return NextResponse.json({ message: `A student with similar unique details (e.g., ID number) already exists. ${error.meta?.target ? `Constraint: ${(error.meta.target as string[]).join(', ')}` : ''}` }, { status: 409 });
      }
      if (error.code === 'P2003' && error.meta?.field_name === 'Student_currentClassId_fkey (index)') {
         return NextResponse.json({ message: 'Invalid Class ID provided. The selected class does not exist.' }, { status: 400 });
      }
      return NextResponse.json({ message: `Database error occurred: ${error.message}` }, { status: 500 });
    }
    if (error instanceof z.ZodError) { // Should be caught by safeParse earlier
        return NextResponse.json({ message: 'Invalid input (Zod final check)', errors: error.errors }, { status: 400 });
    }
    return NextResponse.json({ message: 'An unexpected error occurred while creating the student.' }, { status: 500 });
  }
}