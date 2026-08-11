import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { RecruitmentCommunicationStatus, RecruitmentCommunicationType } from "@/generated/prisma/enums";
import { requireRecruitmentAdminSession } from "@/lib/auth-guards";
import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { Button } from "@/components/ui/button";
import {
  listCommunicationsCached,
  getCommunicationThreadCached,
  getCommunicationDashboardStatsCached,
} from "@/lib/recruitment/communication";
import { CommunicationCenter } from "@/components/recruitment/communications/communication-center";
import { CommunicationLoadingSkeleton } from "@/components/recruitment/communications/communication-loading-skeleton";
import {
  toCommunicationListItemView,
  toCommunicationThreadMessageView,
} from "@/components/recruitment/communications/mappers";
import type {
  CommunicationFilterState,
  CommunicationTab,
} from "@/components/recruitment/communications/types";
import type { ListCommunicationsInput } from "@/lib/validation/schemas/recruitment/communications";

function parseTab(value: string | string[] | undefined): CommunicationTab {
  const raw = typeof value === "string" ? value : "inbox";
  if (
    raw === "sent" ||
    raw === "drafts" ||
    raw === "inbox" ||
    raw === "scheduled"
  ) {
    return raw;
  }
  return "inbox";
}

function buildListInput(
  tab: CommunicationTab,
  q: string,
  type: string,
  page: number,
  pageSize: number,
  sessionUserId: string
): ListCommunicationsInput {
  const base: ListCommunicationsInput = {
    page,
    pageSize,
    search: q || undefined,
    type:
      type && type !== "all"
        ? (type as RecruitmentCommunicationType)
        : undefined,
  };

  if (tab === "drafts") {
    return { ...base, status: RecruitmentCommunicationStatus.draft };
  }

  if (tab === "sent") {
    return {
      ...base,
      status: RecruitmentCommunicationStatus.sent,
      senderUserId: sessionUserId,
    };
  }

  if (tab === "scheduled") {
    return { ...base, status: RecruitmentCommunicationStatus.scheduled };
  }

  // Inbox: received correspondence
  return {
    ...base,
    type:
      type && type !== "all"
        ? (type as RecruitmentCommunicationType)
        : RecruitmentCommunicationType.email_received,
  };
}

async function CommunicationCenterLoader({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireRecruitmentAdminSession();
  const raw = await searchParams;

  const tab = parseTab(raw.tab);
  const q = typeof raw.q === "string" ? raw.q : "";
  const type = typeof raw.type === "string" ? raw.type : "all";
  const page = typeof raw.page === "string" ? Math.max(1, parseInt(raw.page, 10) || 1) : 1;
  const pageSize =
    typeof raw.pageSize === "string" ? Math.min(50, Math.max(1, parseInt(raw.pageSize, 10) || 25)) : 25;
  const threadId = typeof raw.threadId === "string" ? raw.threadId : null;

  const listInput = buildListInput(tab, q, type, page, pageSize, session.id);

  const [listResult, stats, inboxCount, draftsList, scheduledList] =
    await Promise.all([
      listCommunicationsCached(session, listInput),
      getCommunicationDashboardStatsCached(session),
      listCommunicationsCached(session, {
        page: 1,
        pageSize: 1,
        type: RecruitmentCommunicationType.email_received,
      }),
      listCommunicationsCached(session, {
        page: 1,
        pageSize: 1,
        status: RecruitmentCommunicationStatus.draft,
      }),
      listCommunicationsCached(session, {
        page: 1,
        pageSize: 1,
        status: RecruitmentCommunicationStatus.scheduled,
      }),
    ]);

  const items = listResult.items.map(toCommunicationListItemView);

  let threadMessages = threadId
    ? (await getCommunicationThreadCached(session, threadId)).map(
        toCommunicationThreadMessageView
      )
    : [];

  // If thread fetch is empty but an item is selected, show the single message
  if (threadId && threadMessages.length === 0) {
    const selected = items.find(
      (item) => item.id === threadId || item.threadId === threadId
    );
    if (selected) {
      threadMessages = [{ ...selected, bodyHtmlSafe: selected.body ?? "" }];
    }
  }

  const filters: CommunicationFilterState = {
    tab,
    q,
    type,
    page: listResult.page,
    pageSize: listResult.pageSize,
    threadId,
  };

  return (
    <CommunicationCenter
      filters={filters}
      counts={{
        inbox: inboxCount.total,
        sent: stats.sent,
        drafts: draftsList.total,
        scheduled: scheduledList.total,
      }}
      items={items}
      total={listResult.total}
      totalPages={listResult.totalPages}
      threadMessages={threadMessages}
      currentUserId={session.id}
    />
  );
}

export default function RecruitmentCommunicationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <div className="space-y-6 lg:space-y-8">
      <WorkspacePageHeader
        title="Communication"
        description="Recruitment inbox, sent mail, drafts, and scheduled messages."
        action={
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline" className="font-semibold">
              <Link href="/admin/recruitment/communications/templates">
                Templates
              </Link>
            </Button>
            <Button asChild size="sm" className="gap-1.5 font-semibold">
              <Link href="/admin/recruitment/communications/new">
                <Plus className="h-4 w-4" aria-hidden />
                Compose
              </Link>
            </Button>
          </div>
        }
      />

      <Suspense fallback={<CommunicationLoadingSkeleton />}>
        <CommunicationCenterLoader searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
