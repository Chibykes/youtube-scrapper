import type { EmailCandidate } from "@/lib/emailGuess";

export type CommentAuthor = {
  username: string;
  channelUrl: string | null;
  commentCount: number;
};

export type ScrapeCommentsPayload = {
  videoUrl: string;
};

export type ScrapeCommentsResponse = {
  authors: CommentAuthor[];
  threadsFetched: number;
  commentsDisabled: boolean;
  error?: string;
};

export type ChannelResult = {
  input: string;
  channelTitle: string | null;
  aboutUrl: string | null;
  emails: string[];
  status: "ok" | "no-email" | "error";
  error?: string;
};

export type ScrapeChannelEmailsPayload = {
  channels: string[];
};

export type ScrapeChannelEmailsResponse = {
  results: ChannelResult[];
  error?: string;
};

export type ValidatedEmail = {
  username: string;
  email: string;
  status: "valid" | "invalid" | "unknown";
  reason?: string;
};

export type ValidateEmailsPayload = {
  candidates: EmailCandidate[];
  apiKey?: string;
};

export type ValidateEmailsResponse = {
  results: ValidatedEmail[];
  balance?: number | null;
  error?: string;
  code?: string;
};

export type SendEmailsPayload = {
  emails: string;
  subject: string;
  message: string;
  senderEmail: string;
  senderPassword: string;
};

export type SendResult = {
  email: string;
  success: boolean;
  error?: string;
};

export type SendEmailsResponse = {
  total: number;
  succeeded: number;
  failed: number;
  results: SendResult[];
  error?: string;
};

export type WalletDepositPayload = {
  amountNgn: number;
};

export type WalletDepositResponse = {
  authorizationUrl: string;
  reference: string;
  error?: string;
};

export type WalletDepositVerifyResponse = {
  status: "success" | "failed" | "abandoned" | string;
  balance?: number;
  error?: string;
};

export type WalletBalanceResponse = {
  balance: number;
  currency: string;
  ngnRate: number;
  error?: string;
};
