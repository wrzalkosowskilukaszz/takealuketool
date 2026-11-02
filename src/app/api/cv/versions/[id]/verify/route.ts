import { reverify } from "@/server/cv/service";
import { api } from "@/server/http";

export const maxDuration = 300;

/** Fact-checks the edited CV again. */
export const POST = api<{ id: string }>(async (_req, { params }) => ({ version: await reverify(params.id) }));
