import { NextResponse } from "next/server";

const API_HOST =
  "https://developerservices.itsmarta.com:18096/itsmarta/railrealtimearrivals/developerservices/traindata";
const CACHE_TTL_MS = 60_000;
const RETRY_INTERVAL_MS = 2_000;

type CacheState = {
  payload: unknown[] | null;
  fetchedAt: number;
};

type UpstreamResult =
  | { ok: true; payload: unknown[] }
  | { ok: false; status: number; upstream: string };

let cache: CacheState = {
  payload: null,
  fetchedAt: 0,
};
let inFlightRefresh: Promise<boolean> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

const now = () => Date.now();

const hasFreshCache = () => {
  return cache.payload !== null && now() - cache.fetchedAt < CACHE_TTL_MS;
};

const scheduleRetry = (apiKey: string) => {
  if (retryTimer) return;
  retryTimer = setTimeout(async () => {
    retryTimer = null;
    const success = await refreshCache(apiKey);
    if (!success) {
      scheduleRetry(apiKey);
    }
  }, RETRY_INTERVAL_MS);
};

const fetchFromMarta = async (apiKey: string): Promise<UpstreamResult> => {
  try {
    const response = await fetch(`${API_HOST}?apiKey=${encodeURIComponent(apiKey)}`, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      return {
        ok: false,
        status: response.status,
        upstream: errorText?.slice(0, 500) || "No response body.",
      };
    }

    const payload = (await response.json()) as unknown[];
    return { ok: true, payload };
  } catch (error) {
    return {
      ok: false,
      status: 500,
      upstream: error instanceof Error ? error.message : "Unknown error.",
    };
  }
};

const refreshCache = async (apiKey: string): Promise<boolean> => {
  if (inFlightRefresh) return inFlightRefresh;

  inFlightRefresh = (async () => {
    const result = await fetchFromMarta(apiKey);
    if (result.ok) {
      cache = {
        payload: result.payload,
        fetchedAt: now(),
      };
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
      return true;
    }

    if (cache.payload !== null && result.status === 500) {
      scheduleRetry(apiKey);
    }

    return false;
  })();

  try {
    return await inFlightRefresh;
  } finally {
    inFlightRefresh = null;
  }
};

export async function GET() {
  const apiKey = process.env.MARTA_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { message: "Missing MARTA_API_KEY environment variable." },
      { status: 500 },
    );
  }

  if (hasFreshCache()) {
    return NextResponse.json({
      data: cache.payload,
      cache: {
        hit: true,
        stale: false,
        ageMs: now() - cache.fetchedAt,
      },
    });
  }

  const refreshed = await refreshCache(apiKey);
  if (refreshed && cache.payload !== null) {
    return NextResponse.json({
      data: cache.payload,
      cache: {
        hit: false,
        stale: false,
        ageMs: 0,
      },
    });
  }

  if (cache.payload !== null) {
    return NextResponse.json({
      data: cache.payload,
      cache: {
        hit: true,
        stale: true,
        ageMs: now() - cache.fetchedAt,
      },
      message: "Serving stale cache while MARTA API recovers.",
    });
  }

  const lastAttempt = await fetchFromMarta(apiKey);
  if (lastAttempt.ok) {
    cache = {
      payload: lastAttempt.payload,
      fetchedAt: now(),
    };
    return NextResponse.json({
      data: cache.payload,
      cache: {
        hit: false,
        stale: false,
        ageMs: 0,
      },
    });
  }

  return NextResponse.json(
    {
      message: `MARTA API error (${lastAttempt.status}).`,
      upstream: lastAttempt.upstream,
    },
    { status: 500 },
  );
}
