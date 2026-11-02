import { duplicateVersion } from "@/server/cv/service";
import { api } from "@/server/http";

export const POST = api<{ id: string }>(async (_req, { params }) => duplicateVersion(params.id));
