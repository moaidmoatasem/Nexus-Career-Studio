import { describe, expect, it } from "vitest";
import { jobLinks, mailSourceKind, matchApplication, sameCompany, senderDomain, titleNamed } from "@/lib/mailMatch";
import { nextStageFromEmail, stageForEmail } from "@/lib/stages";

const app = (id: string, company_name: string, title: string) => ({ id, jobs: { company_name, title } });

describe("matchApplication", () => {
  it("does not move an application for a different role at the same employer", () => {
    const r = matchApplication([app("a", "Amazon", "Senior QA Engineer")], {
      companyName: "Amazon",
      subject: "Update on your application: Data Center Technician",
      sender: "Amazon Jobs <no-reply@amazon.jobs>",
      body: "Thank you for your interest in the Data Center Technician role. We have decided not to move forward.",
    });
    expect(r.app).toBeNull();
    expect(r.suggestion?.id).toBe("a");
  });
  it("matches when the employer and the full role title are both named", () => {
    const r = matchApplication([app("a", "Amazon Web Services UK Limited", "Senior QA Engineer"), app("b", "Revolut Ltd", "QA Engineer")], {
      companyName: "Amazon",
      subject: "Your application",
      sender: "AWS Recruiting <noreply@greenhouse.io>",
      body: "Thanks for applying to the Senior QA Engineer position. We'd like to schedule an interview.",
    });
    expect(r.app?.id).toBe("a");
  });
  it("uses the sender's domain as employer evidence", () => {
    const r = matchApplication([app("b", "Revolut Ltd", "QA Engineer")], {
      companyName: "",
      subject: "QA Engineer — next steps",
      sender: "Talent <talent@careers.revolut.com>",
      body: "Hi, following your application...",
    });
    expect(r.app?.id).toBe("b");
  });
  it("sends ties to review instead of guessing", () => {
    const r = matchApplication([app("a", "Monzo", "QA Engineer"), app("b", "Monzo Bank", "QA Engineer")], {
      companyName: "Monzo",
      subject: "QA Engineer application",
      sender: "jobs@monzo.com",
      body: "...",
    });
    expect(r.app).toBeNull();
    expect(r.reason).toMatch(/2 applications/);
  });
});

describe("whole-word matching", () => {
  it("does not find 'Arm' inside 'warm regards'", () => {
    expect(sameCompany("Arm Limited", "Warm Regards Ltd")).toBe(false);
    expect(titleNamed("Arm Engineer", "warm regards from the engineering team")).toBe(false);
  });
  it("matches legal-name variants", () => {
    expect(sameCompany("Google UK Limited", "Google")).toBe(true);
    expect(sameCompany("Marks & Spencer", "Marks and Spencer plc")).toBe(true);
  });
  it("accepts long titles when most words appear", () => {
    expect(titleNamed("Senior QA Engineer Payments Platform", "role: senior qa engineer, payments team")).toBe(true);
  });
});

describe("mail source kind", () => {
  it("uses the real sender domain, not the display name", () => {
    expect(mailSourceKind("LinkedIn Job Alerts <jobalerts-noreply@linkedin.com>", "New jobs for you")).toBe("linkedin_alert");
    expect(mailSourceKind("LinkedIn Jobs <alerts@linkedin.com.example.org>", "New jobs")).toBe("recruiter");
    expect(mailSourceKind("Acme <acme@myworkday.com>", "Your application status has changed")).toBe("recruiter");
    expect(mailSourceKind("Acme <acme@myworkday.com>", "Job Alert: 3 new jobs")).toBe("workday_alert");
    expect(senderDomain("Talent <TALENT@Careers.Revolut.com>")).toBe("careers.revolut.com");
  });
  it("only follows links on real job-site hosts", () => {
    expect(jobLinks("See https://www.linkedin.com/jobs/view/1 and https://linkedin.com.evil.example/jobs/2 and http://boards.greenhouse.io/x")).toEqual([
      "https://www.linkedin.com/jobs/view/1",
    ]);
  });
});

describe("stage rules", () => {
  it("never moves a card backwards", () => {
    expect(nextStageFromEmail("interviewing", stageForEmail("applied_ack"))).toBeNull();
    expect(nextStageFromEmail("applied", stageForEmail("interview_invite"))).toBe("interviewing");
  });
  it("lets a rejection close an open application but not an offer", () => {
    expect(nextStageFromEmail("screening", stageForEmail("rejection"))).toBe("rejected");
    expect(nextStageFromEmail("offered", stageForEmail("rejection"))).toBeNull();
    expect(nextStageFromEmail("rejected", stageForEmail("interview_invite"))).toBeNull();
  });
  it("ignores informational mail", () => {
    expect(nextStageFromEmail("applied", stageForEmail("informational"))).toBeNull();
  });
});
