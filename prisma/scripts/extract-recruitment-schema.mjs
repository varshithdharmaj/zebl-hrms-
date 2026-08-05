import fs from "node:fs";

const mdPath = "c:/Users/ADMIN/Downloads/zebl hr/ZEBL_AMS/docs/RECRUITMENT_SCHEMA_DESIGN.md";
const outPath = "c:/Users/ADMIN/Downloads/zebl hr/ZEBL_AMS/prisma/recruitment-schema-append.prisma";

const md = fs.readFileSync(mdPath, "utf8");
const start = md.indexOf("enum JobOpeningStatus");
const fenceAfter = md.indexOf("```", md.indexOf("model RecruitmentSavedFilter"));
if (start < 0 || fenceAfter < 0) {
  console.error("parse fail", { start, fenceAfter });
  process.exit(1);
}

let block = md.slice(start, fenceAfter);
block = block.replace(
  /\/\/ Extend existing NotificationType[\s\S]*?\/\/ recruitment_sla_stale\r?\n\r?\n/,
  ""
);

const header = `
// =============================================================================
// RECRUITMENT MODULE — Phase 0 foundation
// =============================================================================

`;

fs.writeFileSync(outPath, header + block);
console.log("wrote", outPath, "bytes", fs.statSync(outPath).size);
