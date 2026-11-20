import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { readGearStore, readPins, readPocketActions, resolveGear, samePocketActions, sanitizePins, softSyncKind, togglePin, writeGearStore, writePins, writePocketActions, type GearState, type TabId } from "./gear";
import { readSellActions, writeSellActions } from "./sell";
import { changedVitalLabels, fetchSheet, shouldApplySheet } from "./sheet";
import { fetchRemoteSheet, openSheetChannel, pushPocketAction, supabase } from "./supabase";
import type { PocketAction, SheetData } from "./types";
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
  const [loadError, setLoadError] = useState("");
  const [pulsing, setPulsing] = useState<string[]>([]);
  const [actions, setActions] = useState<PocketAction[]>(() => readPocketActions());
  const gearRef = useRef<GearState | null>(null);
  const actionsRef = useRef<PocketAction[]>(actions);
  const sellActionsRef = useRef<PocketAction[]>(readSellActions());
  const syncing = useRef(false);
  const syncQueued = useRef(false);
  const sellSyncing = useRef(false);
  const sellSyncQueued = useRef(false);
  const sheetRef = useRef<SheetData | null>(null);
  const firstLoad = useRef(true);
  const pullId = useRef(0);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const generation = useRef(0);
  const retryTimer = useRef<number | null>(null);
  const pulseTimer = useRef<number | null>(null);
  const alive = useRef(true);
  const pulledAt = useRef(0);

  const rememberActions = useCallback((next: PocketAction[]) => {
    actionsRef.current = next;
    writePocketActions(next);
    setActions(next);
  }, []);

  const syncActions = useCallback(async () => {
    if (syncing.current) {
      syncQueued.current = true;
      return;
    }
    syncing.current = true;
    try {
      do {
        syncQueued.current = false;
        const skipped = new Set<string>();
        for (;;) {
          const action = actionsRef.current.find((entry) => !entry.synced && !skipped.has(entry.id));
          if (!action) break;
          const result = await pushPocketAction(action);
          if (!alive.current) return;
          if (result === "ok") {
            if (!actionsRef.current.some((entry) => entry.id === action.id && !entry.synced)) continue;
            const next = actionsRef.current.map((entry) => (entry.id === action.id ? { ...entry, synced: true } : entry));
            actionsRef.current = next;
            writePocketActions(next);
            setActions(next);
            continue;
          }
          // A rejected equip or look stays on the phone and must not block a discard.
          if (result === "error" && softSyncKind(action.kind)) {
            skipped.add(action.id);
            continue;
          }
          return;
        }
      } while (syncQueued.current && alive.current);
    } finally {
      syncing.current = false;
    }
  }, []);

  const syncSellActions = useCallback(async () => {
    if (sellSyncing.current) {
      sellSyncQueued.current = true;
      return;
    }
    sellSyncing.current = true;
    try {
      do {
        sellSyncQueued.current = false;
        for (;;) {
          const action = sellActionsRef.current.find((entry) => !entry.synced);
          if (!action) break;
          const result = await pushPocketAction(action);
          // A rejected sell stays on the phone. It must not stop discard or chest sync.
          if (!alive.current || result !== "ok") return;
          const next = sellActionsRef.current.filter((entry) => entry.id !== action.id);
          sellActionsRef.current = next;
          writeSellActions(next);
        }
      } while (sellSyncQueued.current && alive.current);
    } finally {
      sellSyncing.current = false;
    }
  }, []);

  const recordSellActions = useCallback((made: PocketAction[]) => {
    if (!made.length) return;
    const next = [...sellActionsRef.current, ...made];
    sellActionsRef.current = next;
    writeSellActions(next);
    void syncSellActions();
  }, [syncSellActions]);

  const commitGear = useCallback((next: GearState, nextActions?: PocketAction[]) => {
    gearRef.current = next;
    writeGearStore(next);
    setGear(next);
    if (!nextActions) return;
    rememberActions(nextActions);
    void syncActions();
  }, [rememberActions, syncActions]);

  const applySheet = useCallback((data: SheetData) => {
    const resolved = resolveGear(data.rev, data.gear, readGearStore(), gearRef.current, actionsRef.current);
    if (resolved.dirty) writeGearStore(resolved.state);
    gearRef.current = resolved.state;
    setGear(resolved.state);
    if (!samePocketActions(resolved.actions, actionsRef.current)) rememberActions(resolved.actions);
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
  }, [rememberActions]);

  const pull = useCallback(async (manual = false, quiet = false): Promise<"live" | "fallback" | "error"> => {
    const id = ++pullId.current;
    if (!quiet) setRefreshing(true);
    try {
      let data: SheetData;
      let fromBackup = false;
      let backupReason = "";
      try {
        data = await fetchRemoteSheet();
      } catch (err) {
        backupReason = err instanceof Error ? err.message : "Supabase request failed.";
        data = await fetchSheet();
        fromBackup = true;
      }
      if (!alive.current || id !== pullId.current) return fromBackup ? "fallback" : "live";
      const source = fromBackup ? "fallback" : "live";
      if (!shouldApplySheet(sheetRef.current?.rev ?? null, data.rev, source)) {
        if (fromBackup) setLoadError(`${backupReason} Kept rev ${sheetRef.current?.rev}; backup rev ${data.rev} is older.`);
        return source;
      }
      applySheet(data);
      pulledAt.current = Date.now();
      setFallback(fromBackup);
      setLoadError(fromBackup ? backupReason : "");
      if (firstLoad.current) firstLoad.current = false;
      else if (manual) setFlash("Updated");
      return source;
    } catch (err) {
      if (!alive.current || id !== pullId.current) return "error";
      const message = err instanceof Error ? err.message : "Could not refresh.";
      setError(gearRef.current ? `${message} Showing the last sheet.` : message);
      setFallback(true);
      return "error";
    } finally {
      if (!quiet && alive.current && id === pullId.current) setRefreshing(false);
    }
  }, [applySheet]);

  const listen = useCallback(() => {
    const mine = ++generation.current;
    const previous = channelRef.current;
    const channel = openSheetChannel(
      (data) => {
        if (!alive.current || mine !== generation.current) return;
        if (!shouldApplySheet(sheetRef.current?.rev ?? null, data.rev, "live")) return;
        applySheet(data);
        setFallback(false);
        setLoadError("");
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
    void syncActions();
    void syncSellActions();
    const timer = window.setInterval(() => {
      void syncActions();
      void syncSellActions();
    }, 15000);
    return () => window.clearInterval(timer);
  }, [syncActions, syncSellActions]);

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
      void pull(false, true).then(() => {
        if (alive.current) listen();
      });
    };
    const onFocus = () => {
      void pull(false, true);
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    const poll = window.setInterval(() => void pull(false, true), 60_000);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
      window.clearInterval(poll);
    };
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
            worldTime={sheet.worldTime}
            next={sheet.next}
            rev={sheet.rev}
            syncedAt={syncedAt}
            refreshing={refreshing}
            flash={flash}
            connected={connected}
            fallback={fallback}
            loadError={loadError}
            pulsing={pulsing}
            onRefresh={() => void refresh()}
          />
          <MapTab map={sheet.map} active={tab === "map"} />
          <StatusTab sheet={sheet} active={tab === "status"} />
          <AbilitiesTab sheet={sheet} active={tab === "abilities"} />
          <PocketTab gear={gear} source={sheet.gear} actions={actions} active={tab === "pocket"} onChange={commitGear} onSellActions={recordSellActions} />
          <EquipmentTab gear={gear} source={sheet.gear} actions={actions} active={tab === "equipment"} onChange={commitGear} />
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
