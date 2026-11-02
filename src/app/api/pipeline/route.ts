import { listPipeline } from "@/server/careers/service";
import { api } from "@/server/http";

export const GET = api(async () => listPipeline());
