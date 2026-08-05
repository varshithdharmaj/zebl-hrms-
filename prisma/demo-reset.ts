/**
 * Wipe ZEBL recruitment demo data only.
 *
 * Usage: npm run demo:reset
 */
import { createDemoPrismaClient, loadEnvFiles, logStep } from "./demo/helpers";
import { resetDemoData } from "./demo/reset";

loadEnvFiles();

async function main(): Promise<void> {
  const prisma = createDemoPrismaClient();
  try {
    await resetDemoData(prisma);
    logStep("Done. Run `npm run demo:seed` to repopulate.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[demo-reset] FAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
});
