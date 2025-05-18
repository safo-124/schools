// components/super-admin/EditSchoolButton.tsx
import Link from 'next/link';
import { Button, ButtonProps } from '@/components/ui/button'; // Import ButtonProps if you want to pass other button props
import { Edit3 } from 'lucide-react';

interface EditSchoolButtonProps {
  schoolId: string;
  variant?: ButtonProps['variant']; // Allow passing button variant
  size?: ButtonProps['size'];       // Allow passing button size
  children?: React.ReactNode;       // Allow custom text/icon
  className?: string;
}

export function EditSchoolButton({ 
  schoolId, 
  variant = "outline", // Default variant
  size = "sm",         // Default size
  children,
  className 
}: EditSchoolButtonProps) {
  return (
    <Button variant={variant} size={size} asChild className={className}>
      <Link href={`/super-admin/schools/${schoolId}/edit`}>
        {children || ( // Default content if no children are provided
          <>
            <Edit3 className="mr-2 h-4 w-4" /> Edit Details
          </>
        )}
      </Link>
    </Button>
  );
}