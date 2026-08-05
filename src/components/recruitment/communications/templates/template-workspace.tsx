"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  Copy,
  Pencil,
  Plus,
  RotateCcw,
  Star,
  Trash2,
} from "lucide-react";
import { AppTabs } from "@/components/ui/app-tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import {
  archiveEmailTemplateAction,
  createEmailTemplateAction,
  deleteEmailTemplateAction,
  duplicateEmailTemplateAction,
  restoreEmailTemplateAction,
  setDefaultEmailTemplateAction,
  updateEmailTemplateAction,
} from "@/actions/recruitment-communications";
import {
  TEMPLATE_CATEGORIES,
  templateTypeLabel,
} from "@/lib/recruitment/communication/template-categories";
import { RecruitmentEmailTemplateType } from "@/generated/prisma/enums";
import { TemplateEditorDialog } from "./template-editor-dialog";

export type TemplateAdminItem = {
  id: string;
  name: string;
  type: RecruitmentEmailTemplateType;
  subject: string;
  body: string;
  isSystem: boolean;
  isActive: boolean;
  isDefault: boolean;
  isVirtual: boolean;
};

type TabId = "active" | "archived";

export function TemplateWorkspace({
  initialTemplates,
  initialTab = "active",
}: {
  initialTemplates: TemplateAdminItem[];
  initialTab?: TabId;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>(initialTab);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<TemplateAdminItem | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return initialTemplates.filter((template) => {
      if (tab === "active" && !template.isActive) return false;
      if (tab === "archived" && template.isActive) return false;
      if (category !== "all" && template.type !== category) return false;
      if (!q) return true;
      return (
        template.name.toLowerCase().includes(q) ||
        template.subject.toLowerCase().includes(q)
      );
    });
  }, [category, initialTemplates, search, tab]);

  const run = (work: () => Promise<void>) => {
    setError(null);
    setStatus(null);
    startTransition(async () => {
      try {
        await work();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <AppTabs
          tabs={[
            { id: "active", label: "Active" },
            { id: "archived", label: "Archived" },
          ]}
          active={tab}
          onChange={(id) => {
            setTab(id as TabId);
            router.push(
              `/admin/recruitment/communications/templates?tab=${id}`
            );
          }}
        />
        <Button
          size="sm"
          className="gap-1.5"
          onClick={() => {
            setEditing(null);
            setEditorOpen(true);
          }}
        >
          <Plus className="h-4 w-4" aria-hidden />
          Create template
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_14rem]">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search templates…"
          aria-label="Search templates"
        />
        <select
          className="h-10 rounded-lg border border-border bg-card px-3 text-sm"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          aria-label="Filter by category"
        >
          <option value="all">All categories</option>
          {TEMPLATE_CATEGORIES.map((item) => (
            <option key={item.id} value={item.type}>
              {item.label}
            </option>
          ))}
        </select>
      </div>

      {(error || status) && (
        <p
          className={`text-xs font-medium ${error ? "text-danger" : "text-emerald-700"}`}
          role="status"
        >
          {error ?? status}
        </p>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon={Pencil}
          title="No templates found"
          description="Create a custom template or adjust your filters."
        />
      ) : (
        <ul className="space-y-3" aria-label="Email templates">
          {filtered.map((template) => (
            <li
              key={template.id}
              className="rounded-xl border border-border/70 bg-card p-4 shadow-subtle"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-foreground">
                      {template.name}
                    </h3>
                    {template.isSystem && (
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                        System
                      </span>
                    )}
                    {template.isDefault && (
                      <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                        Default
                      </span>
                    )}
                    <span className="rounded-md bg-teal-50 px-2 py-0.5 text-[10px] font-semibold text-teal-700">
                      {templateTypeLabel(template.type)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{template.subject}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {!template.isSystem && tab === "active" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1"
                      disabled={isPending}
                      onClick={() => {
                        setEditing(template);
                        setEditorOpen(true);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden />
                      Edit
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1"
                    disabled={isPending}
                    onClick={() =>
                      run(async () => {
                        const result = await duplicateEmailTemplateAction(
                          {},
                          { id: template.id }
                        );
                        if (result.error) throw new Error(result.error);
                        setStatus("Template duplicated.");
                      })
                    }
                  >
                    <Copy className="h-3.5 w-3.5" aria-hidden />
                    Duplicate
                  </Button>
                  {!template.isVirtual && tab === "active" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1"
                      disabled={isPending || template.isSystem}
                      onClick={() =>
                        run(async () => {
                          const result = await setDefaultEmailTemplateAction(
                            {},
                            { id: template.id, type: template.type }
                          );
                          if (result.error) throw new Error(result.error);
                          setStatus("Marked as default.");
                        })
                      }
                    >
                      <Star className="h-3.5 w-3.5" aria-hidden />
                      Default
                    </Button>
                  )}
                  {!template.isSystem && tab === "active" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1"
                      disabled={isPending}
                      onClick={() =>
                        run(async () => {
                          const result = await archiveEmailTemplateAction(
                            {},
                            { id: template.id }
                          );
                          if (result.error) throw new Error(result.error);
                          setStatus("Template archived.");
                        })
                      }
                    >
                      <Archive className="h-3.5 w-3.5" aria-hidden />
                      Archive
                    </Button>
                  )}
                  {!template.isSystem && tab === "archived" && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1"
                        disabled={isPending}
                        onClick={() =>
                          run(async () => {
                            const result = await restoreEmailTemplateAction(
                              {},
                              { id: template.id }
                            );
                            if (result.error) throw new Error(result.error);
                            setStatus("Template restored.");
                          })
                        }
                      >
                        <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                        Restore
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1 text-danger"
                        disabled={isPending}
                        onClick={() =>
                          run(async () => {
                            const result = await deleteEmailTemplateAction(
                              {},
                              { id: template.id }
                            );
                            if (result.error) throw new Error(result.error);
                            setStatus("Template deleted.");
                          })
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        Delete
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <TemplateEditorDialog
        open={editorOpen}
        template={editing}
        onOpenChange={setEditorOpen}
        pending={isPending}
        onSave={(payload) =>
          run(async () => {
            const result = editing
              ? await updateEmailTemplateAction({}, { id: editing.id, ...payload })
              : await createEmailTemplateAction({}, payload);
            if (result.error) throw new Error(result.error);
            setEditorOpen(false);
            setEditing(null);
            setStatus(editing ? "Template updated." : "Template created.");
          })
        }
      />
    </div>
  );
}
