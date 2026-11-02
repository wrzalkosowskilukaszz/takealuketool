import { api } from "@/server/http";
import { appStatus, feedSources } from "@/server/status";

export const GET = api(async () => ({ ...(await appStatus()), sources: await feedSources() }));
