/** Reacher `is_reachable` confidence. See https://docs.reacher.email/getting-started/is-reachable */
export type ReacherReachable = "safe" | "risky" | "invalid" | "unknown";

export type ReacherCoreError = {
  type: string;
  message: string;
};

export type ReacherMiscDetails = {
  is_disposable: boolean;
  is_role_account: boolean;
  is_b2c?: boolean;
  gravatar_url?: string | null;
  haveibeenpwned?: unknown;
};

export type ReacherMxDetails = {
  accepts_mail: boolean;
  records: string[];
};

export type ReacherSmtpDetails = {
  can_connect_smtp: boolean;
  has_full_inbox: boolean;
  is_catch_all: boolean;
  is_deliverable: boolean;
  is_disabled: boolean;
};

export type ReacherSyntaxDetails = {
  address?: string;
  domain: string;
  is_valid_syntax: boolean;
  username: string;
  normalized_email?: string;
  suggestion?: string | null;
};

/** POST /v1/check_email (and /v0/check_email) response body. */
export type ReacherCheckEmailOutput = {
  input: string;
  is_reachable: ReacherReachable;
  misc: ReacherMiscDetails | ReacherCoreError;
  mx: ReacherMxDetails | ReacherCoreError;
  smtp: ReacherSmtpDetails | ReacherCoreError;
  syntax: ReacherSyntaxDetails;
  debug?: Record<string, unknown>;
};

export type ReacherCheckEmailRequest = {
  to_email: string;
  from_email?: string;
  hello_name?: string;
  smtp_port?: number;
  check_gravatar?: boolean;
};

export type EmailStatus = "valid" | "invalid" | "unknown";

/** Our own valid/invalid/unknown verdict, derived from Reacher's is_reachable. */
export type ReacherResult = {
  email: string;
  status: EmailStatus;
  reachable: ReacherReachable;
  reason: string;
  raw?: ReacherCheckEmailOutput;
};
