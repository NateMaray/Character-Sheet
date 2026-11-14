import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { readGearStore, readPins, resolveGear, sanitizePins, togglePin, writeGearStore, writePins, type GearState, type TabId } from "./gear";
import { changedVitalLabels, fetchSheet } from "./sheet";
import { fetchRemoteSheet, openSheetChannel, supabase } from "./supabase";
import type { SheetData } from "./types";
import { EquipmentTab } from "./components/EquipmentTab";
import { Hud } from "./components/Hud";
import { MapTab } from "./components/MapTab";
import { AbilitiesTab, AchievementsTab, EssencesTab, MissionsTab, PocketTab, ProfileTab, StatusTab } from "./components/Sheets";
import { TabBar } from "./components/TabBar";

export function App() {
  const [sheet, setSheet] = useState<SheetData | null>(null);
  const [gear, setGear] = useState<GearState | null>(null);
  const [tab, setTab] = useState<TabId>("map");
  const [pins, setPins] = useState<TabId[]>(() => readPins());
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [flash, setFlash] = useState("");
  const [syncedAt, setSyncedAt] = useState<Date | null>(null);
  const [connected, setConnected] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [pulsing, setPulsing] = useState<string[]>([]);
  const gearRef = useRef<GearState | null>(null);
  const sheetRef = useRef<SheetData | null>(null);
  const firstLoad = useRef(true);
  const pullId = useRef(0);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const generation = useRef(0);
  const retryTimer = useRef<number | null>(null);
  const pulseTimer = useRef<number | null>(null);
  const alive = useRef(true);
  const pulledAt = useRef(0);

  const commitGear = useCallback((next: GearState) => {
    gearRef.current = next;
    writeGearStore(next);
    setGear(next);
  }, []);

  const applySheet = useCallback((data: SheetData) => {
    const resolved = resolveGear(data.rev, data.gear, readGearStore(), gearRef.current);
    if (resolved.dirty) writeGearStore(resolved.state);
    gearRef.current = resolved.state;
    setGear(resolved.state);
    const moved = changedVitalLabels(sheetRef.current?.vitals ?? null, data.vitals);
    sheetRef.current = data;
    setSheet(data);
    setSyncedAt(new Date());
    setError(null);
    if (moved.length) {
      setPulsing(moved);
      if (pulseTimer.current) window.clearTimeout(pulseTimer.current);
      pulseTimer.current = window.setTimeout(() => setPulsing([]), 900);
    }
  }, []);

  const pull = useCallback(async (manual = false): Promise<"live" | "fallback" | "error"> => {
    const id = ++pullId.current;
    setRefreshing(true);
    try {
      let data: SheetData;
      let fromBackup = false;
      try {
        data = await fetchRemoteSheet();
      } catch {
        data = await fetchSheet();
        fromBackup = true;
      }
      if (!alive.current || id !== pullId.current) return fromBackup ? "fallback" : "live";
      applySheet(data);
      pulledAt.current = Date.now();
      setFallback(fromBackup);
      if (firstLoad.current) firstLoad.current = false;
      else if (manual) setFlash("Updated");
      return fromBackup ? "fallback" : "live";
    } catch (err) {
      if (!alive.current || id !== pullId.current) return "error";
      const message = err instanceof Error ? err.message : "Could not refresh.";
      setError(gearRef.current ? `${message} Showing the last sheet.` : message);
      setFallback(true);
      return "error";
    } finally {
      if (alive.current && id === pullId.current) setRefreshing(false);
    }
  }, [applySheet]);

  const listen = useCallback(() => {
    const mine = ++generation.current;
    const previous = channelRef.current;
    const channel = openSheetChannel(
      (data) => {
        if (!alive.current || mine !== generation.current) return;
        applySheet(data);
        setFallback(false);
      },
      (status) => {
        if (!alive.current || mine !== generation.current) return;
        if (status === "live") {
          setConnected(true);
          if (Date.now() - pulledAt.current > 1500) void pull();
          return;
        }
        setConnected(false);
        if (retryTimer.current !== null) return;
        retryTimer.current = window.setTimeout(() => {
          retryTimer.current = null;
          if (!alive.current || mine !== generation.current) return;
          void pull().then(() => {
            if (alive.current && mine === generation.current) listen();
          });
        }, 1000);
      },
    );
    channelRef.current = channel;
    if (previous) void supabase.removeChannel(previous);
  }, [applySheet, pull]);

  const refresh = useCallback(async () => {
    await pull(true);
    listen();
  }, [pull, listen]);

  useEffect(() => {
    alive.current = true;
    void pull().then(() => {
      if (alive.current) listen();
    });
    return () => {
      alive.current = false;
      generation.current += 1;
      if (retryTimer.current !== null) window.clearTimeout(retryTimer.current);
      if (pulseTimer.current !== null) window.clearTimeout(pulseTimer.current);
      const channel = channelRef.current;
      channelRef.current = null;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [listen, pull]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      void pull().then(() => {
        if (alive.current) listen();
      });
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [listen, pull]);

  useEffect(() => {
    if (!flash) return;
    const timer = window.setTimeout(() => setFlash(""), 1600);
    return () => window.clearTimeout(timer);
  }, [flash]);

  if (!sheet || !gear) {
    return (
      <>
        <div className="sky" />
        <div className="loading">
          <div>
            <div className="bolt">ϟ</div>
            <h1>Aether</h1>
            <p>{error || "Opening Nate Maray's sheet…"}</p>
            {error ? (
              <button type="button" className="btn" style={{ marginTop: 16 }} onClick={() => void refresh()}>
                Try again
              </button>
            ) : null}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="sky" />
      <div className="app">
        <TabBar
          tab={tab}
          pins={pins}
          onSelect={setTab}
          onTogglePin={(value) => {
            const next = sanitizePins(togglePin(pins, value));
            setPins(next);
            writePins(next);
          }}
        />
        <main className="main">
          <Hud
            identity={sheet.identity}
            vitals={sheet.vitals}
            coins={sheet.coins}
            location={sheet.location}
            next={sheet.next}
            rev={sheet.rev}
            syncedAt={syncedAt}
            refreshing={refreshing}
            flash={flash}
            connected={connected}
            fallback={fallback}
            pulsing={pulsing}
            onRefresh={() => void refresh()}
          />
          <MapTab map={sheet.map} active={tab === "map"} />
          <StatusTab sheet={sheet} active={tab === "status"} />
          <AbilitiesTab sheet={sheet} active={tab === "abilities"} />
          <PocketTab gear={gear} source={sheet.gear} active={tab === "pocket"} onChange={commitGear} />
          <EquipmentTab gear={gear} source={sheet.gear} active={tab === "equipment"} onChange={commitGear} />
          <MissionsTab sheet={sheet} active={tab === "missions"} />
          <EssencesTab sheet={sheet} active={tab === "essences"} />
          <AchievementsTab sheet={sheet} active={tab === "feats"} />
          <ProfileTab sheet={sheet} active={tab === "profile"} />
        </main>
        {error ? (
          <div className="toast" role="alert">
            {error}
          </div>
        ) : null}
      </div>
    </>
  );
}
