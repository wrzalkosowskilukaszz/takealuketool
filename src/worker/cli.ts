/**
 * Worker CLI: the same engine as the hourly HTTP tick, for local use or a VM cron.
 *   pnpm worker tick [--seconds 900] [--no-scoring]   one full tick (daily refresh, sync, scoring, housekeeping)
 *   pnpm worker jobs [--seconds 120] [--no-detect]    read job sources now
 *   pnpm worker score [--seconds 120]                  let Claude read the offers that are due
 *   pnpm worker digest [--mark]                        print the morning digest
 *   pnpm worker status                                 counts, scheduler and spend
 */
import { scoreDueOffers } from "../server/ai/score.ts";
import { buildDigest } from "../server/careers/digest.ts";
import { syncJobs } from "../server/careers/sync.ts";
import { closeDb } from "../server/db/client.ts";
import { runTick } from "../server/jobs/tick.ts";
import { appStatus } from "../server/status.ts";

const [cmd, ...rest] = process.argv.slice(2);
const flag = (name: string, def?: string) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? (rest[i + 1] ?? "true") : def;
};
const seconds = (def: string) => Number(flag("seconds", def)) * 1000;

let exitCode = 0;
try {
  switch (cmd) {
    case "tick": {
      const r = await runTick({
        budgetMs: seconds("900"),
        trigger: "cli",
        scoring: !rest.includes("--no-scoring"),
      });
      console.log(JSON.stringify(r, null, 2));
      if (r.errors.length) exitCode = 2;
      break;
    }
    case "jobs": {
      const r = await syncJobs({
        deadline: Date.now() + seconds("120"),
        detect: !rest.includes("--no-detect"),
      });
      console.log(JSON.stringify(r, null, 2));
      break;
    }
    case "score": {
      console.log(JSON.stringify(await scoreDueOffers({ deadline: Date.now() + seconds("120") }), null, 2));
      break;
    }
    case "digest": {
      const d = await buildDigest({ mark: rest.includes("--mark") });
      console.log(d.markdown);
      break;
    }
    case "status": {
      console.log(JSON.stringify(await appStatus(), null, 2));
      break;
    }
    default:
      console.log("commands: tick | jobs | score | digest [--mark] | status");
      exitCode = 1;
  }
} catch (e) {
  console.error(e instanceof Error ? e.stack : e);
  exitCode = 1;
} finally {
  await closeDb();
}
process.exit(exitCode);
