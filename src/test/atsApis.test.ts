// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const readJobFacts = vi.fn();
vi.mock("@/lib/jobText.server", () => ({
  readJobFacts: (...args: unknown[]) => readJobFacts(...args),
}));
vi.mock("../lib/jobText.server", () => ({
  readJobFacts: (...args: unknown[]) => readJobFacts(...args),
}));

import {
  AtsPostingGone,
  companyFromBoard,
  fetchAtsFacts,
  htmlToText,
  parseAtsPosting,
} from "@/lib/atsApis.server";
import { extractPublicJob } from "@/lib/discovery.server";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

// Shapes follow each provider's published API. Lever's field names were checked against its
// postings-api README; the Greenhouse and Ashby ones come from their public documentation.
const GREENHOUSE_JOB = {
  id: 4012345,
  title: "Senior Data Engineer",
  company_name: "Acme Robotics",
  location: { name: "Leeds, UK" },
  absolute_url: "https://boards.greenhouse.io/acme/jobs/4012345",
  content:
    "&lt;p&gt;You will build data pipelines on AWS.&lt;/p&gt;&lt;ul&gt;&lt;li&gt;5+ years of Python&lt;/li&gt;&lt;li&gt;SQL &amp;amp; Spark&lt;/li&gt;&lt;/ul&gt;",
};
const LEVER_JOB = {
  id: "5ac21346-8e0c-4494-8e7a-3eb92ff77902",
  text: "Platform Engineer",
  categories: { location: "London", team: "Platform", commitment: "Full-time" },
  workplaceType: "hybrid",
  descriptionPlain: "Run and improve our platform. You know Kubernetes and Go well.",
  lists: [{ text: "Requirements", content: "<li>3+ years of Go</li><li>Kubernetes</li>" }],
  additionalPlain: "We welcome all applicants.",
  salaryRange: { currency: "GBP", interval: "per-year-salary", min: 70000, max: 85000 },
  hostedUrl: "https://jobs.lever.co/globex-corp/5ac21346-8e0c-4494-8e7a-3eb92ff77902",
};
const ASHBY_BOARD = {
  jobs: [
    { id: "other", title: "Designer", descriptionPlain: "x" },
    {
      id: "9f1b7c52-0d3e-4c1a-9a55-1a2b3c4d5e6f",
      title: "Product Manager",
      location: "Remote - EU",
      isRemote: true,
      descriptionHtml: "<p>Own the roadmap for our <strong>billing</strong> product.</p>",
      jobUrl: "https://jobs.ashbyhq.com/initech/9f1b7c52-0d3e-4c1a-9a55-1a2b3c4d5e6f",
      compensation: { compensationTierSummary: "€90K – €110K" },
    },
  ],
};

describe("parseAtsPosting", () => {
  it.each([
    [
      "https://boards.greenhouse.io/acme/jobs/4012345",
      { provider: "greenhouse", board: "acme", id: "4012345", eu: false },
    ],
    [
      "https://job-boards.greenhouse.io/acme/jobs/4012345?gh_src=x",
      { provider: "greenhouse", board: "acme", id: "4012345", eu: false },
    ],
    [
      "https://job-boards.eu.greenhouse.io/acme/jobs/77",
      { provider: "greenhouse", board: "acme", id: "77", eu: true },
    ],
    [
      "https://boards.greenhouse.io/embed/job_app?for=acme&token=4012345",
      { provider: "greenhouse", board: "acme", id: "4012345", eu: false },
    ],
    [
      "https://jobs.lever.co/globex-corp/5ac21346-8e0c-4494-8e7a-3eb92ff77902/apply",
      {
        provider: "lever",
        board: "globex-corp",
        id: "5ac21346-8e0c-4494-8e7a-3eb92ff77902",
        eu: false,
      },
    ],
    [
      "https://jobs.eu.lever.co/globex-corp/abc123",
      { provider: "lever", board: "globex-corp", id: "abc123", eu: true },
    ],
    [
      "https://jobs.ashbyhq.com/initech/9f1b7c52-0d3e-4c1a-9a55-1a2b3c4d5e6f",
      {
        provider: "ashby",
        board: "initech",
        id: "9f1b7c52-0d3e-4c1a-9a55-1a2b3c4d5e6f",
        eu: false,
      },
    ],
  ])("recognises %s", (url, expected) => {
    expect(parseAtsPosting(url)).toEqual(expected);
  });

  it.each([
    "https://boards.greenhouse.io/acme",
    "https://jobs.lever.co/globex-corp",
    "https://jobs.ashbyhq.com/initech",
    "https://careers.example.com/jobs/1?gh_jid=123",
    "http://boards.greenhouse.io/acme/jobs/1",
    "https://boards.greenhouse.io.evil.example/acme/jobs/1",
    "https://jobs.lever.co/a%2F..%2Fb/1",
    "https://acme.myworkdayjobs.com/en-US/careers/job/1",
    "not a url",
  ])("does not treat %s as an API posting", (url) => {
    expect(parseAtsPosting(url)).toBeNull();
  });
});

describe("htmlToText", () => {
  it("undoes Greenhouse's entity-escaped HTML", () => {
    expect(htmlToText(GREENHOUSE_JOB.content)).toBe(
      "You will build data pipelines on AWS.\n\n- 5+ years of Python\n- SQL & Spark",
    );
  });
  it("strips normal HTML and scripts", () => {
    expect(htmlToText("<p>Hello&nbsp;<b>world</b></p><script>alert(1)</script><br>Bye")).toBe(
      "Hello world\n\nBye",
    );
  });
});

describe("companyFromBoard", () => {
  it("turns a board name into a display name", () => {
    expect(companyFromBoard("globex-corp")).toBe("Globex Corp");
  });
});

describe("fetchAtsFacts", () => {
  const gh = parseAtsPosting("https://boards.greenhouse.io/acme/jobs/4012345")!;
  const lv = parseAtsPosting(
    "https://jobs.lever.co/globex-corp/5ac21346-8e0c-4494-8e7a-3eb92ff77902",
  )!;
  const ab = parseAtsPosting(
    "https://jobs.ashbyhq.com/initech/9f1b7c52-0d3e-4c1a-9a55-1a2b3c4d5e6f",
  )!;

  it("reads a Greenhouse job from the board API", async () => {
    const fetchImpl = vi.fn(async () => json(GREENHOUSE_JOB)) as unknown as typeof fetch;
    const facts = await fetchAtsFacts(gh, fetchImpl);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://boards-api.greenhouse.io/v1/boards/acme/jobs/4012345",
      expect.anything(),
    );
    expect(facts).toMatchObject({
      title: "Senior Data Engineer",
      company: "Acme Robotics",
      companySource: "api",
      location: "Leeds, UK",
    });
  });

  it("falls back to the board name when Greenhouse names no company", async () => {
    const { company_name: _omit, ...withoutCompany } = GREENHOUSE_JOB;
    const facts = await fetchAtsFacts(gh, (async () =>
      json(withoutCompany)) as unknown as typeof fetch);
    expect(facts.company).toBe("Acme");
    expect(facts.companySource).toBe("board_name");
  });

  it("reads a Lever posting, including lists and salary", async () => {
    const fetchImpl = vi.fn(async () => json(LEVER_JOB)) as unknown as typeof fetch;
    const facts = await fetchAtsFacts(lv, fetchImpl);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.lever.co/v0/postings/globex-corp/5ac21346-8e0c-4494-8e7a-3eb92ff77902",
      expect.anything(),
    );
    expect(facts.title).toBe("Platform Engineer");
    expect(facts.company).toBe("Globex Corp");
    expect(facts.isRemote).toBe(false);
    expect(facts.salary).toBe("GBP 70,000–85,000 per year");
    expect(facts.description).toContain("Run and improve our platform.");
    expect(facts.description).toContain("Requirements");
    expect(facts.description).toContain("- 3+ years of Go");
    expect(facts.description).toContain("We welcome all applicants.");
  });

  it("uses Lever's EU host for jobs.eu.lever.co", async () => {
    const eu = parseAtsPosting("https://jobs.eu.lever.co/globex-corp/abc123")!;
    const fetchImpl = vi.fn(async () => json(LEVER_JOB)) as unknown as typeof fetch;
    await fetchAtsFacts(eu, fetchImpl);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.eu.lever.co/v0/postings/globex-corp/abc123",
      expect.anything(),
    );
  });

  it("finds an Ashby job in the board listing", async () => {
    const fetchImpl = vi.fn(async () => json(ASHBY_BOARD)) as unknown as typeof fetch;
    const facts = await fetchAtsFacts(ab, fetchImpl);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.ashbyhq.com/posting-api/job-board/initech?includeCompensation=true",
      expect.anything(),
    );
    expect(facts).toMatchObject({
      title: "Product Manager",
      company: "Initech",
      isRemote: true,
      salary: "€90K – €110K",
      description: "Own the roadmap for our billing product.",
    });
  });

  it("reports a posting the board no longer lists as gone", async () => {
    await expect(
      fetchAtsFacts(gh, (async () => json({}, 404)) as unknown as typeof fetch),
    ).rejects.toBeInstanceOf(AtsPostingGone);
    await expect(
      fetchAtsFacts(ab, (async () => json({ jobs: [] })) as unknown as typeof fetch),
    ).rejects.toBeInstanceOf(AtsPostingGone);
  });

  it("fails on a reply that is not the expected shape", async () => {
    await expect(
      fetchAtsFacts(lv, (async () => json({ nope: true })) as unknown as typeof fetch),
    ).rejects.toThrow();
    await expect(
      fetchAtsFacts(lv, (async () => json({}, 503)) as unknown as typeof fetch),
    ).rejects.toThrow(/503/);
  });
});

describe("extractPublicJob with the ATS APIs", () => {
  const READ = {
    title: "ignored",
    company_name: "ignored",
    location: "ignored",
    country: "UK",
    is_remote: false,
    salary_range: null,
    required_skills: ["Python", "SQL"],
    preferred_skills: ["Spark"],
    min_years_exp: 5,
    domain: "data",
  };
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    readJobFacts.mockReset();
    readJobFacts.mockResolvedValue(READ);
    process.env["FIRECRAWL_API_KEY"] = "test";
  });
  afterEach(() => {
    fetchSpy?.mockRestore();
    delete process.env["FIRECRAWL_API_KEY"];
  });

  it("uses the API, not Firecrawl, and keeps the employer's published text", async () => {
    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((async (input: unknown) => {
      const url = String(input);
      if (url.startsWith("https://boards-api.greenhouse.io/")) return json(GREENHOUSE_JOB);
      throw new Error(`unexpected request to ${url}`);
    }) as typeof fetch);
    const job = await extractPublicJob(
      "u1",
      "https://boards.greenhouse.io/acme/jobs/4012345?gh_src=x",
    );
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(job).toMatchObject({
      title: "Senior Data Engineer",
      company_name: "Acme Robotics",
      location: "Leeds, UK",
      source: "greenhouse",
      source_record_id: "4012345",
      canonical_url: "https://boards.greenhouse.io/acme/jobs/4012345",
      required_skills: ["Python", "SQL"],
      min_years_exp: 5,
    });
    expect(job.description).toContain("5+ years of Python");
    expect(job.extraction_provenance["method"]).toBe("ats_public_api");
    expect(job.verified_at).not.toBeNull();
    // The model reads the posting text, and its title, employer and location never replace the API's.
    expect(readJobFacts.mock.calls[0]![1]).toContain("Senior Data Engineer");
  });

  it("fails clearly when the employer's board no longer lists the posting", async () => {
    fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation((async () => json({}, 404)) as typeof fetch);
    await expect(
      extractPublicJob("u1", "https://boards.greenhouse.io/acme/jobs/1"),
    ).rejects.toThrow(/no longer open/);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("reads the page with Firecrawl when the API is unavailable", async () => {
    const scraped = {
      json: {
        title: "Senior Data Engineer",
        company_name: "Acme Robotics",
        location: "Leeds",
        country: "UK",
        is_remote: false,
        salary_range: null,
        description: "A long enough description of the role to satisfy the schema.",
        required_skills: [],
        preferred_skills: [],
        min_years_exp: 0,
        domain: "data",
        external_reference: null,
      },
    };
    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((async (input: unknown) => {
      const url = String(input);
      if (url.includes("boards-api.greenhouse.io")) return json({}, 503);
      if (url.endsWith("/v2/scrape")) return json(scraped);
      throw new Error(`unexpected request to ${url}`);
    }) as typeof fetch);
    const job = await extractPublicJob("u1", "https://boards.greenhouse.io/acme/jobs/9");
    expect(job.extraction_provenance["method"]).toBe("firecrawl_json_schema");
  });

  it("sends other employer pages straight to Firecrawl", async () => {
    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((async (input: unknown) => {
      const url = String(input);
      if (url.endsWith("/v2/scrape")) return json({ json: { title: "x", company_name: "y" } });
      throw new Error(`unexpected request to ${url}`);
    }) as typeof fetch);
    await expect(extractPublicJob("u1", "https://careers.example.com/jobs/1")).rejects.toThrow();
    const urls = (fetchSpy.mock.calls as unknown[][]).map((c) => String(c[0]));
    expect(urls.every((u: string) => u.endsWith("/v2/scrape"))).toBe(true);
  });
});
