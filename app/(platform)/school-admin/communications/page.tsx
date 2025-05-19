// app/(platform)/school-admin/communications/page.tsx
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Megaphone, Mail, MessageSquareText } from 'lucide-react'; // Example icons

// This page can be a Server Component as it's primarily for navigation
export default async function CommunicationsPage() {
  // In the future, you might fetch some summary data here, e.g.,
  // - Number of recent announcements
  // - Unread messages (if an internal messaging system is built)
  // For now, it's a static navigation hub.

  const communicationModules = [
    {
      title: "School Announcements",
      description: "Create, view, and manage official school-wide announcements.",
      link: "/school-admin/communications/announcements",
      icon: <Megaphone className="h-6 w-6 mb-2 text-primary" />,
      cta: "Manage Announcements"
    },
    {
      title: "Bulk Email (Coming Soon)",
      description: "Send emails to parents, teachers, or specific groups.",
      link: "#", // Placeholder link
      icon: <Mail className="h-6 w-6 mb-2 text-muted-foreground" />,
      cta: "Compose Email",
      disabled: true
    },
    {
      title: "SMS Notifications (Coming Soon)",
      description: "Send SMS alerts for urgent updates or reminders.",
      link: "#", // Placeholder link
      icon: <MessageSquareText className="h-6 w-6 mb-2 text-muted-foreground" />,
      cta: "Send SMS",
      disabled: true
    },
    // {
    //   title: "Communication Settings (Coming Soon)",
    //   description: "Configure notification preferences and templates.",
    //   link: "#", // Placeholder link
    //   icon: <Settings2 className="h-6 w-6 mb-2 text-muted-foreground" />,
    //   cta: "Configure Settings",
    //   disabled: true
    // }
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Communications Hub</CardTitle>
          <CardDescription>
            Manage all school communications from one place. Send announcements, emails, and SMS messages.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {communicationModules.map((mod) => (
          <Card key={mod.title} className="flex flex-col">
            <CardHeader className="items-center text-center"> {/* Centered icon and title */}
              {mod.icon}
              <CardTitle>{mod.title}</CardTitle>
            </CardHeader>
            <CardContent className="flex-grow">
              <p className="text-sm text-muted-foreground text-center">{mod.description}</p>
            </CardContent>
            <CardFooter>
              {mod.disabled ? (
                <Button className="w-full" disabled>
                  {mod.cta} (Soon)
                </Button>
              ) : (
                <Button className="w-full" asChild>
                  <Link href={mod.link}>{mod.cta}</Link>
                </Button>
              )}
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}