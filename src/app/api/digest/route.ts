import { buildDigest } from "@/server/careers/digest";
import { safeEqual } from "@/server/crypto";
import { env } from "@/server/env";
import { api, HttpError, searchParams } from "@/server/http";

/**
 * The morning digest for the project routine: GET /api/digest with `Authorization: Bearer $DIGEST_TOKEN`.
 * `?mark=1` stamps the listed offers so the next digest does not repeat them. Also readable with a session.
 */
export const GET = api(
  async (req) => {
    const token = env().DIGEST_TOKEN;
    const auth = req.headers.get("authorization") ?? "";
    const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token || !bearer || !safeEqual(bearer, token)) throw new HttpError(401, "unauthorized");
    return buildDigest({ mark: searchParams(req).get("mark") === "1" });
  },
  { public: true },
);
