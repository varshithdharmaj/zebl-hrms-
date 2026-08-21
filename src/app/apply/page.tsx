import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { listPublicJobs } from "@/lib/recruitment/public-apply/public-job-query";

export const metadata = { title: "Careers" };
export const dynamic = "force-dynamic";

function employmentTypeLabel(value: string): string {
  return value
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export default async function CareersPage() {
  const jobs = await listPublicJobs();

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <div className="mb-8 flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-foreground">Open positions</h1>
        <p className="text-sm text-muted-foreground">
          Browse current openings and apply directly — no account required.
        </p>
      </div>

      {jobs.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            There are no open positions right now. Please check back soon.
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {jobs.map((job) => (
            <Card key={job.publicSlug}>
              <CardHeader>
                <CardTitle className="text-base">{job.title}</CardTitle>
                <CardDescription>
                  {[job.location, employmentTypeLabel(job.employmentType), job.department]
                    .filter(Boolean)
                    .join(" · ")}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-4 pt-0">
                <p className="line-clamp-2 text-sm text-muted-foreground">{job.description}</p>
                <Button asChild size="sm" className="shrink-0">
                  <Link href={`/apply/${job.publicSlug}`}>View & apply</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
