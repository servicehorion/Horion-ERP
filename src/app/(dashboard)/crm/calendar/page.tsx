import { getMeetings } from "@/lib/actions/crm-advanced.actions";
import { getContacts } from "@/lib/actions/contact.actions";
import CrmCalendar from "@/components/crm/crm-calendar";
import { CalendarDays } from "lucide-react";

export default async function CrmCalendarPage() {
  const [meetingsRes, contactsRes] = await Promise.all([
    getMeetings({}),
    getContacts({ limit: 200 }),
  ]);

  const meetings = (meetingsRes.data ?? []).map((m: any) => ({
    ...m,
    startAt: new Date(m.startAt),
    endAt: new Date(m.endAt),
  }));

  const contacts = (contactsRes.data ?? []).map((c: any) => ({
    id: c.id,
    name: c.name,
    company: c.company ?? null,
  }));

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CalendarDays className="h-6 w-6 text-blue-600" />
          Calendrier CRM
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          RDV, appels, visios — planifiez et suivez vos interactions commerciales
        </p>
      </div>
      <CrmCalendar meetings={meetings} contacts={contacts} />
    </div>
  );
}
