// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  assertNotJobBoard,
  gulfBoardBrand,
  isJobBoardHost,
  isJobBoardUrl,
  JobBoardError,
} from "@/lib/jobSources";
import { isJobBoardHost as workerIsJobBoardHost, checkUrl } from "../../worker/urlGuard.mjs";
import { jobLinks, mailSourceKind } from "@/lib/mailMatch";

const BOARD_HOSTS = [
  "linkedin.com",
  "www.linkedin.com",
  "uk.linkedin.com",
  "lnkd.in",
  "indeed.com",
  "uk.indeed.com",
  "ae.indeed.com",
  "indeed.co.uk",
  "glassdoor.com",
  "www.glassdoor.co.uk",
  "bayt.com",
  "www.bayt.com",
  "naukrigulf.com",
  "gulftalent.com",
  "wuzzuf.net",
  "LinkedIn.com.",
  // A look-alike host is never worth fetching, so these fail closed.
  "linkedin.com.example.org",
];

const EMPLOYER_HOSTS = [
  "boards.greenhouse.io",
  "jobs.lever.co",
  "jobs.ashbyhq.com",
  "acme.myworkdayjobs.com",
  "careers.example.com",
  "notlinkedin.com",
  "indeedcorp.com",
  "bayternet.com",
  // A company named like a board, on its own public ATS tenant, is still the employer.
  "indeed.wd1.myworkdayjobs.com",
  "linkedin.greenhouse.io",
];

describe("job-board host policy", () => {
  it.each(BOARD_HOSTS)("treats %s as a job board", (host) => {
    expect(isJobBoardHost(host)).toBe(true);
    expect(isJobBoardUrl(`https://${host}/jobs/view/123`)).toBe(true);
  });

  it.each(EMPLOYER_HOSTS)("does not treat %s as a job board", (host) => {
    expect(isJobBoardHost(host)).toBe(false);
  });

  it("is not fooled by userinfo, ports or the path", () => {
    expect(isJobBoardUrl("https://careers.example.com@www.linkedin.com/jobs/1")).toBe(true);
    expect(isJobBoardUrl("https://www.linkedin.com:443/jobs/1")).toBe(true);
    expect(isJobBoardUrl("https://careers.example.com/redirect?to=linkedin.com")).toBe(false);
    expect(isJobBoardUrl("not a url")).toBe(false);
  });

  it("refuses a board URL before any request is made", () => {
    expect(() => assertNotJobBoard("https://www.indeed.com/viewjob?jk=abc")).toThrow(JobBoardError);
    expect(() => assertNotJobBoard("https://boards.greenhouse.io/acme/jobs/1")).not.toThrow();
  });

  it("names the Gulf board behind a sender domain", () => {
    expect(gulfBoardBrand("alerts.bayt.com")).toBe("bayt");
    expect(gulfBoardBrand("mail.wuzzuf.net")).toBe("wuzzuf");
    expect(gulfBoardBrand("linkedin.com")).toBeNull();
    expect(gulfBoardBrand("careers.example.com")).toBeNull();
  });

  it("agrees with the portal worker's copy of the policy", () => {
    for (const host of [...BOARD_HOSTS, ...EMPLOYER_HOSTS])
      expect(workerIsJobBoardHost(host), host).toBe(isJobBoardHost(host));
  });

  it("makes the portal worker refuse a board as a page but allow it as a sub-resource", async () => {
    const resolve = async () => ["93.184.216.34"];
    const page = await checkUrl("https://www.linkedin.com/jobs/view/1", { resolve });
    expect(page.ok).toBe(false);
    const redirected = await checkUrl("https://lnkd.in/abc", { resolve });
    expect(redirected.ok).toBe(false);
    const pixel = await checkUrl("https://www.linkedin.com/px.gif", { resolve, allowHttp: true });
    expect(pixel.ok).toBe(true);
    const employer = await checkUrl("https://jobs.lever.co/acme/1", { resolve });
    expect(employer.ok).toBe(true);
  });
});

describe("mail intake and the board policy", () => {
  it("returns only public employer ATS links, never board links", () => {
    const text = [
      "https://www.linkedin.com/jobs/view/123",
      "https://uk.indeed.com/viewjob?jk=abc",
      "https://www.bayt.com/en/uae/jobs/x-1/",
      "https://boards.greenhouse.io/acme/jobs/1",
      "https://jobs.lever.co/acme/2",
      "http://jobs.ashbyhq.com/acme/3",
      "https://acme.myworkdayjobs.com/en-US/careers/job/4",
    ].join("\n");
    expect(jobLinks(text, 10)).toEqual([
      "https://boards.greenhouse.io/acme/jobs/1",
      "https://jobs.lever.co/acme/2",
      "https://acme.myworkdayjobs.com/en-US/careers/job/4",
    ]);
  });

  it("recognises Gulf board alerts by the sender's real domain", () => {
    expect(mailSourceKind("Bayt Jobs <alerts@mail.bayt.com>", "New jobs for you")).toBe(
      "gulf_board_alert",
    );
    expect(mailSourceKind("Wuzzuf <jobs@wuzzuf.net>", "Job alert")).toBe("gulf_board_alert");
    expect(mailSourceKind("Bayt Jobs <alerts@example.org>", "New jobs for you")).toBe("recruiter");
    expect(mailSourceKind("jobs@linkedin.com", "Jobs for you")).toBe("linkedin_alert");
  });
});
