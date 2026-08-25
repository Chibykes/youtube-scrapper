/** mails.so's `result` verdict. Documented values: docs.mails.so/response. */
export type MailsSoVerdict = "deliverable" | "undeliverable" | "risky" | "unknown";

/**
 * Raw per-email result shape returned by both `GET /v1/validate` and
 * `GET /v1/batch/:id` (each entry of its `emails` array) — see
 * https://docs.mails.so/bulk.
 */
export type MailsSoEmail = {
  id: string;
  email: string;
  username: string | null;
  domain: string | null;
  mx_record: string | null;
  score: number;
  isv_format: boolean;
  isv_domain: boolean;
  isv_mx: boolean | null;
  isv_noblock: boolean;
  isv_nocatchall: boolean;
  isv_nogeneric: boolean;
  is_free: boolean;
  result: MailsSoVerdict;
  reason: string;
};

/** `POST /v1/batch` response and the shape returned by `GET /v1/batch/:id`. */
export type MailsSoBatch = {
  id: string;
  name: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  finished_at: string | null;
  user_id: string;
  size: number;
  emails?: MailsSoEmail[];
};

export type MailsSoValidateResponse = {
  data?: MailsSoEmail;
};

export type EmailStatus = "valid" | "invalid" | "unknown";

/** Our own valid/invalid/unknown verdict, derived from mails.so's raw result. */
export type MailsSoResult = {
  email: string;
  status: EmailStatus;
  result: MailsSoVerdict;
  reason: string;
  score: number;
  isFree: boolean | null;
  isDisposable: boolean;
  isCatchAll: boolean;
};
