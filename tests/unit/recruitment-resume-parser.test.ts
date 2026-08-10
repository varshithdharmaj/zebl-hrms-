import { describe, expect, it } from "vitest";
import {
  detectResumeDocumentKind,
  extractEmails,
  extractGitHubUrls,
  extractLinkedInUrls,
  extractPhones,
  extractPortfolioUrls,
  normalizePhone,
  normalizeResumeDate,
  parseResumePlainText,
  parseResumeFromCleanText,
  normalizeParsedResumeDraft,
  matchSectionHeader,
} from "@/lib/recruitment/resume-import/parser";
import { cleanupResumeText } from "@/lib/recruitment/resume-import/parser/cleanup";

const SAMPLE_RESUME = `
Jane Marie Doe
Bengaluru, India
jane.doe@example.com | +91 98765 43210
https://linkedin.com/in/janedoe
https://github.com/janedoe

SUMMARY
Full-stack engineer with 6 years of experience building HR products.

EXPERIENCE
Senior Software Engineer at Northwind Labs
Jan 2022 – Present
Owned candidate profile workflows and document uploads.

Software Engineer at Contoso Soft
Jun 2019 – Dec 2021
Built internal REST APIs.

EDUCATION
B.Tech in Computer Science
State University
2015 – 2019

SKILLS
TypeScript, Node.js, React, PostgreSQL, TypeScript
`;

describe("resume parser patterns", () => {
  it("extracts email, phone, and linkedin", () => {
    const text = SAMPLE_RESUME;
    expect(extractEmails(text)[0]).toBe("jane.doe@example.com");
    expect(extractPhones(text)[0]).toMatch(/9876543210|919876543210|\+919876543210/);
    expect(extractLinkedInUrls(text)[0]).toMatch(/linkedin\.com\/in\/janedoe/i);
  });

  it("normalizes phones and dates", () => {
    expect(normalizePhone("+91 98765 43210")).toBe("+919876543210");
    expect(normalizePhone("555-0100")).toBeNull();
    expect(normalizeResumeDate("Jan 2022")).toBe("2022-01-01");
    expect(normalizeResumeDate("03/2020")).toBe("2020-03-01");
    expect(normalizeResumeDate("2019")).toBe("2019-01-01");
    expect(normalizeResumeDate("Present")).toBeNull();
  });

  it("detects pdf and docx kinds", () => {
    expect(detectResumeDocumentKind("cv.pdf", "application/pdf")).toBe("pdf");
    expect(
      detectResumeDocumentKind(
        "cv.docx",
        "application/vnd.openxmlformats.officedocument.wordprocessingml.document"
      )
    ).toBe("docx");
    expect(detectResumeDocumentKind("cv.doc", "application/msword")).toBe("unsupported");
    expect(detectResumeDocumentKind("photo.png", "image/png")).toBe("unsupported");
  });

  it("hardens GitHub URL extraction (www, punctuation, query, fragment, repo→profile)", () => {
    const text = `
Contact
www.github.com/janedoe/?tab=repositories#overview,
https://github.com/janedoe/my-app
`;
    const urls = extractGitHubUrls(text);
    expect(urls).toHaveLength(1);
    expect(urls[0]).toBe("https://github.com/janedoe");
  });

  it("rejects LinkedIn, GitHub, and LeetCode as portfolio", () => {
    const header = [
      "Alex Candidate",
      "https://linkedin.com/in/alex",
      "https://github.com/alex",
      "https://leetcode.com/alex",
    ];
    expect(
      extractPortfolioUrls(header.join("\n"), { headerLines: header })
    ).toEqual([]);
  });

  it("accepts labeled portfolio URL", () => {
    const header = [
      "Alex Candidate",
      "Portfolio: https://alex.dev",
      "https://leetcode.com/alex",
    ];
    const urls = extractPortfolioUrls(header.join("\n"), { headerLines: header });
    expect(urls[0]).toBe("https://alex.dev");
  });
});

describe("section aliases", () => {
  it("matches high-value project headings", () => {
    expect(matchSectionHeader("Projects")).toBe("projects");
    expect(matchSectionHeader("Personal Projects")).toBe("projects");
    expect(matchSectionHeader("Academic Projects")).toBe("projects");
    expect(matchSectionHeader("Selected Projects")).toBe("projects");
    expect(matchSectionHeader("Key Projects")).toBe("projects");
    expect(matchSectionHeader("Technical Projects")).toBe("projects");
    expect(matchSectionHeader("Relevant Projects")).toBe("projects");
  });

  it("matches high-value certification headings", () => {
    expect(matchSectionHeader("Certifications")).toBe("certifications");
    expect(matchSectionHeader("Certificates")).toBe("certifications");
    expect(matchSectionHeader("Licenses")).toBe("certifications");
    expect(matchSectionHeader("Professional Certifications")).toBe("certifications");
    expect(matchSectionHeader("Courses & Certifications")).toBe("certifications");
  });

  it("matches Phase C section aliases for messy/sparse templates", () => {
    expect(matchSectionHeader("Professional Journey")).toBe("experience");
    expect(matchSectionHeader("Where I've Worked")).toBe("experience");
    expect(matchSectionHeader("Where I've Been")).toBe("experience");
    expect(matchSectionHeader("Experience Snapshot")).toBe("experience");
    expect(matchSectionHeader("Skill Set")).toBe("skills");
    expect(matchSectionHeader("Stack")).toBe("skills");
    expect(matchSectionHeader("Platform Skills")).toBe("skills");
    expect(matchSectionHeader("Toolkit")).toBe("skills");
    expect(matchSectionHeader("Notable Projects")).toBe("projects");
    expect(matchSectionHeader("Things I Built")).toBe("projects");
    expect(matchSectionHeader("Builds")).toBe("projects");
    expect(matchSectionHeader("Education Details")).toBe("education");
    expect(matchSectionHeader("School")).toBe("education");
    expect(matchSectionHeader("Learning")).toBe("education");
    expect(matchSectionHeader("Credentials")).toBe("certifications");
  });

  it("matches summary / experience / education / skills aliases", () => {
    expect(matchSectionHeader("Career Summary")).toBe("summary");
    expect(matchSectionHeader("Career Profile")).toBe("summary");
    expect(matchSectionHeader("Professional Profile")).toBe("summary");
    expect(matchSectionHeader("Relevant Experience")).toBe("experience");
    expect(matchSectionHeader("Internship Experience")).toBe("experience");
    expect(matchSectionHeader("Internships")).toBe("experience");
    expect(matchSectionHeader("Career Timeline")).toBe("experience");
    expect(matchSectionHeader("Academics")).toBe("education");
    expect(matchSectionHeader("Academic History")).toBe("education");
    expect(matchSectionHeader("Core Skills")).toBe("skills");
    expect(matchSectionHeader("Tools & Technologies")).toBe("skills");
    expect(matchSectionHeader("Toolbox")).toBe("skills");
    expect(matchSectionHeader("Key Initiatives")).toBe("projects");
    expect(matchSectionHeader("Things I've Built")).toBe("projects");
  });

  it("still ignores awards/languages/volunteer/etc.", () => {
    expect(matchSectionHeader("Awards")).toBe("ignore");
    expect(matchSectionHeader("Achievements")).toBe("ignore");
    expect(matchSectionHeader("Languages")).toBe("ignore");
    expect(matchSectionHeader("Volunteer Work")).toBe("ignore");
    expect(matchSectionHeader("Publications")).toBe("ignore");
    expect(matchSectionHeader("References")).toBe("ignore");
    expect(matchSectionHeader("Interests")).toBe("ignore");
    expect(matchSectionHeader("Hobbies")).toBe("ignore");
    expect(matchSectionHeader("Contact")).toBe("ignore");
    expect(matchSectionHeader("Candidate Details")).toBe("ignore");
  });

  it("ignores additional-info / availability / compensation headers", () => {
    expect(matchSectionHeader("Additional Information")).toBe("ignore");
    expect(matchSectionHeader("Additional Info")).toBe("ignore");
    expect(matchSectionHeader("Personal Information")).toBe("ignore");
    expect(matchSectionHeader("Other Information")).toBe("ignore");
    expect(matchSectionHeader("Availability")).toBe("ignore");
    expect(matchSectionHeader("Notice Period")).toBe("ignore");
    expect(matchSectionHeader("Compensation")).toBe("ignore");
    expect(matchSectionHeader("Salary Details")).toBe("ignore");
  });
});

describe("experience Title, Company — City hardening", () => {
  it("parses Title, Company — City without assigning city as company", () => {
    const text = `
Priya Deshmukh
priya@example.com

EXPERIENCE
Backend Developer, Nimbuzz — Pune
March 2023 - Present
Built APIs.

Software Engineer, ZEBL Technologies — Hyderabad
2021 – 2023
Shipped services.

Senior Engineer, ABC Ltd — Bangalore
2019 – 2021
Led a squad.
`;
    const { draft } = parseResumeFromCleanText(text);
    const normalized = normalizeParsedResumeDraft(draft);
    expect(normalized.experiences).toHaveLength(3);
    expect(normalized.experiences[0]).toMatchObject({
      title: "Backend Developer",
      company: "Nimbuzz",
      location: "Pune",
    });
    expect(normalized.experiences[1]).toMatchObject({
      title: "Software Engineer",
      company: "ZEBL Technologies",
      location: "Hyderabad",
    });
    expect(normalized.experiences[2]).toMatchObject({
      title: "Senior Engineer",
      company: "ABC Ltd",
      location: "Bangalore",
    });
    for (const exp of normalized.experiences) {
      expect(exp.company.toLowerCase()).not.toMatch(
        /^(pune|hyderabad|bangalore)$/
      );
    }
  });

  it("supports Title, Company - City and Title, Company | City separators", () => {
    const text = `
Alex Dev
alex@example.com

EXPERIENCE
Backend Developer, Nimbuzz - Pune
2023 – Present

Software Engineer, ZEBL Technologies | Hyderabad
2021 – 2023
`;
    const { draft } = parseResumeFromCleanText(text);
    expect(draft.experiences[0]).toMatchObject({
      title: "Backend Developer",
      company: "Nimbuzz",
      location: "Pune",
    });
    expect(draft.experiences[1]).toMatchObject({
      title: "Software Engineer",
      company: "ZEBL Technologies",
      location: "Hyderabad",
    });
  });

  it("preserves Title — Company and Title at Company formats", () => {
    const text = `
Sam Patel
sam@example.com

EXPERIENCE
Software Engineer II — Meritvantage Technologies Pvt. Ltd.
2022 – Present
Built payroll.

Engineer at Alpha
2018 – 2019
Tools.
`;
    const { draft } = parseResumeFromCleanText(text);
    const normalized = normalizeParsedResumeDraft(draft);
    expect(normalized.experiences).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Software Engineer II",
          company: "Meritvantage Technologies Pvt. Ltd.",
        }),
        expect.objectContaining({
          title: "Engineer",
          company: "Alpha",
        }),
      ])
    );
  });

  it("parses Title — Company, City without rejecting the employer", () => {
    const text = `
Rohit Kumar Yadav
rohit@example.com

EXPERIENCE
Software Engineer — Trimora Infosystems, Lucknow
July 2025 – Present
Work on inventory tools.

Software Development Intern — Trimora Infosystems, Lucknow
January 2025 – June 2025
Assisted testing.
`;
    const { draft } = parseResumeFromCleanText(text);
    const normalized = normalizeParsedResumeDraft(draft);
    expect(normalized.experiences.length).toBeGreaterThanOrEqual(2);
    expect(normalized.experiences[0]).toMatchObject({
      title: "Software Engineer",
      company: "Trimora Infosystems",
      location: "Lucknow",
      isCurrent: true,
    });
  });
});

describe("metadata must not become skills or certifications", () => {
  it("ignores Additional Information notice/CTC blocks (resume-02 / T12 style)", () => {
    const text = `
Meera Natarajan
meera@example.com

EXPERIENCE
Backend Engineer — Infovista Softwares
2022 – Present
Built payment APIs.

SKILLS
Java, Spring Boot, MySQL

ADDITIONAL INFORMATION
Notice Period: 90 days
Current CTC: 12 LPA
Expected CTC: 18 LPA
Available to join immediately
Immediate joiner: No

CERTIFICATIONS
Oracle Certified Java Programmer
AWS Certified Solutions Architect — Amazon — 2024
`;
    const { draft } = parseResumeFromCleanText(text);
    const normalized = normalizeParsedResumeDraft(draft);
    const skillBlob = normalized.skills.join(" | ").toLowerCase();
    expect(skillBlob).not.toMatch(/notice/);
    expect(skillBlob).not.toMatch(/ctc/);
    expect(skillBlob).not.toMatch(/lpa/);
    expect(skillBlob).not.toMatch(/available to join/);
    expect(normalized.skills).toEqual(
      expect.arrayContaining(["Java", "Spring Boot", "MySQL"])
    );

    const certBlob = normalized.certifications
      .map((c) => `${c.name} ${c.issuer ?? ""}`)
      .join(" | ")
      .toLowerCase();
    expect(certBlob).not.toMatch(/notice/);
    expect(certBlob).not.toMatch(/ctc/);
    expect(certBlob).not.toMatch(/additional info/);
    expect(normalized.certifications.some((c) => /oracle/i.test(c.name))).toBe(
      true
    );
    expect(normalized.certifications.some((c) => /aws/i.test(c.name))).toBe(
      true
    );
  });

  it("rejects notice/CTC/availability lines even if they land inside Skills/Certs sections", () => {
    const text = `
Dev User
dev@example.com

SKILLS
TypeScript, React
Notice Period: 45 days
Expected CTC: 12 LPA
Availability: Immediate
Availability API
Salary Prediction Model
Joining API

CERTIFICATIONS
Notice Period: 45 days
Expected CTC: 12 LPA
Availability: Immediate
Google Professional Cloud Architect — Google — 2023
`;
    const { draft } = parseResumeFromCleanText(text);
    const normalized = normalizeParsedResumeDraft(draft);
    expect(normalized.skills).toEqual(
      expect.arrayContaining([
        "TypeScript",
        "React",
        "Availability API",
        "Salary Prediction Model",
        "Joining API",
      ])
    );
    expect(normalized.skills.join(" ")).not.toMatch(/Notice Period/i);
    expect(normalized.skills.join(" ")).not.toMatch(/Expected CTC/i);
    expect(normalized.skills).not.toContain("Availability");

    expect(normalized.certifications).toHaveLength(1);
    expect(normalized.certifications[0]?.name).toMatch(/Cloud Architect/i);
  });
});

describe("parseResumeFromCleanText", () => {
  it("parses a structured multi-section resume", () => {
    const { draft, warnings } = parseResumeFromCleanText(SAMPLE_RESUME);
    const normalized = normalizeParsedResumeDraft(draft);

    expect(normalized.personal.fullName).toMatch(/Jane/i);
    expect(normalized.personal.email).toBe("jane.doe@example.com");
    expect(normalized.personal.linkedinUrl).toMatch(/linkedin\.com\/in\/janedoe/i);
    expect(normalized.personal.githubUrl).toBe("https://github.com/janedoe");
    expect(normalized.professional.summary).toMatch(/Full-stack/i);
    expect(normalized.professional.totalExperienceYears).toBe("6");
    expect(normalized.experiences.length).toBeGreaterThanOrEqual(2);
    expect(normalized.experiences.some((e) => e.isCurrent)).toBe(true);
    expect(normalized.educations.length).toBeGreaterThanOrEqual(1);
    expect(normalized.educations[0]?.institution).toMatch(/State University/i);
    expect(normalized.educations[0]?.field).toMatch(/Computer Science/i);
    expect(normalized.skills).toContain("TypeScript");
    expect(normalized.skills.filter((s) => s.toLowerCase() === "typescript")).toHaveLength(1);
    expect(warnings.length).toBeGreaterThanOrEqual(0);
  });

  it("handles missing sections without crashing", () => {
    const text = `
Alex Rivera
alex@example.com
+1 555 0100 9999
`;
    const { draft } = parseResumeFromCleanText(text);
    expect(draft.personal.email).toBe("alex@example.com");
    expect(draft.experiences).toEqual([]);
    expect(draft.educations).toEqual([]);
    expect(draft.skills).toEqual([]);
    expect(draft.projects).toEqual([]);
    expect(draft.certifications).toEqual([]);
  });

  it("handles empty resume", () => {
    const { draft, warnings } = parseResumeFromCleanText("   \n\n  ");
    expect(draft.personal.fullName).toBeNull();
    expect(warnings.some((w) => /no extractable text/i.test(w))).toBe(true);
  });

  it("parses multiple experiences and education entries", () => {
    const text = `
Sam Patel
sam@example.com

EXPERIENCE
Engineer at Alpha
2020 – 2021
Built APIs.

Engineer at Beta
2022 – Present
Led hiring tools.

EDUCATION
B.Sc Computer Science
City College
2016

MBA
Business School
2020

SKILLS
Go, Python, SQL
`;
    const { draft } = parseResumeFromCleanText(text);
    const normalized = normalizeParsedResumeDraft(draft);
    expect(normalized.experiences.length).toBeGreaterThanOrEqual(2);
    expect(normalized.educations.length).toBeGreaterThanOrEqual(2);
    expect(normalized.skills.length).toBe(3);
  });

  it("dedupes duplicate skills and experiences", () => {
    const text = `
Casey Lee
casey@example.com

EXPERIENCE
Developer at Acme
2020 – 2021

Developer at Acme
2020 – 2021

SKILLS
React, react, Node.js, node.js
`;
    const { draft } = parseResumeFromCleanText(text);
    const normalized = normalizeParsedResumeDraft(draft);
    expect(normalized.experiences).toHaveLength(1);
    expect(normalized.skills.map((s) => s.toLowerCase()).sort()).toEqual([
      "node.js",
      "react",
    ]);
  });

  it("parses Projects section with tech, duration, and bullets", () => {
    const text = `
Dev User
dev@example.com

PROJECTS
Employee Management System
Tech: React, Node.js, PostgreSQL
Jan 2025 – Mar 2025
- Built an employee management system
- Implemented authentication
`;
    const { draft } = parseResumeFromCleanText(text);
    const normalized = normalizeParsedResumeDraft(draft);
    expect(normalized.projects.length).toBe(1);
    expect(normalized.projects[0]?.title).toMatch(/Employee Management System/i);
    expect(normalized.projects[0]?.techStack).toMatch(/React/i);
    expect(normalized.projects[0]?.duration).toMatch(/2025/i);
    expect(normalized.projects[0]?.summary).toMatch(/authentication/i);
  });

  it("parses Personal Projects and Academic Projects headings", () => {
    const text = `
Dev User
dev@example.com

PERSONAL PROJECTS
Chat App | https://github.com/dev/chat-app
- Real-time messaging

ACADEMIC PROJECTS
Library Portal — 2024
Tech: Java, MySQL
`;
    const { draft } = parseResumeFromCleanText(text);
    const normalized = normalizeParsedResumeDraft(draft);
    expect(normalized.projects.length).toBeGreaterThanOrEqual(2);
    expect(normalized.projects.some((p) => /Chat App/i.test(p.title))).toBe(true);
    expect(normalized.projects.some((p) => /Library Portal/i.test(p.title))).toBe(true);
    // Project repo must not become Candidate.githubUrl
    expect(normalized.personal.githubUrl).toBeNull();
  });

  it("dedupes projects by title+url", () => {
    const text = `
Dev User
dev@example.com

PROJECTS
Same Project
https://github.com/dev/same

Same Project
https://github.com/dev/same
`;
    const { draft } = parseResumeFromCleanText(text);
    const normalized = normalizeParsedResumeDraft(draft);
    expect(normalized.projects).toHaveLength(1);
  });

  it("does not consume experience bullets as projects", () => {
    const text = `
Dev User
dev@example.com

EXPERIENCE
Engineer at Acme
2020 – 2021
- Built payroll module
- Shipped APIs

SKILLS
Node.js
`;
    const { draft } = parseResumeFromCleanText(text);
    expect(draft.projects).toEqual([]);
    expect(draft.experiences[0]?.description).toMatch(/payroll/i);
  });

  it("parses Certifications / Certificates / Licenses", () => {
    // Only one section wins in a real resume; test each heading separately via aliases.
    const aws = parseResumeFromCleanText(`
Dev User
dev@example.com
CERTIFICATIONS
AWS Solutions Architect Associate — Amazon — 2025
`);
    expect(aws.draft.certifications[0]?.name).toMatch(/AWS Solutions Architect/i);
    expect(aws.draft.certifications[0]?.issuer).toMatch(/Amazon/i);
    expect(aws.draft.certifications[0]?.issuedAt).toMatch(/2025/);

    const certs = parseResumeFromCleanText(`
Dev User
dev@example.com
CERTIFICATES
Google Cloud Associate | Google | 2024
`);
    expect(certs.draft.certifications[0]?.name).toMatch(/Google Cloud/i);

    const licenses = parseResumeFromCleanText(`
Dev User
dev@example.com
LICENSES
Professional Engineer License
State Board
2023
`);
    const lic = normalizeParsedResumeDraft(licenses.draft);
    expect(lic.certifications[0]?.name).toMatch(/Professional Engineer/i);
    expect(lic.certifications[0]?.issuer).toMatch(/State Board/i);
  });

  it("dedupes certifications by name+issuer", () => {
    const text = `
Dev User
dev@example.com

CERTIFICATIONS
AWS SAA — Amazon — 2025
AWS SAA — Amazon — 2025
`;
    const normalized = normalizeParsedResumeDraft(
      parseResumeFromCleanText(text).draft
    );
    expect(normalized.certifications).toHaveLength(1);
  });

  it("strips skill category labels", () => {
    const text = `
Dev User
dev@example.com

SKILLS
Languages:
Python, Java, C++
Frameworks:
React, Next.js
Databases:
PostgreSQL, MongoDB
`;
    const normalized = normalizeParsedResumeDraft(
      parseResumeFromCleanText(text).draft
    );
    expect(normalized.skills).toEqual(
      expect.arrayContaining([
        "Python",
        "Java",
        "C++",
        "React",
        "Next.js",
        "PostgreSQL",
        "MongoDB",
      ])
    );
    expect(normalized.skills.some((s) => /^languages?$/i.test(s))).toBe(false);
    expect(normalized.skills.some((s) => /^frameworks?$/i.test(s))).toBe(false);
    expect(normalized.skills.some((s) => /^databases?$/i.test(s))).toBe(false);
  });

  it("recognizes BCA, MCA, B.Com, PGDM and field of study", () => {
    const text = `
Student One
student@example.com

EDUCATION
BCA - Computer Applications
City College
2020

MCA
Tech Institute
2022

B.Com in Accounting
Commerce College
2018

PGDM
Business School
2021
`;
    const normalized = normalizeParsedResumeDraft(
      parseResumeFromCleanText(text).draft
    );
    const degrees = normalized.educations.map((e) => e.degree?.toUpperCase());
    expect(degrees.some((d) => d?.includes("BCA"))).toBe(true);
    expect(degrees.some((d) => d?.includes("MCA"))).toBe(true);
    expect(degrees.some((d) => d?.includes("COM"))).toBe(true);
    expect(degrees.some((d) => d?.includes("PGDM"))).toBe(true);
    expect(
      normalized.educations.some((e) => /Computer Applications/i.test(e.field ?? ""))
    ).toBe(true);
    expect(
      normalized.educations.some((e) => /Accounting/i.test(e.field ?? ""))
    ).toBe(true);
  });
});

describe("Phase A precision — headline / experience / identity", () => {
  it("Test 1: name must not become headline; header title becomes headline", () => {
    const text = `
Jane Doe
Software Engineer
Bengaluru
jane@example.com
+91 98765 43210
`;
    const { draft } = parseResumeFromCleanText(text);
    const mapped = parseResumePlainText(text).draftContent.mapped;
    expect(draft.personal.fullName).toMatch(/Jane Doe/i);
    expect(draft.professional.headline).toBe("Software Engineer");
    expect(mapped.professional.headline).toBe("Software Engineer");
    expect(mapped.professional.headline).not.toMatch(/Jane Doe/i);
  });

  it("Test 2: name must not become experience without employment evidence", () => {
    const text = `
EXPERIENCE

Jane Doe
Bengaluru
2022 – Present
`;
    const { draft } = parseResumeFromCleanText(text);
    expect(draft.experiences).toEqual([]);
    expect(draft.experiences.some((e) => /Jane Doe/i.test(e.title))).toBe(false);
    expect(draft.experiences.some((e) => /Jane Doe/i.test(e.company))).toBe(false);
  });

  it("Test 3: project must not become experience when under PROJECTS", () => {
    const text = `
Jane Doe
jane@example.com

EXPERIENCE

Software Engineer — ABC Technologies
Jan 2023 – Present

PROJECTS

Employee Management System
React, Node.js, PostgreSQL
`;
    const { draft } = parseResumeFromCleanText(text);
    const normalized = normalizeParsedResumeDraft(draft);
    expect(normalized.experiences).toHaveLength(1);
    expect(normalized.experiences[0]).toMatchObject({
      title: "Software Engineer",
      company: "ABC Technologies",
    });
    expect(normalized.projects.some((p) => /Employee Management System/i.test(p.title))).toBe(
      true
    );
    expect(
      normalized.experiences.some((e) => /Employee Management System/i.test(e.company))
    ).toBe(false);
  });

  it("Test 4: project-like block without employment evidence stays out of experience", () => {
    const text = `
Dev User
dev@example.com

EDUCATION
B.Tech in Computer Science
State University
2020

Employee Management System
React, Node.js
Built a portal for HR
`;
    const { draft } = parseResumeFromCleanText(text);
    expect(
      draft.experiences.some((e) => /Employee Management System/i.test(e.company))
    ).toBe(false);
    expect(draft.experiences.some((e) => /React/i.test(e.title))).toBe(false);
  });

  it("Test 5: currentTitle uses Present role", () => {
    const text = `
Alex Rivera
alex@example.com

EXPERIENCE
Software Engineer — ABC
Jan 2024 – Present

Junior Developer — XYZ
2022 – 2023
`;
    const { draft } = parseResumeFromCleanText(text);
    expect(draft.professional.currentTitle).toBe("Software Engineer");
    expect(draft.professional.currentCompany).toBe("ABC");
  });

  it("Test 6: without Present, fully ended history leaves current empty", () => {
    const text = `
Alex Rivera
alex@example.com

EXPERIENCE
Software Engineer — ABC
2021 – 2022

Developer — XYZ
2019 – 2021
`;
    const { draft } = parseResumeFromCleanText(text);
    expect(draft.professional.currentTitle).toBeNull();
    expect(draft.professional.currentCompany).toBeNull();
  });

  it("Test 7: academic projects must not become employment", () => {
    const text = `
Student One
student@example.com

Academic Projects
Employee Management System
React
Node.js

Education
B.Tech in Computer Science
State University
2022 – 2026
`;
    const { draft } = parseResumeFromCleanText(text);
    expect(draft.experiences).toEqual([]);
    expect(draft.projects.some((p) => /Employee Management System/i.test(p.title))).toBe(
      true
    );
  });

  it("Test 8: education must not become experience", () => {
    const text = `
Student One
student@example.com

EDUCATION

B.Tech in Computer Science
VNR VJIET
2022 – 2026
`;
    const { draft } = parseResumeFromCleanText(text);
    expect(draft.experiences).toEqual([]);
    expect(draft.educations.length).toBeGreaterThanOrEqual(1);
    expect(draft.educations[0]?.degree).toMatch(/B\.?Tech/i);
  });

  it('Test 9: valid experience bullet containing "system" stays employment', () => {
    const text = `
Alex Rivera
alex@example.com

EXPERIENCE

Software Engineer — ABC
2024 – Present
Built Employee Management System
`;
    const { draft } = parseResumeFromCleanText(text);
    expect(draft.experiences).toHaveLength(1);
    expect(draft.experiences[0]).toMatchObject({
      title: "Software Engineer",
      company: "ABC",
    });
    expect(draft.experiences[0]?.description).toMatch(/Employee Management System/i);
    expect(draft.projects).toEqual([]);
  });

  it("Test 10: headline is null when unsupported", () => {
    const text = `
Jane Doe
jane@example.com
Bengaluru
`;
    const { draft } = parseResumeFromCleanText(text);
    const mapped = parseResumePlainText(text).draftContent.mapped;
    expect(draft.personal.fullName).toMatch(/Jane Doe/i);
    expect(draft.professional.headline).toBeNull();
    expect(mapped.professional.headline).toBeNull();
  });

  it("does not set currentTitle from experiences[0] when undated", () => {
    const text = `
Alex Rivera
alex@example.com

EXPERIENCE
Software Engineer — ABC
Built APIs.

Developer — XYZ
Tools.
`;
    const { draft } = parseResumeFromCleanText(text);
    expect(draft.experiences.length).toBeGreaterThanOrEqual(2);
    expect(draft.professional.currentTitle).toBeNull();
    expect(draft.professional.currentCompany).toBeNull();
  });

  it("does not alias headline from currentTitle in mapped draft", () => {
    const text = `
Alex Rivera
alex@example.com

EXPERIENCE
Software Engineer — ABC
Jan 2024 – Present
`;
    const { draftContent } = parseResumePlainText(text);
    expect(draftContent.mapped.professional.currentTitle).toBe("Software Engineer");
    expect(draftContent.mapped.professional.headline).toBeNull();
  });
});

describe("Phase A+ — sidebar identity, SRE roles, messy sections", () => {
  it("does not use CONTACT chrome as name; finds sidebar identity + headline", () => {
    const text = `
CONTACT
Mumbai, Maharashtra
rahul.kapoor.pm@proresumemail.com
+91 96001 22334
linkedin.com/in/rahul-kapoor-pm
SKILLS
• Product Roadmapping
• Jira
EDUCATION
MBA
Indian Institute of Management (IIM) Kozhikode, 2015 – 2017
LANGUAGES
English (Fluent)
Rahul Kapoor
Senior Product Manager | B2B SaaS
SUMMARY
Senior Product Manager with experience.
EXPERIENCE
Senior Product Manager — Nexbridge Software
Mumbai, India | May 2022 – Present
• Own product strategy.
KEY INITIATIVES
Self-Serve Billing Revamp
• Led a redesign.
`;
    const { draft } = parseResumeFromCleanText(text);
    const normalized = normalizeParsedResumeDraft(draft);
    expect(normalized.personal.fullName).toMatch(/Rahul Kapoor/i);
    expect(normalized.personal.fullName).not.toMatch(/contact/i);
    expect(normalized.professional.headline).toMatch(/Product Manager/i);
    expect(normalized.personal.location).toMatch(/Mumbai/i);
    expect(normalized.professional.currentTitle).toMatch(/Senior Product Manager/i);
    expect(normalized.professional.currentCompany).toMatch(/Nexbridge/i);
    expect(normalized.projects.some((p) => /Self-Serve Billing/i.test(p.title))).toBe(
      true
    );
    expect(normalized.projects.some((p) => /Candidate Details/i.test(p.title))).toBe(
      false
    );
  });

  it("parses SRE II — Company, City, Country as current role (b02)", () => {
    const text = `
Ritika Bose
Site Reliability Engineer | SLOs, Observability & Automation
Bengaluru, Karnataka | ritika.bose.sre@webmailpro.net | +91 90123 45871

EXPERIENCE
SRE II — Skyvault Cloud, Bengaluru, India
Jan 2023 – Present
Own SLOs for critical services.

Systems Engineer — Ironpeak Systems, Bengaluru, India
Aug 2019 – Dec 2022
Administered Linux fleets.
`;
    const { draft } = parseResumeFromCleanText(text);
    const normalized = normalizeParsedResumeDraft(draft);
    expect(normalized.personal.fullName).toMatch(/Ritika Bose/i);
    expect(normalized.personal.location).toMatch(/Bengaluru/i);
    expect(normalized.experiences.length).toBeGreaterThanOrEqual(2);
    expect(normalized.experiences[0]).toMatchObject({
      title: "SRE II",
      company: "Skyvault Cloud",
      isCurrent: true,
    });
    expect(normalized.professional.currentTitle).toBe("SRE II");
    expect(normalized.professional.currentCompany).toBe("Skyvault Cloud");
  });

  it("maps Career Timeline / Toolbox / Things I've Built sections", () => {
    const text = `
Karthik Shetty
Android Developer
Chennai, Tamil Nadu
karthik@example.com

PROFILE
Android developer based in Chennai.

CAREER TIMELINE
Android Developer @ Arclight Technologies, Chennai
05/2022 – Present
* Leading the Android module.

Junior Android Developer, Nexbridge Software — Chennai
Jun 2020 – Apr 2022
* Built UI screens.

TOOLBOX
Kotlin, Jetpack Compose, Room

THINGS I'VE BUILT
ExpenseSnap
A personal finance tracker app.

QUALIFICATIONS
B.E., Electronics and Communication, Anna University, 2014–2018
`;
    const { draft } = parseResumeFromCleanText(text);
    const normalized = normalizeParsedResumeDraft(draft);
    expect(normalized.experiences.length).toBeGreaterThanOrEqual(1);
    expect(
      normalized.experiences.some(
        (e) =>
          /Android Developer/i.test(e.title) && /Arclight/i.test(e.company)
      )
    ).toBe(true);
    expect(normalized.skills.join(" ")).toMatch(/Kotlin/i);
    expect(normalized.projects.some((p) => /ExpenseSnap/i.test(p.title))).toBe(true);
    expect(
      normalized.educations.some((e) => /Anna University/i.test(e.institution))
    ).toBe(true);
  });

  it("keeps project description out of project titles and ignores Candidate Details", () => {
    const text = `
Dev User
dev@example.com

PROJECTS
Chaos Testing Framework (Python, Kubernetes, Litmus)
Built an internal chaos-engineering tool run before major releases to surface resilience gaps.
CANDIDATE DETAILS
• Total Experience: 6 years
`;
    const { draft } = parseResumeFromCleanText(text);
    const normalized = normalizeParsedResumeDraft(draft);
    expect(normalized.projects).toHaveLength(1);
    expect(normalized.projects[0]?.title).toMatch(/Chaos Testing Framework/i);
    expect(normalized.projects[0]?.title).not.toMatch(/^Built /i);
    expect(normalized.experiences).toEqual([]);
  });

  it("parses B.Des education with institution (not degree-as-institution)", () => {
    const text = `
Shreya Menon
shreya@example.com

EDUCATION
B.Des
National Institute of Design (NID), Ahmedabad, 2017 – 2021
`;
    const { draft } = parseResumeFromCleanText(text);
    const normalized = normalizeParsedResumeDraft(draft);
    expect(normalized.educations.length).toBe(1);
    expect(normalized.educations[0]?.degree).toMatch(/B\.?Des/i);
    expect(normalized.educations[0]?.institution).toMatch(/National Institute of Design/i);
    expect(normalized.experiences).toEqual([]);
  });

  it("preserves Phase A: employment bullet with system ≠ project-as-experience", () => {
    const text = `
Alex Rivera
alex@example.com

EXPERIENCE
Software Engineer — ABC Technologies
Jan 2024 – Present
Built an Employee Management System.

PROJECTS
Employee Management System
React, Node.js, PostgreSQL
`;
    const { draft } = parseResumeFromCleanText(text);
    const normalized = normalizeParsedResumeDraft(draft);
    expect(normalized.experiences).toHaveLength(1);
    expect(normalized.experiences[0]).toMatchObject({
      title: "Software Engineer",
      company: "ABC Technologies",
    });
    expect(
      normalized.experiences.some((e) =>
        /Employee Management System/i.test(e.company)
      )
    ).toBe(false);
    expect(
      normalized.projects.some((p) => /Employee Management System/i.test(p.title))
    ).toBe(true);
  });
});

describe("parseResumePlainText pipeline", () => {
  it("produces merge-engine-ready draft content with projects/certs when present", () => {
    const text = `
Jane Marie Doe
jane.doe@example.com
Portfolio: https://jane.dev

SUMMARY
Engineer.

PROJECTS
HRMS
Tech: Next.js, PostgreSQL

CERTIFICATIONS
AWS SAA — Amazon — 2024
`;
    const { result, draftContent } = parseResumePlainText(text, "doc-99");
    expect(result.ok).toBe(true);
    expect(draftContent.source).toBe("parser");
    expect(draftContent.documentId).toBe("doc-99");
    expect(draftContent.mapped.personal.email).toBe("jane.doe@example.com");
    expect(draftContent.mapped.professional.portfolioUrl).toBe("https://jane.dev");
    expect(draftContent.mapped.projects.length).toBeGreaterThanOrEqual(1);
    expect(draftContent.mapped.certifications.length).toBeGreaterThanOrEqual(1);
    expect(draftContent.metadata.parserVersion).toBeTruthy();
  });

  it("returns structured error for empty text without throwing", () => {
    const { result, draftContent } = parseResumePlainText("");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("EMPTY_DOCUMENT");
    }
    expect(draftContent.mapped.personal.fullName).toBeNull();
  });
});

describe("Phase C — golden corpus hardening", () => {
  it("parses Professional Journey / Notable Projects aliases with employment evidence", () => {
    const text = `
MANISH AGARWAL
Java Backend Developer
manish@example.com

PROFILE
Backend developer.

PROFESSIONAL JOURNEY
Senior Java Developer, Ironpeak Systems — Indore
03/2023 – Present
* Leading backend development.

Java Developer @ Silverline Technologies, Indore
Jul 2019 – Feb 2023
* Built REST APIs.

SKILL SET
Java, Spring Boot, Kafka

NOTABLE PROJECTS
Policy Rules Engine
A configurable rules engine.

EDUCATION DETAILS
B.E., Computer Science, Shri Govindram Seksaria Institute of Technology and Science (SGSITS), Indore, 2015-2019
`;
    const { draft } = parseResumeFromCleanText(text);
    const n = normalizeParsedResumeDraft(draft);
    expect(n.experiences.length).toBeGreaterThanOrEqual(2);
    expect(
      n.experiences.some(
        (e) => /Senior Java Developer/i.test(e.title) && /Ironpeak/i.test(e.company)
      )
    ).toBe(true);
    expect(n.professional.currentTitle).toMatch(/Senior Java Developer/i);
    expect(n.projects.some((p) => /Policy Rules Engine/i.test(p.title))).toBe(true);
    expect(n.projects.every((p) => !/\.\s*$/.test(p.title))).toBe(true);
  });

  it("parses DBA and Technical Writer roles; rejects project description titles", () => {
    const text = `
Rohan Nair
rohan@example.com

Work Experience
Senior DBA, Silverline Technologies — Hyderabad, India
Apr 2021 – Present
Manage production databases.

DBA, Crestwave Technologies — Hyderabad, India
Jun 2018 – Mar 2021
Performed tuning.

Projects
Automated Backup Verification Tool
Script-based tool verifying backup restorability weekly; caught 2 corrupted backups before they became critical.
critical.

Education
B.Tech, Computer Science — JNTU Hyderabad, 2014 – 2018
`;
    const { draft } = parseResumeFromCleanText(text);
    const n = normalizeParsedResumeDraft(draft);
    expect(n.experiences.some((e) => /\bDBA\b/i.test(e.title))).toBe(true);
    expect(n.projects).toHaveLength(1);
    expect(n.projects[0]?.title).toMatch(/Automated Backup/i);
    expect(n.educations.some((e) => /JNTU/i.test(e.institution))).toBe(true);
    expect(
      n.educations.every((e) => !/Computer Science\s*[—–-]/.test(e.institution))
    ).toBe(true);
  });

  it("never promotes name/project/education into unsafe fields", () => {
    const text = `
Priya Sharma
priya@example.com

EXPERIENCE
Software Engineer at Contoso Soft
Jan 2022 – Present

EDUCATION
B.Sc, Statistics — Presidency University, 2018

PROJECTS
Retail Sales Dashboard
Built a dashboard for retail KPIs.
dataset.
`;
    const { draft } = parseResumeFromCleanText(text);
    const n = normalizeParsedResumeDraft(draft);
    expect(n.professional.headline).not.toBe("Priya Sharma");
    expect(n.experiences.every((e) => !/Presidency/i.test(e.company))).toBe(true);
    expect(n.experiences.every((e) => !/Retail Sales/i.test(e.company))).toBe(true);
    expect(n.projects.every((p) => p.title !== "dataset.")).toBe(true);
    expect(n.projects.every((p) => !/^Built\b/i.test(p.title))).toBe(true);
    expect(
      n.educations.some(
        (e) => /Presidency University/i.test(e.institution) && /Statistics/i.test(e.field ?? "")
      )
    ).toBe(true);
  });
});

describe("cleanupResumeText", () => {
  it("collapses whitespace", () => {
    expect(cleanupResumeText("A\r\n\r\n\r\nB\t\tC")).toBe("A\n\nB C");
  });
});

describe("extractResumeText guards", () => {
  it("rejects unsupported and empty buffers via detect + plain pipeline", async () => {
    const { extractResumeText } = await import(
      "@/lib/recruitment/resume-import/parser/extract-text"
    );
    const unsupported = await extractResumeText({
      content: Buffer.from("hello"),
      fileName: "notes.txt",
      mimeType: "text/plain",
    });
    expect(unsupported.ok).toBe(false);
    if (!unsupported.ok) {
      expect(unsupported.error.code).toBe("UNSUPPORTED_TYPE");
    }

    const empty = await extractResumeText({
      content: Buffer.alloc(0),
      fileName: "cv.pdf",
      mimeType: "application/pdf",
    });
    expect(empty.ok).toBe(false);
    if (!empty.ok) {
      expect(empty.error.code).toBe("EMPTY_DOCUMENT");
    }
  });
});
