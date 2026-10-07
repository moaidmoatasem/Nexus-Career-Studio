// A stand-in for an OpenAI-compatible Chat Completions API, used only by the end-to-end smoke test.
// generateStructured always names its schema "result", so replies are chosen by the schema's top-level keys.
// Replies contain no digits, so the real fact-check passes without depending on vault metrics.
import http from "node:http";

const PORT = Number(process.env.FAKE_AI_PORT || 4010);

export const FAKE_JOB = {
  title: "Platform Engineer",
  company_name: "Example Robotics",
  location: "Remote",
  country: "United Kingdom",
  is_remote: true,
  salary_range: null,
  required_skills: ["TypeScript", "PostgreSQL"],
  preferred_skills: ["Playwright"],
  min_years_exp: 0,
  domain: "Robotics",
};

export const FAKE_COVER_LETTER =
  "I would like to join Example Robotics as a Platform Engineer, bringing steady delivery of reliable services.";

function vaultIds(prompt) {
  const at = prompt.lastIndexOf("Career Vault (JSON):");
  if (at === -1) return [];
  try {
    const items = JSON.parse(prompt.slice(at + "Career Vault (JSON):".length).trim());
    return items.map((i) => i.id).filter(Boolean);
  } catch {
    return [];
  }
}

export function replyFor(body) {
  const keys = Object.keys(body?.response_format?.json_schema?.schema?.properties ?? {});
  const prompt = body?.messages?.find((m) => m.role === "user")?.content ?? "";
  if (keys.includes("company_name")) return FAKE_JOB;
  if (keys.includes("bullets")) {
    return {
      bullets: vaultIds(prompt).map((id) => ({
        vault_item_id: id,
        tailored_text: "Built and ran dependable TypeScript services backed by PostgreSQL.",
        verified_metrics: [],
        aligned_skills: ["TypeScript"],
      })),
      cover_letter: FAKE_COVER_LETTER,
      recruiter_outreach:
        "Hello, I would welcome a short conversation about the Platform Engineer role.",
    };
  }
  if (keys.includes("items")) {
    return {
      items: [
        {
          category: "experience",
          title: "Software Engineer",
          organization: "Example Labs",
          start_date: "",
          end_date: "",
          is_current: true,
          description: "Built internal services.",
          metrics: [],
          skills: ["TypeScript"],
        },
      ],
    };
  }
  return null;
}

const server = http.createServer((req, res) => {
  if (req.method === "GET") {
    res.writeHead(200, { "content-type": "text/plain" }).end("ok");
    return;
  }
  if (req.method !== "POST" || !req.url?.endsWith("/chat/completions")) {
    res.writeHead(404).end();
    return;
  }
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      res.writeHead(400).end("bad json");
      return;
    }
    const out = replyFor(body);
    if (!out) {
      const keys = Object.keys(body?.response_format?.json_schema?.schema?.properties ?? {});
      console.error(`[fake-ai] no canned reply for schema keys: ${keys.join(", ")}`);
      res
        .writeHead(400, { "content-type": "application/json" })
        .end(
          JSON.stringify({ error: { message: `fake AI has no reply for keys ${keys.join(",")}` } }),
        );
      return;
    }
    res.writeHead(200, { "content-type": "application/json" }).end(
      JSON.stringify({
        id: "fake",
        object: "chat.completion",
        choices: [
          {
            index: 0,
            finish_reason: "stop",
            message: { role: "assistant", content: JSON.stringify(out) },
          },
        ],
      }),
    );
  });
});

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  server.listen(PORT, "127.0.0.1", () => console.log(`[fake-ai] listening on ${PORT}`));
}
