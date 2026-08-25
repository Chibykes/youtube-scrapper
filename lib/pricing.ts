export const CURRENCY = "YOSE";

/**
 * Cost per tool run, in YOSE. `null` means the tool is free for now —
 * pricing hasn't been decided yet.
 */
export const TOOL_COSTS = {
  emailScraper: null,
  commentScraper: null,
  // 1 YOSE per username validated — matches one listclean lookup.
  emailValidator: null,
  sendEmails: null,
} as const;

export function getYoseToNgnRate(): number {
  const rate = Number(process.env.NEXT_PUBLIC_YOSE_NGN_RATE);
  return Number.isFinite(rate) && rate > 0 ? rate : 100;
}
