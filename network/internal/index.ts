import { createHttpClient } from "@/network/httpClient";
import type {
  ScrapeCommentsPayload,
  ScrapeCommentsResponse,
  ScrapeChannelEmailsPayload,
  ScrapeChannelEmailsResponse,
  ValidateEmailsPayload,
  ValidateEmailsResponse,
  SendEmailsPayload,
  SendEmailsResponse,
  WalletDepositPayload,
  WalletDepositResponse,
  WalletDepositVerifyResponse,
  WalletBalanceResponse,
} from "@/network/internal/types";

// Client for this app's own /api/* routes — used from "use client" pages and
// components. Relative paths resolve against the current origin in the
// browser, so no baseURL is needed.
const internalApi = createHttpClient();

export function scrapeComments(payload: ScrapeCommentsPayload) {
  return internalApi.post<ScrapeCommentsResponse>(
    "/api/scrape/comments",
    payload
  );
}

export function scrapeChannelEmails(payload: ScrapeChannelEmailsPayload) {
  return internalApi.post<ScrapeChannelEmailsResponse>(
    "/api/scrape/emails",
    payload
  );
}

export function validateEmails(payload: ValidateEmailsPayload) {
  return internalApi.post<ValidateEmailsResponse>(
    "/api/scrape/validate-emails",
    payload
  );
}

export function sendEmails(payload: SendEmailsPayload) {
  return internalApi.post<SendEmailsResponse>("/api/send", payload);
}

export function startWalletDeposit(payload: WalletDepositPayload) {
  return internalApi.post<WalletDepositResponse>(
    "/api/wallet/deposit",
    payload
  );
}

export function verifyWalletDeposit(reference: string) {
  return internalApi.get<WalletDepositVerifyResponse>(
    "/api/wallet/deposit/verify",
    {
      params: { reference },
    }
  );
}

export function getWalletBalance() {
  return internalApi.get<WalletBalanceResponse>("/api/wallet");
}
