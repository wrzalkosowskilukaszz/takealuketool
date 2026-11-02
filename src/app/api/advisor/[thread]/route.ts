import { z } from "zod";
import { advisorThread, askAdvisor, clearAdvisorThread } from "@/server/ai/advisor";
import { api, badRequest, parseBody } from "@/server/http";
import { withBudget } from "@/server/jobs/budget";

export const maxDuration = 120;

const Thread = z.string().regex(/^[a-z0-9-]{2,60}$/);

export const GET = api<{ thread: string }>(async (_req, { params }) => ({
  messages: await advisorThread(Thread.parse(params.thread)),
}));

/** Ask the career advisor a question. Each answer is a Claude call, counted against the AI budget. */
export const POST = api<{ thread: string }>(async (req, { params }) => {
  const thread = Thread.parse(params.thread);
  const b = await parseBody(req, z.object({ question: z.string().trim().min(2).max(2000) }));
  if (!b.question) throw badRequest("Ask a question first.");
  const messages = await withBudget(
    { provider: "anthropic", operation: "advisor", credits: 10, detail: thread },
    async () => ({ value: await askAdvisor(thread, b.question), credits: 0 }),
  );
  return { messages };
});

export const DELETE = api<{ thread: string }>(async (_req, { params }) => {
  await clearAdvisorThread(Thread.parse(params.thread));
  return { ok: true };
});
