import { describe, expect, it } from "vitest";
import {
  collectNarrativeEducations,
  collectNarrativeExperiences,
  parseNarrativeEducationLine,
  parseNarrativeExperienceLine,
} from "@/lib/recruitment/resume-import/parser/narrative-strategies";
import { parseResumePlainText } from "@/lib/recruitment/resume-import/parser";

describe("parseNarrativeExperienceLine", () => {
  it("extracts title, company, and dates from 'Worked as X at Y from...to' form", () => {
    const result = parseNarrativeExperienceLine(
      "Worked as HR Recruiter at Skygamut Solutions Pvt Ltd 2024 to 2026."
    );
    expect(result).toEqual({
      title: "HR Recruiter",
      company: "Skygamut Solutions Pvt Ltd",
      location: null,
      startDate: "2024-01-01",
      endDate: "2026-01-01",
      isCurrent: false,
      description: null,
    });
  });

  it("never invents a company when the sentence has none — 'Working as X 2016 to 2024'", () => {
    const result = parseNarrativeExperienceLine(
      "Working as Assistant Proffesor 2016 to  2024."
    );
    expect(result).not.toBeNull();
    expect(result!.company).toBe("");
    expect(result!.title).toBe("Assistant Proffesor");
    expect(result!.startDate).toBe("2016-01-01");
    expect(result!.endDate).toBe("2024-01-01");
  });

  it("matches '{title} at {company} {dateRange}' without a worked/working prefix", () => {
    const result = parseNarrativeExperienceLine(
      "Backend Engineer at Contoso Soft 2020 to 2023"
    );
    expect(result).not.toBeNull();
    expect(result!.title).toBe("Backend Engineer");
    expect(result!.company).toBe("Contoso Soft");
  });

  it("requires an explicit date range — bare prose is not treated as employment", () => {
    expect(
      parseNarrativeExperienceLine("Worked as a team player in fast-paced environments.")
    ).toBeNull();
  });

  it("requires a job-title signal in the title clause", () => {
    expect(
      parseNarrativeExperienceLine("Worked as a good person 2016 to 2024.")
    ).toBeNull();
  });

  it("does not swallow a trailing organization word into the date (regression: 'Ltd 2024' bug)", () => {
    const result = parseNarrativeExperienceLine(
      "Worked as Recruiter at Example Staffing Ltd 2019 to 2021."
    );
    expect(result).not.toBeNull();
    expect(result!.company).toBe("Example Staffing Ltd");
    expect(result!.startDate).toBe("2019-01-01");
  });
});

describe("collectNarrativeExperiences", () => {
  it("collects every matching narrative sentence in a headerless body", () => {
    const lines = [
      "Working as Assistant Proffesor 2016 to  2024.",
      "Worked as HR Recruiter at Skygamut Solutions Pvt Ltd 2024 to 2026.",
      "Not a role sentence at all.",
    ];
    const experiences = collectNarrativeExperiences(lines);
    expect(experiences).toHaveLength(2);
    expect(experiences[0]!.title).toBe("Assistant Proffesor");
    expect(experiences[0]!.company).toBe("");
    expect(experiences[1]!.title).toBe("HR Recruiter");
    expect(experiences[1]!.company).toBe("Skygamut Solutions Pvt Ltd");
  });
});

describe("parseNarrativeEducationLine", () => {
  it("extracts degree and institution from '{degree} from {institution} with {percentage}'", () => {
    const result = parseNarrativeEducationLine(
      "M. Pharmacy from Teegala Ram Reddy College of Pharmacy JNTU wih (82.56%) Pharmaceutical -Dept."
    );
    expect(result).not.toBeNull();
    expect(result!.degree).toBe("M. Pharmacy");
    expect(result!.institution).toBe("Teegala Ram Reddy College of Pharmacy JNTU");
  });

  it("handles the correctly-spelled 'with' clause too", () => {
    const result = parseNarrativeEducationLine(
      "Intermediate BiPC from New Vision Junior College Mahabubnagar with 68.80%."
    );
    expect(result).not.toBeNull();
    expect(result!.degree).toBe("Intermediate BiPC");
    expect(result!.institution).toBe("New Vision Junior College Mahabubnagar");
  });

  it("recognizes S.S.C as a degree-level keyword", () => {
    const result = parseNarrativeEducationLine(
      "S.S.C from Rishi Vidyalaya, secondary education Mahabubnagar with 83%."
    );
    expect(result).not.toBeNull();
    expect(result!.institution).toBe("Rishi Vidyalaya, secondary education Mahabubnagar");
  });

  it("requires a degree-like keyword before 'from' — unrelated prose is not education", () => {
    expect(
      parseNarrativeEducationLine("I moved from Hyderabad to Bangalore for this role.")
    ).toBeNull();
  });
});

describe("collectNarrativeEducations", () => {
  it("collects all narrative education sentences", () => {
    const lines = [
      "M. Pharmacy from Teegala Ram Reddy College of Pharmacy JNTU wih (82.56%) Pharmaceutical -Dept.",
      "B. Pharmacy from Dhanvantari college of Pharmacy Mahabubnagar, JNTU wih 69.80%.",
      "Intermediate BiPC from New Vision Junior College Mahabubnagar with 68.80%.",
      "S.S.C from Rishi Vidyalaya, secondary education Mahabubnagar with 83%.",
    ];
    expect(collectNarrativeEducations(lines)).toHaveLength(4);
  });
});

describe("headerless narrative resume — full pipeline regression (Deepika case)", () => {
  const text = `
Name: Test Candidate
Mobile: 9000000000
Email: test.candidate@example.com

To seek a challenging career in the field of human resource.

Good experience in hiring and recruitment lifecycle management.

M. Pharmacy from Teegala Ram Reddy College of Pharmacy JNTU wih (82.56%) Pharmaceutical -Dept.
B. Pharmacy from Dhanvantari college of Pharmacy Mahabubnagar, JNTU wih 69.80%.
Intermediate BiPC from New Vision Junior College Mahabubnagar with 68.80%.
S.S.C from Rishi Vidyalaya, secondary education Mahabubnagar with 83%.

Working as Assistant Proffesor 2016 to  2024.
Worked as HR Recruiter at Skygamut Solutions Pvt Ltd 2024 to 2026.

Roles & Responsibilities:
Handling End-to-End recruitment process for IT and Non IT roles.
`;

  it("extracts both narrative experience records with no invented company", () => {
    const { result } = parseResumePlainText(text);
    expect(result.ok).toBe(true);
    expect(result.draft.experiences).toHaveLength(2);

    const professor = result.draft.experiences.find((e) =>
      e.title.includes("Proffesor")
    );
    expect(professor).toBeDefined();
    expect(professor!.company).toBe("");
    expect(professor!.startDate).toBe("2016-01-01");
    expect(professor!.endDate).toBe("2024-01-01");

    const recruiter = result.draft.experiences.find((e) => e.title === "HR Recruiter");
    expect(recruiter).toBeDefined();
    expect(recruiter!.company).toBe("Skygamut Solutions Pvt Ltd");
    expect(recruiter!.startDate).toBe("2024-01-01");
    expect(recruiter!.endDate).toBe("2026-01-01");
  });

  it("extracts all four narrative education records", () => {
    const { result } = parseResumePlainText(text);
    expect(result.ok).toBe(true);
    expect(result.draft.educations).toHaveLength(4);
    expect(result.draft.educations.map((e) => e.institution)).toEqual([
      "Teegala Ram Reddy College of Pharmacy JNTU",
      "Dhanvantari college of Pharmacy Mahabubnagar, JNTU",
      "New Vision Junior College Mahabubnagar",
      "Rishi Vidyalaya, secondary education Mahabubnagar",
    ]);
  });

  it("never sets currentCompany to an invented value for the company-less role", () => {
    const { result } = parseResumePlainText(text);
    expect(result.ok).toBe(true);
    // Most recent open-ended... both roles have end dates, so no current role
    // is invented from a completed history (selectCurrentExperience contract).
    expect(result.draft.professional.currentCompany).toBeNull();
  });
});
