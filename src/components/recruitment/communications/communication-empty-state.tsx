import { Inbox, Mail, FileEdit, Clock3 } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import type { CommunicationTab } from "./types";

const COPY: Record<
  CommunicationTab,
  { icon: typeof Inbox; title: string; description: string }
> = {
  inbox: {
    icon: Inbox,
    title: "Inbox is empty",
    description: "Received candidate messages and system notifications will appear here.",
  },
  sent: {
    icon: Mail,
    title: "No sent messages",
    description: "Emails you send to candidates will show up in this folder.",
  },
  drafts: {
    icon: FileEdit,
    title: "No drafts",
    description: "Saved draft communications will appear here until they are sent or deleted.",
  },
  scheduled: {
    icon: Clock3,
    title: "No scheduled emails",
    description: "Messages scheduled for future send will appear here until cancelled or sent.",
  },
};

export function CommunicationEmptyState({ tab }: { tab: CommunicationTab }) {
  const copy = COPY[tab];
  return (
    <EmptyState
      icon={copy.icon}
      title={copy.title}
      description={copy.description}
      className="min-h-[16rem]"
    />
  );
}
