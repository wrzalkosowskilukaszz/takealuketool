import { deleteView } from "@/server/careers/service";
import { api } from "@/server/http";

export const DELETE = api<{ id: string }>(async (_req, { params }) => {
  await deleteView(params.id);
  return { ok: true };
});
