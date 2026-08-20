import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { authorizeCronOrAdmin, getCronSecrets } from "@/lib/auth/cron-auth";
import { ingestBiometricPunches } from "@/lib/integrations/biometric-ingestion";

export async function POST(request: Request) {
  // 1. Authenticate bridge (Bearer secret or Admin session)
  const secrets = getCronSecrets();
  const authorized = await authorizeCronOrAdmin(request, [
    secrets.attendanceBridge,
    secrets.integration,
  ]);

  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parse request JSON
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON request body." },
      { status: 400 }
    );
  }

  // 3. Process ingestion
  try {
    const result = await ingestBiometricPunches(body);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Invalid request payload.",
          details: error.issues.map((e) => `${e.path.join(".")}: ${e.message}`),
        },
        { status: 400 }
      );
    }

    console.error("Biometric ingestion internal error:", error);
    return NextResponse.json(
      { error: "Internal server error during biometric punch ingestion." },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed. Use POST." },
    { status: 405, headers: { Allow: "POST" } }
  );
}
