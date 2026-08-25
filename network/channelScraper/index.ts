import { createHttpClient } from "@/network/httpClient";
import type { ChannelAboutPage } from "@/network/channelScraper/types";

// Fetches an arbitrary YouTube "About" page as HTML — the target URL varies
// per channel, so this client carries no baseURL, just the browser-like
// headers YouTube expects.
const channelScraperApi = createHttpClient({
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
  },
  responseType: "text",
});

export async function fetchChannelAboutPage(
  aboutUrl: string
): Promise<ChannelAboutPage> {
  const res = await channelScraperApi.get<string>(aboutUrl);
  return { status: res.status, html: res.status < 400 ? res.data : null };
}
