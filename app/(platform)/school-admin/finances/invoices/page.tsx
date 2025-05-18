// app/(platform)/school-admin/finances/invoices/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
    Invoice as PrismaInvoice, 
    InvoiceLineItem as PrismaInvoiceLineItem, 
    Student as PrismaStudent,
    Class as PrismaClass,
    PaymentStatus
} from '@prisma/client';

// Shadcn/ui components
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge"; // For status
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { PlusCircle, Eye, Printer, CreditCard, FileText } from "lucide-react"; // FileText for invoices

// Define more specific types for the data we expect to display
interface StudentWithClass extends PrismaStudent {
    currentClass?: Pick<PrismaClass, 'name' | 'section'> | null;
}
interface DisplayInvoice extends Omit<PrismaInvoice, 'student' | 'lineItems' | 'totalAmount' | 'paidAmount' | 'issueDate' | 'dueDate'> {
  student: Pick<StudentWithClass, 'firstName' | 'lastName' | 'studentIdNumber' | 'currentClass'>;
  lineItems: PrismaInvoiceLineItem[];
  totalAmount: number; // For display, ensure conversion from Decimal
  paidAmount: number;  // For display
  issueDate: string;   // For display (formatted)
  dueDate: string;     // For display (formatted)
}

export default function ManageInvoicesPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<DisplayInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchAttempted, setFetchAttempted] = useState(false);

  const formatAmount = (amount: any) => {
    if (amount === null || amount === undefined) return 'N/A';
    return new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(Number(amount));
  };

  const formatDate = (dateString: string | Date) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  };

  const fetchInvoices = useCallback(async (isInitialLoad = false) => {
    if(isInitialLoad) setIsLoading(true);
    setFetchAttempted(false);
    try {
      const response = await fetch('/api/school-admin/finances/invoices');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch invoices.');
      }
      const data: PrismaInvoice[] = await response.json();
      
      // Transform data for display (e.g., Decimal to number, Date to string)
      const displayData: DisplayInvoice[] = data.map(inv => ({
        ...inv,
        totalAmount: Number(inv.totalAmount), // Convert Prisma.Decimal to number
        paidAmount: Number(inv.paidAmount),   // Convert Prisma.Decimal to number
        issueDate: formatDate(inv.issueDate),
        dueDate: formatDate(inv.dueDate),
        // Ensure student and lineItems are correctly typed or transformed if needed
        student: inv.student as any, // Cast if Prisma type from include differs slightly
        lineItems: inv.lineItems as any,
      }));
      setInvoices(displayData);
    } catch (error: any) {
      toast.error("Failed to load invoices", { description: error.message });
      setInvoices([]);
    } finally {
      if(isInitialLoad) setIsLoading(false);
      setFetchAttempted(true);
    }
  }, []);

  useEffect(() => {
    fetchInvoices(true);
  }, [fetchInvoices]);

  const getStatusBadgeVariant = (status: PaymentStatus) => {
    switch (status) {
      case PaymentStatus.PAID: return "success";
      case PaymentStatus.PENDING: return "default";
      case PaymentStatus.PARTIAL: return "secondary";
      case PaymentStatus.OVERDUE: return "destructive";
      case PaymentStatus.CANCELLED: return "outline";
      default: return "default";
    }
  };

  const renderSkeletons = () => Array.from({ length: 5 }).map((_, index) => (
    <TableRow key={`skeleton-invoice-${index}`}>
        <TableCell><Skeleton className="h-6 w-24" /></TableCell>
        <TableCell><Skeleton className="h-6 w-32" /></TableCell>
        <TableCell className="hidden sm:table-cell"><Skeleton className="h-6 w-20" /></TableCell>
        <TableCell className="hidden md:table-cell"><Skeleton className="h-6 w-20" /></TableCell>
        <TableCell className="hidden md:table-cell"><Skeleton className="h-6 w-24" /></TableCell>
        <TableCell className="hidden lg:table-cell"><Skeleton className="h-6 w-20" /></TableCell>
        <TableCell><Skeleton className="h-6 w-20" /></TableCell>
        <TableCell className="text-right"><Skeleton className="h-8 w-24" /></TableCell>
    </TableRow>
  ));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Manage Invoices</CardTitle>
          <CardDescription>View, create, and manage student invoices.</CardDescription>
        </div>
        <Button asChild>
          <Link href="/school-admin/finances/invoices/new">
            <PlusCircle className="mr-2 h-4 w-4" /> Create New Invoice
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {(isLoading && !fetchAttempted) ? (
             <Table>
              <TableCaption>Loading invoice data...</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead><TableHead>Student</TableHead>
                  <TableHead className="hidden sm:table-cell">Issue Date</TableHead>
                  <TableHead className="hidden md:table-cell">Due Date</TableHead>
                  <TableHead className="hidden md:table-cell">Total</TableHead>
                  <TableHead className="hidden lg:table-cell">Paid</TableHead>
                  <TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>{renderSkeletons()}</TableBody>
            </Table>
        ) : !isLoading && invoices.length === 0 && fetchAttempted ? (
          <div className="text-center py-10"><FileText className="mx-auto h-12 w-12 text-muted-foreground" /><h3 className="mt-2 text-sm font-medium">No invoices found.</h3><p className="mt-1 text-sm text-muted-foreground">Get started by creating a new invoice.</p></div>
        ) : (
          <Table>
            <TableCaption>A list of all student invoices.</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead><TableHead>Student</TableHead>
                <TableHead className="hidden sm:table-cell">Issue Date</TableHead>
                <TableHead className="hidden md:table-cell">Due Date</TableHead>
                <TableHead className="hidden md:table-cell">Total</TableHead>
                <TableHead className="hidden lg:table-cell">Paid</TableHead>
                <TableHead>Status</TableHead><TableHead className="text-right w-[150px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                  <TableCell>
                    {invoice.student.firstName} {invoice.student.lastName}
                    <span className="block text-xs text-muted-foreground">
                        ID: {invoice.student.studentIdNumber || 'N/A'}
                        {invoice.student.currentClass ? `, ${invoice.student.currentClass.name} ${invoice.student.currentClass.section || ''}` : ''}
                    </span>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">{invoice.issueDate}</TableCell>
                  <TableCell className="hidden md:table-cell">{invoice.dueDate}</TableCell>
                  <TableCell className="hidden md:table-cell">{formatAmount(invoice.totalAmount)}</TableCell>
                  <TableCell className="hidden lg:table-cell">{formatAmount(invoice.paidAmount)}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadgeVariant(invoice.status)}>
                      {invoice.status.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="outline" size="sm" className="h-7 px-2" disabled title="View Details (soon)">
                      <Eye className="mr-1 h-3 w-3" /> View
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 px-2" disabled title="Record Payment (soon)">
                      <CreditCard className="mr-1 h-3 w-3" /> Pay
                    </Button>
                     <Button variant="outline" size="sm" className="h-7 px-2" disabled title="Print (soon)">
                      <Printer className="mr-1 h-3 w-3" /> Print
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <CardFooter>
        <div className="text-xs text-muted-foreground">Total invoices: <strong>{invoices.length}</strong></div>
      </CardFooter>
    </Card>
  );
}