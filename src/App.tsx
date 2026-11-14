import { useCallback, useEffect, useRef, useState } from "react";
import { readGearStore, readPins, resolveGear, sanitizePins, togglePin, writeGearStore, writePins, type GearState, type TabId } from "./gear";
import { fetchSheet } from "./sheet";
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
  const gearRef = useRef<GearState | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const firstLoad = useRef(true);

  const commitGear = useCallback((next: GearState) => {
    gearRef.current = next;
    writeGearStore(next);
    setGear(next);
  }, []);

  const refresh = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setRefreshing(true);
    try {
      const data = await fetchSheet(controller.signal);
      if (controller.signal.aborted) return;
      const resolved = resolveGear(data.rev, data.gear, readGearStore(), gearRef.current);
      if (resolved.dirty) writeGearStore(resolved.state);
      gearRef.current = resolved.state;
      setGear(resolved.state);
      setSheet(data);
      setSyncedAt(new Date());
      setError(null);
      if (firstLoad.current) firstLoad.current = false;
      else setFlash("Updated");
    } catch (err) {
      if (controller.signal.aborted) return;
      const message = err instanceof Error ? err.message : "Could not refresh.";
      setError(gearRef.current ? `${message} Showing the last sheet.` : message);
    } finally {
      if (abortRef.current === controller) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh]);

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
