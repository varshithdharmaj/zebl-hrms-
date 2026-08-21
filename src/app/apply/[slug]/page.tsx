import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { resolvePublicJobBySlug } from "@/lib/recruitment/public-apply/public-job-query";
import { PublicApplyFlow } from "@/components/recruitment/public-apply/public-apply-flow";

export const dynamic = "force-dynamic";

function employmentTypeLabel(value: string): string {
  return value
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export default async function JobApplyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const job = await resolvePublicJobBySlug(slug);

  if (!job) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16">
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-base font-medium text-foreground">This job posting is no longer available.</p>
            <p className="mt-2 text-sm text-muted-foreground">
              It may have closed or been unpublished. Check our open positions instead.
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-xl">{job.title}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {[job.location, employmentTypeLabel(job.employmentType), job.department]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="whitespace-pre-line text-sm text-foreground">{job.description}</p>
        </CardContent>
      </Card>

      <PublicApplyFlow jobPublicSlug={job.publicSlug} jobTitle={job.title} />
    </main>
  );
}
