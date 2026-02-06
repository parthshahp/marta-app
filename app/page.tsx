"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Arrival = {
  DESTINATION: string;
  DIRECTION: string;
  EVENT_TIME: string;
  IS_REALTIME: string;
  LINE: string;
  NEXT_ARR: string;
  STATION: string;
  TRAIN_ID: string;
  WAITING_SECONDS: string;
  WAITING_TIME: string;
  DELAY: string;
  LATITUDE: string;
  LONGITUDE: string;
};

const LINE_ORDER = ["RED", "GOLD", "BLUE", "GREEN"];

const LINE_STYLES: Record<string, { label: string; dot: string; rail: string }> = {
  RED: { label: "Red", dot: "bg-red-500", rail: "border-red-500" },
  GOLD: { label: "Gold", dot: "bg-amber-400", rail: "border-amber-400" },
  BLUE: { label: "Blue", dot: "bg-sky-500", rail: "border-sky-500" },
  GREEN: { label: "Green", dot: "bg-emerald-500", rail: "border-emerald-500" },
};

const formatStationName = (name: string) =>
  name
    .toLowerCase()
    .split(" ")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : ""))
    .join(" ");

const formatDirection = (direction: string) => {
  if (direction === "N") return "Northbound";
  if (direction === "S") return "Southbound";
  if (direction === "E") return "Eastbound";
  if (direction === "W") return "Westbound";
  return direction;
};

const DIRECTION_ORDER = ["N", "S", "E", "W"];
const ALL_LINES = "ALL";

export default function Home() {
  const [arrivals, setArrivals] = useState<Arrival[]>([]);
  const [selectedStation, setSelectedStation] = useState<string | null>(null);
  const [stationSearch, setStationSearch] = useState("");
  const [activeLineFilter, setActiveLineFilter] = useState<string>(ALL_LINES);
  const [mobileView, setMobileView] = useState<"stations" | "arrivals">("stations");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const fetchArrivals = useCallback(async () => {
    setStatus("loading");
    setErrorMessage(null);
    try {
      const response = await fetch("/api/realtime", { cache: "no-store" });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.upstream ?? payload?.message ?? "Unable to fetch arrivals.");
      }
      const payload = (await response.json()) as Arrival[];
      setArrivals(payload);
      setUpdatedAt(new Date());
      if (payload.length > 0) {
        setSelectedStation((current) => current ?? payload[0].STATION);
      }
      setStatus("idle");
    } catch (error) {
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Unknown error.");
    }
  }, []);

  useEffect(() => {
    fetchArrivals();
  }, [fetchArrivals]);

  const stationsByLine = useMemo(() => {
    const normalizedSearch = stationSearch.trim().toLowerCase();
    const lineMap = new Map<string, Set<string>>();

    arrivals.forEach((arrival) => {
      if (activeLineFilter !== ALL_LINES && arrival.LINE !== activeLineFilter) {
        return;
      }
      if (
        normalizedSearch &&
        !formatStationName(arrival.STATION).toLowerCase().includes(normalizedSearch)
      ) {
        return;
      }
      if (!lineMap.has(arrival.LINE)) {
        lineMap.set(arrival.LINE, new Set());
      }
      lineMap.get(arrival.LINE)?.add(arrival.STATION);
    });

    const orderedLines = LINE_ORDER.filter((line) => lineMap.has(line));
    const extraLines = [...lineMap.keys()].filter((line) => !LINE_ORDER.includes(line));

    return [...orderedLines, ...extraLines].map((line) => ({
      line,
      stations: [...(lineMap.get(line) ?? [])].sort((a, b) => a.localeCompare(b)),
    }));
  }, [activeLineFilter, arrivals, stationSearch]);

  const selectedArrivals = useMemo(() => {
    if (!selectedStation) return [];
    return arrivals
      .filter((arrival) => arrival.STATION === selectedStation)
      .sort(
        (a, b) =>
          Number.parseInt(a.WAITING_SECONDS || "0", 10) -
          Number.parseInt(b.WAITING_SECONDS || "0", 10),
      );
  }, [arrivals, selectedStation]);

  const groupedArrivals = useMemo(() => {
    const groups = new Map<string, Arrival[]>();

    selectedArrivals.forEach((arrival) => {
      const groupKey = `${arrival.LINE}|${arrival.DIRECTION}`;
      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)?.push(arrival);
    });

    return [...groups.entries()]
      .map(([key, trains]) => {
        const [line, direction] = key.split("|");
        return { line, direction, trains };
      })
      .sort((a, b) => {
        const lineOrderA = LINE_ORDER.indexOf(a.line);
        const lineOrderB = LINE_ORDER.indexOf(b.line);
        const safeLineA = lineOrderA === -1 ? 99 : lineOrderA;
        const safeLineB = lineOrderB === -1 ? 99 : lineOrderB;
        if (safeLineA !== safeLineB) {
          return safeLineA - safeLineB;
        }

        const dirOrderA = DIRECTION_ORDER.indexOf(a.direction);
        const dirOrderB = DIRECTION_ORDER.indexOf(b.direction);
        const safeDirA = dirOrderA === -1 ? 99 : dirOrderA;
        const safeDirB = dirOrderB === -1 ? 99 : dirOrderB;
        return safeDirA - safeDirB;
      });
  }, [selectedArrivals]);

  const hasFilteredStations = useMemo(
    () => stationsByLine.some(({ stations }) => stations.length > 0),
    [stationsByLine],
  );

  const selectStation = useCallback((station: string) => {
    setSelectedStation(station);
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setMobileView("arrivals");
    }
  }, []);

  const stationList = (
    <section className="border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-3 sm:px-5">
        <h2
          className="text-base font-semibold uppercase tracking-wide text-slate-800"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Stations
        </h2>
      </div>

      <div className="border-b border-slate-200 px-4 py-3 sm:px-5">
        <label htmlFor="station-search" className="sr-only">
          Search stations
        </label>
        <div className="space-y-2">
          <input
            id="station-search"
            type="text"
            value={stationSearch}
            onChange={(event) => setStationSearch(event.target.value)}
            placeholder="Search station name"
            className="w-full border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500"
          />
          {activeLineFilter !== ALL_LINES && (
            <p className="text-xs text-slate-500">
              Filtered to {LINE_STYLES[activeLineFilter]?.label ?? activeLineFilter} Line
            </p>
          )}
        </div>
      </div>

      <div className="max-h-[calc(100vh-300px)] overflow-auto px-4 py-4 sm:px-5">
        {!arrivals.length && status !== "loading" ? (
          <p className="text-sm text-slate-500">No arrivals loaded yet.</p>
        ) : !hasFilteredStations ? (
          <p className="text-sm text-slate-500">No stations match your search.</p>
        ) : (
          <div className="space-y-5">
            {stationsByLine.map(({ line, stations }) => {
              const style = LINE_STYLES[line] ?? {
                label: line,
                dot: "bg-slate-500",
                rail: "border-slate-500",
              };
              return (
                <div key={line}>
                  <div className="mb-2 flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${style.dot}`} />
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      {style.label} Line
                    </p>
                  </div>
                  <div className={`space-y-1 border-l-2 pl-3 ${style.rail}`}>
                    {stations.map((station) => (
                      <button
                        key={station}
                        onClick={() => selectStation(station)}
                        className={`w-full border-l-2 px-2 py-2 text-left text-sm transition ${
                          selectedStation === station
                            ? `${style.rail} bg-slate-900 text-white`
                            : "border-transparent text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        {formatStationName(station)}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );

  const arrivalsPanel = (
    <section className="border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-3 sm:px-5">
        <p className="text-xs uppercase tracking-wider text-slate-500">Selected station</p>
        <div className="mt-1 flex items-center justify-between gap-3">
          <h2
            className="text-2xl font-semibold text-slate-900"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {selectedStation ? formatStationName(selectedStation) : "Pick a station"}
          </h2>
          <span className="text-sm text-slate-500">{selectedArrivals.length} arrivals</span>
        </div>
      </div>

      <div className="px-4 py-4 sm:px-5">
        {selectedArrivals.length === 0 ? (
          <p className="text-sm text-slate-500">
            {selectedStation ? "No realtime arrivals for this station." : "Choose a station."}
          </p>
        ) : (
          <div className="space-y-4">
            {groupedArrivals.map(({ line, direction, trains }) => {
              const groupStyle = LINE_STYLES[line] ?? {
                label: line,
                dot: "bg-slate-500",
                rail: "border-slate-500",
              };

              return (
                <div key={`${line}-${direction}`} className="border border-slate-200">
                  <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${groupStyle.dot}`} />
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                        {groupStyle.label} Line
                      </p>
                      <span className="text-xs text-slate-500">{formatDirection(direction)}</span>
                    </div>
                    <p className="text-xs text-slate-500">{trains.length} trains</p>
                  </div>
                  <div className="divide-y divide-slate-200">
                    {trains.map((arrival, index) => {
              const style = LINE_STYLES[arrival.LINE] ?? {
                label: arrival.LINE,
                dot: "bg-slate-500",
                rail: "border-slate-500",
              };

              return (
                <div
                  key={`${arrival.TRAIN_ID}-${arrival.NEXT_ARR}-${index}`}
                  className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-3 py-3"
                >
                  <span className={`h-2.5 w-2.5 rounded-full ${style.dot}`} />
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      To {formatStationName(arrival.DESTINATION)}
                    </p>
                    <p className="text-xs text-slate-500">
                      Train #{arrival.TRAIN_ID} | Realtime:{" "}
                      {arrival.IS_REALTIME === "true" ? "Yes" : "No"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-semibold text-slate-900">{arrival.WAITING_TIME}</p>
                    <p className="text-xs text-slate-500">{arrival.NEXT_ARR}</p>
                  </div>
                </div>
              );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );

  return (
    <div className="min-h-screen bg-[#f7f7f5] text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-[#f7f7f5]/95 backdrop-blur">
        <div className="h-1 w-full bg-[linear-gradient(90deg,#ef4444_0%,#ef4444_25%,#f59e0b_25%,#f59e0b_50%,#0ea5e9_50%,#0ea5e9_75%,#10b981_75%,#10b981_100%)]" />
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-end justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">MARTA Rail Realtime</p>
            <h1
              className="text-3xl font-semibold leading-tight text-slate-900 sm:text-4xl"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Transit Board
            </h1>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setActiveLineFilter(ALL_LINES)}
                className={`inline-flex items-center gap-2 border px-2 py-1 text-xs font-medium transition ${
                  activeLineFilter === ALL_LINES
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                }`}
                aria-pressed={activeLineFilter === ALL_LINES}
              >
                All lines
              </button>
              {LINE_ORDER.map((line) => {
                const style = LINE_STYLES[line];
                return (
                  <button
                    key={line}
                    onClick={() => setActiveLineFilter((current) => (current === line ? ALL_LINES : line))}
                    className={`inline-flex items-center gap-2 border px-2 py-1 text-xs font-medium transition ${
                      activeLineFilter === line
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                    }`}
                    aria-pressed={activeLineFilter === line}
                  >
                    <span className={`h-2 w-2 rounded-full ${style.dot}`} />
                    {style.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-xs text-slate-500">
              {updatedAt ? `Updated ${updatedAt.toLocaleTimeString()}` : "Not updated yet"}
            </p>
            <button
              onClick={fetchArrivals}
              className="border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
              disabled={status === "loading"}
            >
              {status === "loading" ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>
      </header>

      {status === "error" && (
        <div className="mx-auto mt-4 w-full max-w-6xl px-4 sm:px-6">
          <div className="border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMessage ?? "Could not load realtime arrivals."}
          </div>
        </div>
      )}

      <main className="mx-auto w-full max-w-6xl px-4 py-4 sm:px-6 sm:py-6">
        <div className="hidden gap-5 lg:grid lg:grid-cols-[1fr_1.35fr]">
          {stationList}
          {arrivalsPanel}
        </div>

        <div className="lg:hidden">
          {mobileView === "stations" ? (
            stationList
          ) : (
            <div className="space-y-3">
              <button
                onClick={() => setMobileView("stations")}
                className="border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800"
              >
                Back to stations
              </button>
              {arrivalsPanel}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
