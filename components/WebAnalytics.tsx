"use client";

import { Analytics } from "@vercel/analytics/next";

export default function WebAnalytics() {
  return (
    <Analytics
      beforeSend={(event) => {
        // Chat deep links can contain a user's question. Track page paths only.
        const url = new URL(event.url);
        url.search = "";
        url.hash = "";
        return { ...event, url: url.toString() };
      }}
    />
  );
}
