import { NextResponse } from "next/server";

const API_HOST =
  "https://developerservices.itsmarta.com:18096/itsmarta/railrealtimearrivals/developerservices/traindata";

export async function GET() {
  const apiKey = process.env.MARTA_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { message: "Missing MARTA_API_KEY environment variable." },
      { status: 500 },
    );
  }

  try {
    const response = await fetch(`${API_HOST}?apiKey=${encodeURIComponent(apiKey)}`, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      return NextResponse.json(
        {
          message: `MARTA API error (${response.status}).`,
          upstream: errorText?.slice(0, 500) || "No response body.",
        },
        { status: response.status },
      );
    }

    const payload = await response.json();
    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unknown error." },
      { status: 500 },
    );
  }
}
