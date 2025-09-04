import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
    NODE_ENV: process.env.NODE_ENV,
    allEnvVars: Object.keys(process.env)
      .filter(
        (key) => key.startsWith("NEXT_PUBLIC_") || key.includes("BASE_URL")
      )
      .reduce((acc, key) => {
        acc[key] = process.env[key];
        return acc;
      }, {} as Record<string, string | undefined>),
  });
}
