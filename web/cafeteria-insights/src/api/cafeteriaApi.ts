import { mockCafeteriaInsights } from "../mocks/cafeteriaData";
import type { CafeteriaInsightsPayload } from "../types";

const API_URL = import.meta.env.VITE_BIOALERT_API_URL?.trim() ?? "";
const FORCE_MOCK = import.meta.env.VITE_USE_MOCK === "true";
const SCHOOL_NIT =
  import.meta.env.VITE_SCHOOL_NIT?.trim() ||
  mockCafeteriaInsights.schoolNit;

export type FetchResult = {
  data: CafeteriaInsightsPayload;
  source: "live" | "mock";
  error?: string;
};

function withSchoolOverrides(
  payload: CafeteriaInsightsPayload,
): CafeteriaInsightsPayload {
  const schoolName = import.meta.env.VITE_SCHOOL_NAME?.trim();
  return {
    ...payload,
    schoolNit: SCHOOL_NIT,
    schoolName: schoolName || payload.schoolName,
  };
}

export async function fetchCafeteriaInsights(): Promise<FetchResult> {
  if (FORCE_MOCK || !API_URL) {
    return {
      data: withSchoolOverrides({
        ...mockCafeteriaInsights,
        dataSource: "mock",
        generatedAt: new Date().toISOString(),
      }),
      source: "mock",
    };
  }

  try {
    const url = new URL("/cafeteria-insights", API_URL);
    url.searchParams.set("nit", SCHOOL_NIT);

    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      throw new Error(`API ${res.status}: ${res.statusText}`);
    }

    const json = (await res.json()) as CafeteriaInsightsPayload;
    return {
      data: withSchoolOverrides({ ...json, dataSource: "live" }),
      source: "live",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return {
      data: withSchoolOverrides({
        ...mockCafeteriaInsights,
        dataSource: "mock",
        generatedAt: new Date().toISOString(),
      }),
      source: "mock",
      error: message,
    };
  }
}
