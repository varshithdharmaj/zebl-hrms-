import { afterEach, describe, expect, it, vi } from "vitest";
import type { CandidateEnrichmentContext } from "@/lib/recruitment/ai/types";

describe("createGeminiProvider auth transport", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("sends API key via x-goog-api-key header and never in the URL", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    summary: "Experienced backend engineer focused on APIs.",
                    headline: "Backend Engineer",
                    strengths: ["Node.js"],
                    missingInformation: ["Notice period"],
                    interviewTopics: ["REST APIs"],
                  }),
                },
              ],
            },
          },
        ],
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const { createGeminiProvider } = await import(
      "@/lib/recruitment/ai/gemini-provider"
    );

    const context: CandidateEnrichmentContext = {
      candidate: {
        currentTitle: "Engineer",
        currentCompany: "Acme",
        location: null,
        experienceYears: null,
        summary: null,
        headline: null,
      },
      skills: ["Node.js"],
      experience: [],
      education: [],
      projects: [],
      certifications: [],
      fieldStatus: {
        summary: "empty",
        headline: "empty",
        githubUrl: "empty",
        portfolioUrl: "empty",
        linkedinUrl: "empty",
        currentCompany: "filled",
        currentTitle: "filled",
        experienceYears: "empty",
        experience: "empty",
        education: "empty",
        skills: "filled",
        projects: "empty",
        certifications: "empty",
        noticePeriod: "empty",
        expectedCtc: "empty",
        currentCtc: "empty",
        earliestJoinDate: "empty",
        availability: "empty",
      },
      missingFields: ["Professional summary"],
    };

    const provider = createGeminiProvider({
      apiKey: "secret-test-key",
      model: "gemini-2.0-flash",
    });

    const result = await provider.generateCandidateEnrichment(context);

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const [url, init] = call;
    expect(url).not.toContain("key=");
    expect(url).not.toContain("secret-test-key");
    expect(String(url)).toMatch(/generativelanguage\.googleapis\.com/);
    const headers = init.headers as Record<string, string>;
    expect(headers["x-goog-api-key"]).toBe("secret-test-key");
  });

  it("rejects OpenAI-shaped keys before calling Gemini", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { createGeminiProvider } = await import(
      "@/lib/recruitment/ai/gemini-provider"
    );

    const provider = createGeminiProvider({
      apiKey: "sk-proj-not-a-gemini-key",
      model: "gemini-2.0-flash",
    });

    const result = await provider.generateCandidateEnrichment({
      candidate: {
        currentTitle: null,
        currentCompany: null,
        location: null,
        experienceYears: null,
        summary: null,
        headline: null,
      },
      skills: [],
      experience: [],
      education: [],
      projects: [],
      certifications: [],
      fieldStatus: {
        summary: "empty",
        headline: "empty",
        githubUrl: "empty",
        portfolioUrl: "empty",
        linkedinUrl: "empty",
        currentCompany: "empty",
        currentTitle: "empty",
        experienceYears: "empty",
        experience: "empty",
        education: "empty",
        skills: "empty",
        projects: "empty",
        certifications: "empty",
        noticePeriod: "empty",
        expectedCtc: "empty",
        currentCtc: "empty",
        earliestJoinDate: "empty",
        availability: "empty",
      },
      missingFields: [],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/OpenAI key/i);
      expect(result.retryable).toBe(false);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
