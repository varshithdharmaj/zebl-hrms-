/**
 * Minimal enterprise demo — curated catalogs (every row has a purpose).
 */
export const COMPANY = "ZEBL Technologies Pvt Ltd";
export const DEMO_PASSWORD = "Demo@2026";
export const MIN_PREFIX = "MIN-";
export const MIN_EMAIL_DOMAIN = "zebl.demo";
export const MIN_CAND_DOMAIN = "cand.zebl.demo";
export const MIN_MARKER = "zebl-min-demo-v1";

export const DEPARTMENTS = ["Engineering", "HR", "Sales", "Finance"] as const;
export const LOCATIONS = ["Hyderabad", "Bangalore", "Pune", "Remote"] as const;

export type SourceLabel = "LinkedIn" | "Referral" | "Career Page" | "Naukri" | "Campus";

export const SOURCE_MAP: Record<
  SourceLabel,
  { enum: "other" | "referral" | "career_portal_future" | "manual"; tag: string }
> = {
  LinkedIn: { enum: "other", tag: "source:linkedin" },
  Referral: { enum: "referral", tag: "source:referral" },
  "Career Page": { enum: "career_portal_future", tag: "source:career_page" },
  Naukri: { enum: "other", tag: "source:naukri" },
  Campus: { enum: "other", tag: "source:campus" },
};

/** 10 staff — permissions + interview panel + managers */
export const STAFF = [
  { key: "hr_head", code: "MIN-EMP-01", name: "Priya Sharma", email: "hr.head@zebl.demo", dept: "HR", title: "HR Head", role: "hr" as const },
  { key: "rec_1", code: "MIN-EMP-02", name: "Ananya Iyer", email: "recruiter1@zebl.demo", dept: "HR", title: "Technical Recruiter", role: "hr" as const },
  { key: "rec_2", code: "MIN-EMP-03", name: "Rohit Menon", email: "recruiter2@zebl.demo", dept: "HR", title: "Recruiter", role: "hr" as const },
  { key: "hm_eng", code: "MIN-EMP-04", name: "Karthik Subramanian", email: "hm.eng@zebl.demo", dept: "Engineering", title: "Engineering Manager", role: "employee" as const },
  { key: "hm_sales", code: "MIN-EMP-05", name: "Neha Kapoor", email: "hm.sales@zebl.demo", dept: "Sales", title: "Sales Manager", role: "employee" as const },
  { key: "hm_fin", code: "MIN-EMP-06", name: "Sneha Reddy", email: "hm.fin@zebl.demo", dept: "Finance", title: "Finance Manager", role: "employee" as const },
  { key: "iv_tech", code: "MIN-EMP-07", name: "Meera Krishnan", email: "iv.tech@zebl.demo", dept: "Engineering", title: "Senior Engineer", role: "employee" as const },
  { key: "iv_hr", code: "MIN-EMP-08", name: "Divya Banerjee", email: "iv.hr@zebl.demo", dept: "HR", title: "HRBP", role: "hr" as const },
  { key: "emp_1", code: "MIN-EMP-09", name: "Harsh Patel", email: "harsh@zebl.demo", dept: "Engineering", title: "Software Engineer", role: "employee" as const },
  { key: "emp_2", code: "MIN-EMP-10", name: "Pooja Gupta", email: "pooja@zebl.demo", dept: "Sales", title: "Account Executive", role: "employee" as const },
] as const;

/** 6 jobs — every status */
export const JOBS = [
  { code: "MIN-JOB-01", title: "Frontend Engineer", dept: "Engineering", loc: "Hyderabad", status: "open" as const, hm: "hm_eng", rec: "rec_1", min: 1400000, max: 2200000 },
  { code: "MIN-JOB-02", title: "Backend Engineer", dept: "Engineering", loc: "Bangalore", status: "open" as const, hm: "hm_eng", rec: "rec_1", min: 1600000, max: 2600000 },
  { code: "MIN-JOB-03", title: "Sales Executive", dept: "Sales", loc: "Pune", status: "draft" as const, hm: "hm_sales", rec: "rec_2", min: 600000, max: 1100000 },
  { code: "MIN-JOB-04", title: "DevOps Engineer", dept: "Engineering", loc: "Hyderabad", status: "on_hold" as const, hm: "hm_eng", rec: "rec_2", min: 1800000, max: 2800000 },
  { code: "MIN-JOB-05", title: "Finance Analyst", dept: "Finance", loc: "Hyderabad", status: "filled" as const, hm: "hm_fin", rec: "rec_1", min: 900000, max: 1400000 },
  { code: "MIN-JOB-06", title: "HR Executive", dept: "HR", loc: "Bangalore", status: "closed" as const, hm: "hr_head", rec: "rec_2", min: 500000, max: 800000 },
] as const;

/**
 * 15 candidates — each maps to one primary application outcome.
 * Candidate 0 also applies to a second job (multi-app).
 */
export const CANDIDATES = [
  { key: "c01", name: "Aarav Sharma", source: "LinkedIn" as SourceLabel, years: 5, city: "Hyderabad", purpose: "applied" },
  { key: "c02", name: "Diya Reddy", source: "Referral" as SourceLabel, years: 3, city: "Bangalore", purpose: "screening" },
  { key: "c03", name: "Vihaan Patel", source: "Career Page" as SourceLabel, years: 4, city: "Pune", purpose: "assessment" },
  { key: "c04", name: "Ananya Iyer", source: "Naukri" as SourceLabel, years: 6, city: "Hyderabad", purpose: "technical" },
  { key: "c05", name: "Rohan Menon", source: "LinkedIn" as SourceLabel, years: 8, city: "Bangalore", purpose: "manager" },
  { key: "c06", name: "Sara Thomas", source: "Campus" as SourceLabel, years: 0, city: "Chennai", purpose: "hr" },
  { key: "c07", name: "Kabir Singh", source: "Referral" as SourceLabel, years: 7, city: "Hyderabad", purpose: "offer" },
  { key: "c08", name: "Emily Chen", source: "LinkedIn" as SourceLabel, years: 5, city: "Remote", purpose: "hired" },
  { key: "c09", name: "Nikhil Rao", source: "Naukri" as SourceLabel, years: 2, city: "Pune", purpose: "rejected" },
  { key: "c10", name: "Meera Nair", source: "Career Page" as SourceLabel, years: 4, city: "Bangalore", purpose: "withdrawn" },
  { key: "c11", name: "James Wilson", source: "LinkedIn" as SourceLabel, years: 10, city: "Hyderabad", purpose: "offer_accepted" },
  { key: "c12", name: "Fatima Ali", source: "Referral" as SourceLabel, years: 3, city: "Hyderabad", purpose: "offer_declined" },
  { key: "c13", name: "Aditya Gupta", source: "Campus" as SourceLabel, years: 1, city: "Bangalore", purpose: "offer_expired" },
  { key: "c14", name: "Olivia Park", source: "LinkedIn" as SourceLabel, years: 6, city: "Remote", purpose: "offer_withdrawn" },
  { key: "c15", name: "Suresh Pillai", source: "Naukri" as SourceLabel, years: 5, city: "Pune", purpose: "pending_conversion" },
] as const;

export type Purpose = (typeof CANDIDATES)[number]["purpose"];
