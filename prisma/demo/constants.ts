/**
 * ZEBL Technologies Pvt Ltd — demo seed constants & catalog data.
 * Marker fields make the seed idempotent and safely resettable.
 */

export const DEMO_MARKER = "zebl-demo-seed-v1";
export const DEMO_PASSWORD = "Demo@2026";
export const DEMO_TAG = "__demo_seed__";
export const DEMO_EMAIL_DOMAIN = "zebl-demo.local";
export const CANDIDATE_EMAIL_DOMAIN = "candidate-demo.local";

export const COMPANY = {
  name: "ZEBL Technologies Pvt Ltd",
  shortName: "ZEBL",
} as const;

export const DEPARTMENTS = [
  "Engineering",
  "Product",
  "Design",
  "QA",
  "HR",
  "Finance",
  "Sales",
  "Marketing",
  "Customer Success",
  "IT",
  "Operations",
] as const;

export const LOCATIONS = [
  "Hyderabad",
  "Bangalore",
  "Pune",
  "Chennai",
  "Remote",
] as const;

export const EMPLOYMENT_TYPES = ["full_time", "intern", "contract"] as const;

/** UI-facing source labels → CandidateSource enum (+ tag for board sources). */
export const SOURCE_CATALOG = [
  { label: "LinkedIn", enum: "other" as const, tag: "source:linkedin" },
  { label: "Referral", enum: "referral" as const, tag: "source:referral" },
  { label: "Website", enum: "career_portal_future" as const, tag: "source:website" },
  { label: "Campus", enum: "other" as const, tag: "source:campus" },
  { label: "Indeed", enum: "other" as const, tag: "source:indeed" },
  { label: "Naukri", enum: "other" as const, tag: "source:naukri" },
  { label: "Monster", enum: "other" as const, tag: "source:monster" },
  { label: "Employee Referral", enum: "employee_referral" as const, tag: "source:employee_referral" },
  { label: "GitHub", enum: "other" as const, tag: "source:github" },
  { label: "Walk-in", enum: "manual" as const, tag: "source:walk_in" },
] as const;

export const DEMO_USERS = [
  {
    key: "super_admin",
    email: `admin@${DEMO_EMAIL_DOMAIN}`,
    role: "super_admin" as const,
    name: "Aisha Rahman",
    designation: "Super Admin",
    department: "IT",
    employeeCode: "DEMO-EMP-ADMIN",
  },
  {
    key: "hr_manager",
    email: `hr.manager@${DEMO_EMAIL_DOMAIN}`,
    role: "hr" as const,
    name: "Priya Sharma",
    designation: "HR Manager",
    department: "HR",
    employeeCode: "DEMO-EMP-HRMGR",
  },
  {
    key: "recruiter1",
    email: `recruiter1@${DEMO_EMAIL_DOMAIN}`,
    role: "hr" as const,
    name: "Ananya Iyer",
    designation: "Technical Recruiter",
    department: "HR",
    employeeCode: "DEMO-EMP-REC1",
  },
  {
    key: "recruiter2",
    email: `recruiter2@${DEMO_EMAIL_DOMAIN}`,
    role: "hr" as const,
    name: "Rohit Menon",
    designation: "Senior Recruiter",
    department: "HR",
    employeeCode: "DEMO-EMP-REC2",
  },
  {
    key: "eng_manager",
    email: `eng.manager@${DEMO_EMAIL_DOMAIN}`,
    role: "employee" as const,
    name: "Karthik Subramanian",
    designation: "Engineering Manager",
    department: "Engineering",
    employeeCode: "DEMO-EMP-ENGMGR",
  },
  {
    key: "qa_manager",
    email: `qa.manager@${DEMO_EMAIL_DOMAIN}`,
    role: "employee" as const,
    name: "Meera Nair",
    designation: "QA Manager",
    department: "QA",
    employeeCode: "DEMO-EMP-QAMGR",
  },
  {
    key: "product_manager",
    email: `product.manager@${DEMO_EMAIL_DOMAIN}`,
    role: "employee" as const,
    name: "Sneha Kapoor",
    designation: "Product Manager",
    department: "Product",
    employeeCode: "DEMO-EMP-PM",
  },
  {
    key: "hiring_manager",
    email: `hiring.manager@${DEMO_EMAIL_DOMAIN}`,
    role: "employee" as const,
    name: "Vikram Desai",
    designation: "Hiring Manager",
    department: "Engineering",
    employeeCode: "DEMO-EMP-HM",
  },
] as const;

export type DemoUserKey = (typeof DEMO_USERS)[number]["key"];

export const JOB_CATALOG: Array<{
  code: string;
  title: string;
  department: (typeof DEPARTMENTS)[number];
  location: (typeof LOCATIONS)[number];
  employmentType: (typeof EMPLOYMENT_TYPES)[number];
  status: "draft" | "open" | "on_hold" | "closed" | "filled";
  openingsCount: number;
  compensationMin: number;
  compensationMax: number;
  workMode: "onsite" | "hybrid" | "remote";
  ownerKey: DemoUserKey;
  hmKey: DemoUserKey;
}> = [
  { code: "DEMO-JOB-001", title: "Senior Backend Engineer", department: "Engineering", location: "Hyderabad", employmentType: "full_time", status: "open", openingsCount: 3, compensationMin: 2200000, compensationMax: 3200000, workMode: "hybrid", ownerKey: "recruiter1", hmKey: "eng_manager" },
  { code: "DEMO-JOB-002", title: "Frontend Engineer", department: "Engineering", location: "Bangalore", employmentType: "full_time", status: "open", openingsCount: 2, compensationMin: 1600000, compensationMax: 2400000, workMode: "hybrid", ownerKey: "recruiter1", hmKey: "eng_manager" },
  { code: "DEMO-JOB-003", title: "React Developer", department: "Engineering", location: "Pune", employmentType: "full_time", status: "open", openingsCount: 2, compensationMin: 1400000, compensationMax: 2200000, workMode: "onsite", ownerKey: "recruiter2", hmKey: "hiring_manager" },
  { code: "DEMO-JOB-004", title: "Next.js Developer", department: "Engineering", location: "Remote", employmentType: "full_time", status: "open", openingsCount: 1, compensationMin: 1800000, compensationMax: 2600000, workMode: "remote", ownerKey: "recruiter1", hmKey: "eng_manager" },
  { code: "DEMO-JOB-005", title: "AI Engineer", department: "Engineering", location: "Hyderabad", employmentType: "full_time", status: "open", openingsCount: 2, compensationMin: 2500000, compensationMax: 4000000, workMode: "hybrid", ownerKey: "recruiter1", hmKey: "eng_manager" },
  { code: "DEMO-JOB-006", title: "ML Engineer", department: "Engineering", location: "Bangalore", employmentType: "full_time", status: "open", openingsCount: 2, compensationMin: 2400000, compensationMax: 3800000, workMode: "hybrid", ownerKey: "recruiter2", hmKey: "hiring_manager" },
  { code: "DEMO-JOB-007", title: "DevOps Engineer", department: "IT", location: "Hyderabad", employmentType: "full_time", status: "open", openingsCount: 1, compensationMin: 1800000, compensationMax: 2800000, workMode: "onsite", ownerKey: "recruiter2", hmKey: "eng_manager" },
  { code: "DEMO-JOB-008", title: "QA Engineer", department: "QA", location: "Chennai", employmentType: "full_time", status: "open", openingsCount: 3, compensationMin: 1000000, compensationMax: 1600000, workMode: "onsite", ownerKey: "recruiter2", hmKey: "qa_manager" },
  { code: "DEMO-JOB-009", title: "SDET", department: "QA", location: "Bangalore", employmentType: "full_time", status: "open", openingsCount: 2, compensationMin: 1400000, compensationMax: 2200000, workMode: "hybrid", ownerKey: "recruiter1", hmKey: "qa_manager" },
  { code: "DEMO-JOB-010", title: "HR Executive", department: "HR", location: "Hyderabad", employmentType: "full_time", status: "open", openingsCount: 1, compensationMin: 600000, compensationMax: 900000, workMode: "onsite", ownerKey: "hr_manager", hmKey: "hr_manager" },
  { code: "DEMO-JOB-011", title: "Technical Recruiter", department: "HR", location: "Bangalore", employmentType: "full_time", status: "open", openingsCount: 2, compensationMin: 800000, compensationMax: 1400000, workMode: "hybrid", ownerKey: "hr_manager", hmKey: "hr_manager" },
  { code: "DEMO-JOB-012", title: "Product Manager", department: "Product", location: "Bangalore", employmentType: "full_time", status: "open", openingsCount: 1, compensationMin: 2800000, compensationMax: 4200000, workMode: "hybrid", ownerKey: "recruiter1", hmKey: "product_manager" },
  { code: "DEMO-JOB-013", title: "Associate Product Manager", department: "Product", location: "Pune", employmentType: "full_time", status: "open", openingsCount: 1, compensationMin: 1600000, compensationMax: 2400000, workMode: "onsite", ownerKey: "recruiter2", hmKey: "product_manager" },
  { code: "DEMO-JOB-014", title: "UI UX Designer", department: "Design", location: "Hyderabad", employmentType: "full_time", status: "open", openingsCount: 2, compensationMin: 1200000, compensationMax: 2000000, workMode: "hybrid", ownerKey: "recruiter1", hmKey: "product_manager" },
  { code: "DEMO-JOB-015", title: "Graphic Designer", department: "Design", location: "Chennai", employmentType: "full_time", status: "draft", openingsCount: 1, compensationMin: 700000, compensationMax: 1100000, workMode: "onsite", ownerKey: "recruiter2", hmKey: "hiring_manager" },
  { code: "DEMO-JOB-016", title: "Finance Analyst", department: "Finance", location: "Hyderabad", employmentType: "full_time", status: "open", openingsCount: 1, compensationMin: 900000, compensationMax: 1400000, workMode: "onsite", ownerKey: "hr_manager", hmKey: "hiring_manager" },
  { code: "DEMO-JOB-017", title: "Sales Executive", department: "Sales", location: "Bangalore", employmentType: "full_time", status: "open", openingsCount: 4, compensationMin: 600000, compensationMax: 1200000, workMode: "onsite", ownerKey: "recruiter2", hmKey: "hiring_manager" },
  { code: "DEMO-JOB-018", title: "Customer Success Manager", department: "Customer Success", location: "Pune", employmentType: "full_time", status: "open", openingsCount: 2, compensationMin: 1200000, compensationMax: 1800000, workMode: "hybrid", ownerKey: "recruiter1", hmKey: "product_manager" },
  { code: "DEMO-JOB-019", title: "Marketing Specialist", department: "Marketing", location: "Remote", employmentType: "full_time", status: "on_hold", openingsCount: 1, compensationMin: 800000, compensationMax: 1300000, workMode: "remote", ownerKey: "recruiter2", hmKey: "hiring_manager" },
  { code: "DEMO-JOB-020", title: "IT Support Engineer", department: "IT", location: "Hyderabad", employmentType: "full_time", status: "open", openingsCount: 2, compensationMin: 500000, compensationMax: 900000, workMode: "onsite", ownerKey: "recruiter2", hmKey: "eng_manager" },
  { code: "DEMO-JOB-021", title: "Operations Coordinator", department: "Operations", location: "Chennai", employmentType: "full_time", status: "draft", openingsCount: 1, compensationMin: 500000, compensationMax: 800000, workMode: "onsite", ownerKey: "hr_manager", hmKey: "hiring_manager" },
  { code: "DEMO-JOB-022", title: "Platform Engineer", department: "Engineering", location: "Bangalore", employmentType: "full_time", status: "filled", openingsCount: 1, compensationMin: 2000000, compensationMax: 3000000, workMode: "hybrid", ownerKey: "recruiter1", hmKey: "eng_manager" },
  { code: "DEMO-JOB-023", title: "Data Engineer", department: "Engineering", location: "Hyderabad", employmentType: "full_time", status: "closed", openingsCount: 2, compensationMin: 1800000, compensationMax: 2800000, workMode: "hybrid", ownerKey: "recruiter2", hmKey: "hiring_manager" },
  { code: "DEMO-JOB-024", title: "Software Engineering Intern", department: "Engineering", location: "Hyderabad", employmentType: "intern", status: "open", openingsCount: 5, compensationMin: 250000, compensationMax: 400000, workMode: "onsite", ownerKey: "recruiter1", hmKey: "eng_manager" },
  { code: "DEMO-JOB-025", title: "QA Intern", department: "QA", location: "Pune", employmentType: "intern", status: "open", openingsCount: 3, compensationMin: 200000, compensationMax: 350000, workMode: "onsite", ownerKey: "recruiter2", hmKey: "qa_manager" },
  { code: "DEMO-JOB-026", title: "Contract Frontend Developer", department: "Engineering", location: "Remote", employmentType: "contract", status: "open", openingsCount: 2, compensationMin: 1200000, compensationMax: 1800000, workMode: "remote", ownerKey: "recruiter1", hmKey: "eng_manager" },
  { code: "DEMO-JOB-027", title: "Contract DevOps Consultant", department: "IT", location: "Bangalore", employmentType: "contract", status: "on_hold", openingsCount: 1, compensationMin: 2000000, compensationMax: 3000000, workMode: "hybrid", ownerKey: "recruiter2", hmKey: "eng_manager" },
  { code: "DEMO-JOB-028", title: "Staff Backend Engineer", department: "Engineering", location: "Bangalore", employmentType: "full_time", status: "open", openingsCount: 1, compensationMin: 3500000, compensationMax: 5000000, workMode: "hybrid", ownerKey: "recruiter1", hmKey: "eng_manager" },
  { code: "DEMO-JOB-029", title: "Design Intern", department: "Design", location: "Hyderabad", employmentType: "intern", status: "draft", openingsCount: 2, compensationMin: 180000, compensationMax: 300000, workMode: "onsite", ownerKey: "recruiter2", hmKey: "product_manager" },
  { code: "DEMO-JOB-030", title: "Revenue Operations Analyst", department: "Sales", location: "Pune", employmentType: "full_time", status: "closed", openingsCount: 1, compensationMin: 1000000, compensationMax: 1500000, workMode: "onsite", ownerKey: "hr_manager", hmKey: "hiring_manager" },
  { code: "DEMO-JOB-031", title: "Full Stack Engineer", department: "Engineering", location: "Chennai", employmentType: "full_time", status: "filled", openingsCount: 2, compensationMin: 1600000, compensationMax: 2500000, workMode: "hybrid", ownerKey: "recruiter1", hmKey: "hiring_manager" },
  { code: "DEMO-JOB-032", title: "People Operations Specialist", department: "HR", location: "Hyderabad", employmentType: "full_time", status: "open", openingsCount: 1, compensationMin: 700000, compensationMax: 1100000, workMode: "onsite", ownerKey: "hr_manager", hmKey: "hr_manager" },
];

export const FIRST_NAMES = [
  "Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Sai", "Reyansh", "Ayaan", "Krishna", "Ishaan",
  "Shaurya", "Atharv", "Advik", "Pranav", "Kabir", "Anirudh", "Rohan", "Nikhil", "Harsh", "Yash",
  "Ananya", "Aadhya", "Diya", "Myra", "Sara", "Anika", "Aarohi", "Anvi", "Kiara", "Pari",
  "Ira", "Navya", "Saanvi", "Meera", "Isha", "Priya", "Neha", "Kavya", "Riya", "Sneha",
  "Rahul", "Amit", "Suresh", "Deepak", "Vikram", "Manish", "Pooja", "Swati", "Divya", "Nisha",
  "James", "Emily", "Michael", "Sophia", "Daniel", "Olivia", "Alex", "Emma", "Ryan", "Grace",
];

export const LAST_NAMES = [
  "Sharma", "Verma", "Patel", "Reddy", "Nair", "Iyer", "Menon", "Gupta", "Singh", "Kumar",
  "Das", "Banerjee", "Chatterjee", "Joshi", "Mehta", "Shah", "Pillai", "Rao", "Naidu", "Kulkarni",
  "Desai", "Agarwal", "Malhotra", "Kapoor", "Chopra", "Bhat", "Shetty", "Fernandes", "D'Souza", "Thomas",
  "Wilson", "Johnson", "Chen", "Park", "Nguyen", "Khan", "Ali", "Hussain", "Ahmed", "Roy",
];

export const COMPANIES = [
  "Infosys", "TCS", "Wipro", "Accenture", "Cognizant", "Amazon", "Microsoft", "Google",
  "Flipkart", "Swiggy", "Zomato", "PhonePe", "Razorpay", "Freshworks", "Zoho", "Oracle",
  "SAP", "IBM", "Capgemini", "Deloitte", "Thoughtworks", "Atlassian", "ServiceNow", "Adobe",
];

export const SKILLS_BY_DEPT: Record<string, string[]> = {
  Engineering: ["TypeScript", "Node.js", "React", "PostgreSQL", "AWS", "Docker", "Kubernetes", "Python", "Go", "System Design"],
  Product: ["Roadmapping", "User Research", "A/B Testing", "SQL", "Figma", "Agile", "Metrics", "Stakeholder Mgmt"],
  Design: ["Figma", "UI Design", "UX Research", "Prototyping", "Design Systems", "Illustration", "Accessibility"],
  QA: ["Selenium", "Playwright", "API Testing", "Jest", "Cypress", "Test Planning", "JMeter"],
  HR: ["Recruiting", "ATS", "Employee Relations", "Onboarding", "HRIS", "Compensation"],
  Finance: ["Excel", "Financial Modeling", "SAP", "Budgeting", "FP&A", "GST"],
  Sales: ["CRM", "Negotiation", "Pipeline Mgmt", "Cold Outreach", "Demo", "Salesforce"],
  Marketing: ["SEO", "Content", "Google Ads", "Analytics", "Brand", "Email Marketing"],
  "Customer Success": ["CSM", "Retention", "Onboarding", "Zendesk", "QBR", "NPS"],
  IT: ["Networking", "Active Directory", "Linux", "Helpdesk", "Security", "Intune"],
  Operations: ["Process Design", "Vendor Mgmt", "Reporting", "Logistics", "SOP"],
};

export const PIPELINE_STAGES = [
  { stage: "resume_received" as const, sortOrder: 10, isOptional: false, label: "Resume Received", slaDays: 2 },
  { stage: "screening" as const, sortOrder: 20, isOptional: false, label: "Screening", slaDays: 3 },
  { stage: "assessment" as const, sortOrder: 30, isOptional: true, label: "Assessment", slaDays: 5 },
  { stage: "hr_round" as const, sortOrder: 40, isOptional: true, label: "HR Round", slaDays: 5 },
  { stage: "technical_round" as const, sortOrder: 50, isOptional: true, label: "Technical Round", slaDays: 5 },
  { stage: "team_lead_round" as const, sortOrder: 60, isOptional: true, label: "Team Lead Round", slaDays: 5 },
  { stage: "manager_round" as const, sortOrder: 70, isOptional: false, label: "Manager Round", slaDays: 5 },
  { stage: "client_round" as const, sortOrder: 80, isOptional: true, label: "Client Round", slaDays: 5 },
  { stage: "reference_check" as const, sortOrder: 90, isOptional: true, label: "Reference Check", slaDays: 5 },
  { stage: "decision" as const, sortOrder: 100, isOptional: false, label: "Decision", slaDays: 3 },
  { stage: "offer" as const, sortOrder: 110, isOptional: false, label: "Offer", slaDays: 5 },
  { stage: "hired" as const, sortOrder: 120, isOptional: false, label: "Hired", slaDays: null },
] as const;

export const ACTIVE_PIPELINE_PATH = [
  "resume_received",
  "screening",
  "assessment",
  "hr_round",
  "technical_round",
  "manager_round",
  "decision",
  "offer",
  "hired",
] as const;

export const EMAIL_TEMPLATES = [
  {
    key: "interview_invite",
    name: "Demo · Interview Invite",
    type: "interview_invitation" as const,
    subject: "Interview Invitation — {{job_title}} at ZEBL Technologies",
    body: "Hi {{candidate_name}},\n\nWe were impressed with your profile and would like to invite you for an interview for the {{job_title}} role.\n\nPlease confirm your availability.\n\nBest regards,\nZEBL Talent Team",
  },
  {
    key: "interview_reminder",
    name: "Demo · Interview Reminder",
    type: "interview_reminder" as const,
    subject: "Reminder: Interview tomorrow — {{job_title}}",
    body: "Hi {{candidate_name}},\n\nThis is a friendly reminder about your upcoming interview for {{job_title}}.\n\nLooking forward to speaking with you.\n\nZEBL Talent Team",
  },
  {
    key: "offer_letter",
    name: "Demo · Offer Letter",
    type: "offer_letter" as const,
    subject: "Offer of Employment — ZEBL Technologies Pvt Ltd",
    body: "Dear {{candidate_name}},\n\nWe are pleased to offer you the position of {{job_title}} at ZEBL Technologies Pvt Ltd.\n\nPlease review the attached offer details and respond by the stated deadline.\n\nCongratulations!\nHR Team",
  },
  {
    key: "offer_reminder",
    name: "Demo · Offer Reminder",
    type: "offer_reminder" as const,
    subject: "Reminder: Offer response pending",
    body: "Hi {{candidate_name}},\n\nJust a reminder that your offer for {{job_title}} is awaiting your response. Please let us know if you have questions.\n\nHR Team",
  },
  {
    key: "app_received",
    name: "Demo · Application Received",
    type: "general" as const,
    subject: "We received your application — {{job_title}}",
    body: "Hi {{candidate_name}},\n\nThank you for applying to {{job_title}} at ZEBL Technologies. Our recruiting team will review your application shortly.\n\nTalent Acquisition",
  },
  {
    key: "app_rejected",
    name: "Demo · Application Rejected",
    type: "rejection" as const,
    subject: "Update on your application — {{job_title}}",
    body: "Hi {{candidate_name}},\n\nThank you for your interest in ZEBL Technologies. After careful consideration, we will not be moving forward with your application for {{job_title}} at this time.\n\nWe wish you the best.\nTalent Team",
  },
  {
    key: "app_accepted",
    name: "Demo · Application Accepted",
    type: "welcome" as const,
    subject: "Congratulations — moving forward for {{job_title}}",
    body: "Hi {{candidate_name}},\n\nGreat news! We would like to progress your application for {{job_title}}. Our recruiter will reach out with next steps.\n\nTalent Team",
  },
  {
    key: "joining",
    name: "Demo · Joining Instructions",
    type: "general" as const,
    subject: "Joining instructions — Welcome to ZEBL",
    body: "Dear {{candidate_name}},\n\nWelcome aboard! Please find joining instructions for your first day at ZEBL Technologies.\n\nReport to Hyderabad HQ at 9:30 AM with original documents.\n\nHR Onboarding",
  },
  {
    key: "welcome",
    name: "Demo · Welcome Email",
    type: "welcome" as const,
    subject: "Welcome to ZEBL Technologies Pvt Ltd",
    body: "Hi {{candidate_name}},\n\nWelcome to the ZEBL family! We are excited to have you join us as {{job_title}}.\n\nYour buddy and manager will greet you on day one.\n\nPeople Team",
  },
  {
    key: "general_hr",
    name: "Demo · General HR",
    type: "general" as const,
    subject: "Message from ZEBL HR",
    body: "Hi {{candidate_name}},\n\n{{message_body}}\n\nRegards,\nZEBL HR",
  },
] as const;

export const TARGETS = {
  candidates: 200,
  jobs: JOB_CATALOG.length,
  conversions: 20,
} as const;
