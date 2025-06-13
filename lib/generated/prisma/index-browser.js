
/* !!! This is code generated by Prisma. Do not edit directly. !!!
/* eslint-disable */

Object.defineProperty(exports, "__esModule", { value: true });

const {
  Decimal,
  objectEnumValues,
  makeStrictEnum,
  Public,
  getRuntime,
  skip
} = require('./runtime/index-browser.js')


const Prisma = {}

exports.Prisma = Prisma
exports.$Enums = {}

/**
 * Prisma Client JS version: 6.8.2
 * Query Engine version: 2060c79ba17c6bb9f5823312b6f6b7f4a845738e
 */
Prisma.prismaVersion = {
  client: "6.8.2",
  engine: "2060c79ba17c6bb9f5823312b6f6b7f4a845738e"
}

Prisma.PrismaClientKnownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientKnownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)};
Prisma.PrismaClientUnknownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientUnknownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientRustPanicError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientRustPanicError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientInitializationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientInitializationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientValidationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientValidationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`sqltag is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.empty = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`empty is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.join = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`join is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.raw = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`raw is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.validator = Public.validator

/**
* Extensions
*/
Prisma.getExtensionContext = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.getExtensionContext is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.defineExtension = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.defineExtension is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}

/**
 * Shorthand utilities for JSON filtering
 */
Prisma.DbNull = objectEnumValues.instances.DbNull
Prisma.JsonNull = objectEnumValues.instances.JsonNull
Prisma.AnyNull = objectEnumValues.instances.AnyNull

Prisma.NullTypes = {
  DbNull: objectEnumValues.classes.DbNull,
  JsonNull: objectEnumValues.classes.JsonNull,
  AnyNull: objectEnumValues.classes.AnyNull
}



/**
 * Enums
 */

exports.Prisma.TransactionIsolationLevel = makeStrictEnum({
  ReadUncommitted: 'ReadUncommitted',
  ReadCommitted: 'ReadCommitted',
  RepeatableRead: 'RepeatableRead',
  Serializable: 'Serializable'
});

exports.Prisma.UserScalarFieldEnum = {
  id: 'id',
  email: 'email',
  hashedPassword: 'hashedPassword',
  firstName: 'firstName',
  lastName: 'lastName',
  phoneNumber: 'phoneNumber',
  profilePicture: 'profilePicture',
  isActive: 'isActive',
  role: 'role',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AccountScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  type: 'type',
  provider: 'provider',
  providerAccountId: 'providerAccountId',
  refresh_token: 'refresh_token',
  access_token: 'access_token',
  expires_at: 'expires_at',
  token_type: 'token_type',
  scope: 'scope',
  id_token: 'id_token',
  session_state: 'session_state',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.SessionScalarFieldEnum = {
  id: 'id',
  sessionToken: 'sessionToken',
  userId: 'userId',
  expires: 'expires',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.VerificationTokenScalarFieldEnum = {
  id: 'id',
  identifier: 'identifier',
  token: 'token',
  expires: 'expires',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.SuperAdminScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.SchoolScalarFieldEnum = {
  id: 'id',
  name: 'name',
  address: 'address',
  city: 'city',
  stateOrRegion: 'stateOrRegion',
  country: 'country',
  postalCode: 'postalCode',
  phoneNumber: 'phoneNumber',
  schoolEmail: 'schoolEmail',
  website: 'website',
  logoUrl: 'logoUrl',
  currentAcademicYear: 'currentAcademicYear',
  currentTerm: 'currentTerm',
  currency: 'currency',
  timezone: 'timezone',
  isActive: 'isActive',
  createdBySuperAdminId: 'createdBySuperAdminId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.SchoolAdminScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  schoolId: 'schoolId',
  jobTitle: 'jobTitle',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.TeacherScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  schoolId: 'schoolId',
  teacherIdNumber: 'teacherIdNumber',
  dateOfJoining: 'dateOfJoining',
  qualifications: 'qualifications',
  specialization: 'specialization',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.StudentScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  schoolId: 'schoolId',
  studentIdNumber: 'studentIdNumber',
  firstName: 'firstName',
  lastName: 'lastName',
  middleName: 'middleName',
  dateOfBirth: 'dateOfBirth',
  gender: 'gender',
  enrollmentDate: 'enrollmentDate',
  profilePictureUrl: 'profilePictureUrl',
  address: 'address',
  city: 'city',
  stateOrRegion: 'stateOrRegion',
  country: 'country',
  postalCode: 'postalCode',
  emergencyContactName: 'emergencyContactName',
  emergencyContactPhone: 'emergencyContactPhone',
  bloodGroup: 'bloodGroup',
  allergies: 'allergies',
  medicalNotes: 'medicalNotes',
  isActive: 'isActive',
  currentClassId: 'currentClassId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ParentScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  occupation: 'occupation',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.StudentParentLinkScalarFieldEnum = {
  id: 'id',
  studentId: 'studentId',
  parentId: 'parentId',
  relationshipToStudent: 'relationshipToStudent',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ClassScalarFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  name: 'name',
  section: 'section',
  academicYear: 'academicYear',
  homeroomTeacherId: 'homeroomTeacherId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.StudentClassEnrollmentScalarFieldEnum = {
  id: 'id',
  studentId: 'studentId',
  classId: 'classId',
  academicYear: 'academicYear',
  enrollmentDate: 'enrollmentDate',
  isCurrent: 'isCurrent',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.SubjectScalarFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  name: 'name',
  code: 'code',
  description: 'description',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.TimetableSlotScalarFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  classId: 'classId',
  subjectId: 'subjectId',
  teacherId: 'teacherId',
  dayOfWeek: 'dayOfWeek',
  startTime: 'startTime',
  endTime: 'endTime',
  room: 'room',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.StudentAttendanceScalarFieldEnum = {
  id: 'id',
  studentId: 'studentId',
  date: 'date',
  status: 'status',
  remarks: 'remarks',
  academicYear: 'academicYear',
  term: 'term',
  classId: 'classId',
  subjectId: 'subjectId',
  timetableSlotId: 'timetableSlotId',
  recordedById: 'recordedById',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AssignmentScalarFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  classId: 'classId',
  subjectId: 'subjectId',
  teacherId: 'teacherId',
  title: 'title',
  description: 'description',
  maxPoints: 'maxPoints',
  dueDate: 'dueDate',
  academicYear: 'academicYear',
  term: 'term',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.StudentGradeScalarFieldEnum = {
  id: 'id',
  studentId: 'studentId',
  subjectId: 'subjectId',
  assignmentId: 'assignmentId',
  teacherId: 'teacherId',
  grade: 'grade',
  numericValue: 'numericValue',
  comments: 'comments',
  academicYear: 'academicYear',
  term: 'term',
  dateRecorded: 'dateRecorded',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.FeeStructureScalarFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  name: 'name',
  description: 'description',
  amount: 'amount',
  academicYear: 'academicYear',
  term: 'term',
  frequency: 'frequency',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.InvoiceScalarFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  studentId: 'studentId',
  parentToBillId: 'parentToBillId',
  invoiceNumber: 'invoiceNumber',
  issueDate: 'issueDate',
  dueDate: 'dueDate',
  totalAmount: 'totalAmount',
  paidAmount: 'paidAmount',
  status: 'status',
  notes: 'notes',
  academicYear: 'academicYear',
  term: 'term',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.InvoiceLineItemScalarFieldEnum = {
  id: 'id',
  invoiceId: 'invoiceId',
  feeStructureId: 'feeStructureId',
  studentId: 'studentId',
  description: 'description',
  quantity: 'quantity',
  unitPrice: 'unitPrice',
  amount: 'amount',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PaymentScalarFieldEnum = {
  id: 'id',
  invoiceId: 'invoiceId',
  paymentDate: 'paymentDate',
  amount: 'amount',
  paymentMethod: 'paymentMethod',
  reference: 'reference',
  notes: 'notes',
  recordedById: 'recordedById',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.SchoolAnnouncementScalarFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  title: 'title',
  content: 'content',
  publishDate: 'publishDate',
  expiryDate: 'expiryDate',
  audience: 'audience',
  isPublished: 'isPublished',
  createdByAdminId: 'createdByAdminId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ClassAnnouncementScalarFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  classId: 'classId',
  title: 'title',
  content: 'content',
  publishDate: 'publishDate',
  isPublished: 'isPublished',
  createdByTeacherId: 'createdByTeacherId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.SortOrder = {
  asc: 'asc',
  desc: 'desc'
};

exports.Prisma.NullsOrder = {
  first: 'first',
  last: 'last'
};

exports.Prisma.UserOrderByRelevanceFieldEnum = {
  id: 'id',
  email: 'email',
  hashedPassword: 'hashedPassword',
  firstName: 'firstName',
  lastName: 'lastName',
  phoneNumber: 'phoneNumber',
  profilePicture: 'profilePicture'
};

exports.Prisma.AccountOrderByRelevanceFieldEnum = {
  id: 'id',
  userId: 'userId',
  type: 'type',
  provider: 'provider',
  providerAccountId: 'providerAccountId',
  refresh_token: 'refresh_token',
  access_token: 'access_token',
  token_type: 'token_type',
  scope: 'scope',
  id_token: 'id_token',
  session_state: 'session_state'
};

exports.Prisma.SessionOrderByRelevanceFieldEnum = {
  id: 'id',
  sessionToken: 'sessionToken',
  userId: 'userId'
};

exports.Prisma.VerificationTokenOrderByRelevanceFieldEnum = {
  id: 'id',
  identifier: 'identifier',
  token: 'token'
};

exports.Prisma.SuperAdminOrderByRelevanceFieldEnum = {
  id: 'id',
  userId: 'userId'
};

exports.Prisma.SchoolOrderByRelevanceFieldEnum = {
  id: 'id',
  name: 'name',
  address: 'address',
  city: 'city',
  stateOrRegion: 'stateOrRegion',
  country: 'country',
  postalCode: 'postalCode',
  phoneNumber: 'phoneNumber',
  schoolEmail: 'schoolEmail',
  website: 'website',
  logoUrl: 'logoUrl',
  currentAcademicYear: 'currentAcademicYear',
  currency: 'currency',
  timezone: 'timezone',
  createdBySuperAdminId: 'createdBySuperAdminId'
};

exports.Prisma.SchoolAdminOrderByRelevanceFieldEnum = {
  id: 'id',
  userId: 'userId',
  schoolId: 'schoolId',
  jobTitle: 'jobTitle'
};

exports.Prisma.TeacherOrderByRelevanceFieldEnum = {
  id: 'id',
  userId: 'userId',
  schoolId: 'schoolId',
  teacherIdNumber: 'teacherIdNumber',
  qualifications: 'qualifications',
  specialization: 'specialization'
};

exports.Prisma.StudentOrderByRelevanceFieldEnum = {
  id: 'id',
  userId: 'userId',
  schoolId: 'schoolId',
  studentIdNumber: 'studentIdNumber',
  firstName: 'firstName',
  lastName: 'lastName',
  middleName: 'middleName',
  profilePictureUrl: 'profilePictureUrl',
  address: 'address',
  city: 'city',
  stateOrRegion: 'stateOrRegion',
  country: 'country',
  postalCode: 'postalCode',
  emergencyContactName: 'emergencyContactName',
  emergencyContactPhone: 'emergencyContactPhone',
  bloodGroup: 'bloodGroup',
  allergies: 'allergies',
  medicalNotes: 'medicalNotes',
  currentClassId: 'currentClassId'
};

exports.Prisma.ParentOrderByRelevanceFieldEnum = {
  id: 'id',
  userId: 'userId',
  occupation: 'occupation'
};

exports.Prisma.StudentParentLinkOrderByRelevanceFieldEnum = {
  id: 'id',
  studentId: 'studentId',
  parentId: 'parentId',
  relationshipToStudent: 'relationshipToStudent'
};

exports.Prisma.ClassOrderByRelevanceFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  name: 'name',
  section: 'section',
  academicYear: 'academicYear',
  homeroomTeacherId: 'homeroomTeacherId'
};

exports.Prisma.StudentClassEnrollmentOrderByRelevanceFieldEnum = {
  id: 'id',
  studentId: 'studentId',
  classId: 'classId',
  academicYear: 'academicYear'
};

exports.Prisma.SubjectOrderByRelevanceFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  name: 'name',
  code: 'code',
  description: 'description'
};

exports.Prisma.TimetableSlotOrderByRelevanceFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  classId: 'classId',
  subjectId: 'subjectId',
  teacherId: 'teacherId',
  startTime: 'startTime',
  endTime: 'endTime',
  room: 'room'
};

exports.Prisma.StudentAttendanceOrderByRelevanceFieldEnum = {
  id: 'id',
  studentId: 'studentId',
  remarks: 'remarks',
  academicYear: 'academicYear',
  classId: 'classId',
  subjectId: 'subjectId',
  timetableSlotId: 'timetableSlotId',
  recordedById: 'recordedById'
};

exports.Prisma.AssignmentOrderByRelevanceFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  classId: 'classId',
  subjectId: 'subjectId',
  teacherId: 'teacherId',
  title: 'title',
  description: 'description',
  academicYear: 'academicYear'
};

exports.Prisma.StudentGradeOrderByRelevanceFieldEnum = {
  id: 'id',
  studentId: 'studentId',
  subjectId: 'subjectId',
  assignmentId: 'assignmentId',
  teacherId: 'teacherId',
  grade: 'grade',
  comments: 'comments',
  academicYear: 'academicYear'
};

exports.Prisma.FeeStructureOrderByRelevanceFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  name: 'name',
  description: 'description',
  academicYear: 'academicYear',
  frequency: 'frequency'
};

exports.Prisma.InvoiceOrderByRelevanceFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  studentId: 'studentId',
  parentToBillId: 'parentToBillId',
  invoiceNumber: 'invoiceNumber',
  notes: 'notes',
  academicYear: 'academicYear'
};

exports.Prisma.InvoiceLineItemOrderByRelevanceFieldEnum = {
  id: 'id',
  invoiceId: 'invoiceId',
  feeStructureId: 'feeStructureId',
  studentId: 'studentId',
  description: 'description'
};

exports.Prisma.PaymentOrderByRelevanceFieldEnum = {
  id: 'id',
  invoiceId: 'invoiceId',
  paymentMethod: 'paymentMethod',
  reference: 'reference',
  notes: 'notes',
  recordedById: 'recordedById'
};

exports.Prisma.SchoolAnnouncementOrderByRelevanceFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  title: 'title',
  content: 'content',
  audience: 'audience',
  createdByAdminId: 'createdByAdminId'
};

exports.Prisma.ClassAnnouncementOrderByRelevanceFieldEnum = {
  id: 'id',
  schoolId: 'schoolId',
  classId: 'classId',
  title: 'title',
  content: 'content',
  createdByTeacherId: 'createdByTeacherId'
};
exports.UserRole = exports.$Enums.UserRole = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  SCHOOL_ADMIN: 'SCHOOL_ADMIN',
  TEACHER: 'TEACHER',
  STUDENT: 'STUDENT',
  PARENT: 'PARENT'
};

exports.TermPeriod = exports.$Enums.TermPeriod = {
  FIRST_TERM: 'FIRST_TERM',
  SECOND_TERM: 'SECOND_TERM',
  THIRD_TERM: 'THIRD_TERM'
};

exports.Gender = exports.$Enums.Gender = {
  MALE: 'MALE',
  FEMALE: 'FEMALE',
  OTHER: 'OTHER',
  PREFER_NOT_TO_SAY: 'PREFER_NOT_TO_SAY'
};

exports.DayOfWeek = exports.$Enums.DayOfWeek = {
  MONDAY: 'MONDAY',
  TUESDAY: 'TUESDAY',
  WEDNESDAY: 'WEDNESDAY',
  THURSDAY: 'THURSDAY',
  FRIDAY: 'FRIDAY',
  SATURDAY: 'SATURDAY',
  SUNDAY: 'SUNDAY'
};

exports.AttendanceStatus = exports.$Enums.AttendanceStatus = {
  PRESENT: 'PRESENT',
  ABSENT: 'ABSENT',
  LATE: 'LATE',
  EXCUSED: 'EXCUSED'
};

exports.PaymentStatus = exports.$Enums.PaymentStatus = {
  PENDING: 'PENDING',
  PAID: 'PAID',
  PARTIALLY_PAID: 'PARTIALLY_PAID',
  OVERDUE: 'OVERDUE',
  CANCELLED: 'CANCELLED',
  REFUNDED: 'REFUNDED'
};

exports.Prisma.ModelName = {
  User: 'User',
  Account: 'Account',
  Session: 'Session',
  VerificationToken: 'VerificationToken',
  SuperAdmin: 'SuperAdmin',
  School: 'School',
  SchoolAdmin: 'SchoolAdmin',
  Teacher: 'Teacher',
  Student: 'Student',
  Parent: 'Parent',
  StudentParentLink: 'StudentParentLink',
  Class: 'Class',
  StudentClassEnrollment: 'StudentClassEnrollment',
  Subject: 'Subject',
  TimetableSlot: 'TimetableSlot',
  StudentAttendance: 'StudentAttendance',
  Assignment: 'Assignment',
  StudentGrade: 'StudentGrade',
  FeeStructure: 'FeeStructure',
  Invoice: 'Invoice',
  InvoiceLineItem: 'InvoiceLineItem',
  Payment: 'Payment',
  SchoolAnnouncement: 'SchoolAnnouncement',
  ClassAnnouncement: 'ClassAnnouncement'
};

/**
 * This is a stub Prisma Client that will error at runtime if called.
 */
class PrismaClient {
  constructor() {
    return new Proxy(this, {
      get(target, prop) {
        let message
        const runtime = getRuntime()
        if (runtime.isEdge) {
          message = `PrismaClient is not configured to run in ${runtime.prettyName}. In order to run Prisma Client on edge runtime, either:
- Use Prisma Accelerate: https://pris.ly/d/accelerate
- Use Driver Adapters: https://pris.ly/d/driver-adapters
`;
        } else {
          message = 'PrismaClient is unable to run in this browser environment, or has been bundled for the browser (running in `' + runtime.prettyName + '`).'
        }

        message += `
If this is unexpected, please open an issue: https://pris.ly/prisma-prisma-bug-report`

        throw new Error(message)
      }
    })
  }
}

exports.PrismaClient = PrismaClient

Object.assign(exports, Prisma)
