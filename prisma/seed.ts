// prisma/seed.ts
import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

// Initialize Prisma Client
const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding ...');

  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'superadmin@example.com';
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || 'superadmin123'; // Change this in production or use a strong env variable
  const superAdminFirstName = 'Super';
  const superAdminLastName = 'Admin';

  if (!superAdminPassword) {
    console.error('SUPER_ADMIN_PASSWORD environment variable is not set. Seeding cannot proceed.');
    process.exit(1);
  }

  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(superAdminPassword, saltRounds);

  // Check if Super Admin already exists
  const existingSuperAdmin = await prisma.user.findUnique({
    where: { email: superAdminEmail },
  });

  if (existingSuperAdmin) {
    console.log(`User with email ${superAdminEmail} already exists. Skipping Super Admin creation.`);
  } else {
    try {
      const superAdminUser = await prisma.user.create({
        data: {
          email: superAdminEmail,
          hashedPassword: hashedPassword,
          firstName: superAdminFirstName,
          lastName: superAdminLastName,
          role: UserRole.SUPER_ADMIN, // Make sure UserRole enum is correctly imported or defined
          isActive: true,
          superAdmin: {
            create: {}, // This creates the linked SuperAdmin profile
          },
        },
        include: {
          superAdmin: true, // Include the created SuperAdmin profile in the result
        },
      });
      console.log(`Created Super Admin user: ${superAdminUser.email} with ID: ${superAdminUser.id}`);
      if (superAdminUser.superAdmin) {
        console.log(`Linked SuperAdmin profile ID: ${superAdminUser.superAdmin.id}`);
      }
    } catch (error) {
      console.error('Error creating Super Admin:', error);
      process.exit(1); // Exit with error code
    }
  }

  // You can add more seed data here for other models if needed later

  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });