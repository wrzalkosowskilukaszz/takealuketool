/** Shared constants for offers, usable on the server and in the browser. */
export const TRACKS = ["core", "beyond", "adjacent", "new_field"] as const;
export type Track = (typeof TRACKS)[number];

export const EXPLORE_FIELDS = [
  "real_estate",
  "sales",
  "partnerships",
  "marketing",
  "product",
  "consulting",
  "education",
] as const;
export type ExploreField = (typeof EXPLORE_FIELDS)[number];

export const STATUSES = ["new", "saved", "applied", "interview", "offer", "rejected", "dismissed"] as const;
export type JobStatus = (typeof STATUSES)[number];

export const STATUS_LABEL: Record<JobStatus, string> = {
  new: "New",
  saved: "Saved",
  applied: "Applied",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
  dismissed: "Not for me",
};
