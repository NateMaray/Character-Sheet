import { useEffect, useState } from "react";
import { applyPocketActions, equipItem, isContainer, makePocketAction, pocketActionsForDm, type GearState } from "../gear";
import type { GearItem, GearSource, PocketAction, SheetData } from "../types";
import { Button, Card, Pill } from "./Bits";

type PocketPick = { item: GearItem; chest: string };

function pickKey(chest: string, name: string): string {
  return `${chest}\n${name}`;
}

function picksFrom(pocket: GearItem[], selected: Record<string, boolean>): PocketPick[] {
  const picks: PocketPick[] = [];
  for (const item of pocket) {
    if (selected[pickKey("", item.name)]) picks.push({ item, chest: "" });
    for (const inner of item.contents || []) {
      if (selected[pickKey(item.name, inner.name)]) picks.push({ item: inner, chest: item.name });
    }
  }
  return picks;
}

function discardPicks(picks: PocketPick[]): PocketPick[] {
  const chests = new Set(picks.filter((pick) => !pick.chest && isContainer(pick.item)).map((pick) => pick.item.name));
  return picks.filter((pick) => !pick.chest || !chests.has(pick.chest));
}

function contentsNote(picks: PocketPick[]): string {
  return picks
    .filter((pick) => !pick.chest && isContainer(pick.item) && (pick.item.contents?.length || 0) > 0)
    .map((pick) => `Discarding ${pick.item.name}: its contents go too.`)
    .join(" ");
}

function countLabel(count: number): string {
  return `${count} ${count === 1 ? "item" : "items"}`;
}

function waitingLabel(count: number): string {
  return `${count} ${count === 1 ? "change" : "changes"} waiting for the DM`;
}

function missionPills(mission: SheetData["missions"][number]) {
  return (
    <span className="pills">
      {mission.kind ? <Pill text={mission.kind} on={mission.kind === "SYSTEM"} /> : null}
      {mission.filler ? <Pill text="FILLER" on={false} /> : null}
      <Pill text={mission.status} on={mission.status === "ACTIVE"} />
    </span>
  );
}

export function StatusTab({ sheet, active }: { sheet: SheetData; active: boolean }) {
  const spots = sheet.status.missionNames
    .map((name) => sheet.missions.find((mission) => mission.name === name))
    .filter((mission): mission is SheetData["missions"][number] => Boolean(mission));
  return (
    <section className="stack panel" hidden={!active} aria-hidden={!active}>
      {spots.map((mission) => (
        <Card key={mission.name}>
          <div className="card-head">
            <span className="title">{mission.name}</span>
            {missionPills(mission)}
          </div>
          <div className="body">{mission.detail}</div>
        </Card>
      ))}
      <div className="section-label">RECENT LOG</div>
      {sheet.status.log.map((entry) => (
        <Card key={entry.title}>
          <div className="title">{entry.title}</div>
          <div className="body">{entry.detail}</div>
        </Card>
      ))}
    </section>
  );
}

export function AbilitiesTab({ sheet, active }: { sheet: SheetData; active: boolean }) {
  return (
    <section className="stack panel" hidden={!active} aria-hidden={!active}>
      {sheet.abilities.map((ability) => (
        <Card key={ability.name}>
          <div className="card-head">
            <span className="title">{ability.name}</span>
            <Pill text={ability.rank} on />
          </div>
          <div className="meta">
            {ability.tag} · {ability.progress}% to next rank
          </div>
          <div className="track" style={{ height: 8 }}>
            <span style={{ width: `${Math.max(ability.progress, 2)}%`, ["--bar" as string]: "var(--accent)" }} />
          </div>
          <div className="body">{ability.detail}</div>
        </Card>
      ))}
      <div className="section-label">{sheet.abilityMeta.slotsLabel}</div>
      <div className="section-label">{sheet.abilityMeta.racialLabel}</div>
      <div className="grid">
        {sheet.racial.map((gift) => (
          <Card key={gift.name}>
            <div className="title">{gift.name}</div>
            <div className="body">{gift.detail}</div>
          </Card>
        ))}
      </div>
    </section>
  );
}

export function PocketTab({
  active,
  gear,
  source,
  actions,
  onChange,
}: {
  active: boolean;
  gear: GearState;
  source: GearSource;
  actions: PocketAction[];
  onChange: (next: GearState, actions?: PocketAction[]) => void;
}) {
  const slots = source.pocketSlots || 40;
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [openChests, setOpenChests] = useState<Record<string, boolean>>({});
  const [confirming, setConfirming] = useState<PocketPick[] | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState(false);
  const chests = gear.pocket.filter(isContainer);
  const loose = gear.pocket.filter((item) => !isContainer(item));
  const empties = Math.max(0, slots - gear.pocket.length);
  const picks = picksFrom(gear.pocket, selected);
  const destinations = chests.filter((chest) => picks.some((pick) => !isContainer(pick.item) && pick.chest !== chest.name));
  const canChest = destinations.length > 0;

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const toggleSelect = (chest: string, name: string) => {
    const key = pickKey(chest, name);
    setSelected((current) => ({ ...current, [key]: !current[key] }));
  };

  const finishSelect = () => {
    setSelecting(false);
    setSelected({});
    setConfirming(null);
    setChoosing(false);
  };

  const commitMoves = (made: PocketAction[], pocket: GearState["pocket"]) => {
    onChange({ ...gear, pocket }, [...actions, ...made]);
    setSelected({});
    setConfirming(null);
    setChoosing(false);
    setNotice("");
  };

  const runMoves = (moves: { kind: PocketAction["kind"]; item: GearItem; chest: string }[]) => {
    let pocket = gear.pocket;
    const made: PocketAction[] = [];
    for (const move of moves) {
      const action = makePocketAction(move.kind, move.item, move.chest, gear.rev);
      const next = applyPocketActions(pocket, [action], slots);
      if (next === pocket) continue;
      pocket = next;
      made.push(action);
    }
    if (!made.length) return false;
    commitMoves(made, pocket);
    return true;
  };

  const takeOut = (chestName: string, item: GearItem) => {
    if (gear.pocket.length >= slots) {
      setNotice("Pocket space is full.");
      return;
    }
    if (!runMoves([{ kind: "from_chest", item, chest: chestName }])) setNotice("Pocket space is full.");
  };

  const moveToChest = (chestName: string) => {
    const moves = picks
      .filter((pick) => !isContainer(pick.item) && pick.chest !== chestName)
      .map((pick) => ({ kind: "to_chest" as const, item: pick.item, chest: chestName }));
    if (!moves.length) return;
    runMoves(moves);
  };

  const copyForDm = async () => {
    const text = pocketActionsForDm(actions);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setNotice("");
        return;
      }
    } catch {
      // Some browsers only allow the clipboard from a focused gesture. Fall through.
    }
    try {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.left = "-9999px";
      document.body.appendChild(area);
      area.select();
      const copiedOk = document.execCommand("copy");
      area.remove();
      if (!copiedOk) throw new Error("copy failed");
      setCopied(true);
      setNotice("");
    } catch {
      setNotice("Could not copy. The changes are still saved on this phone.");
    }
  };

  return (
    <section className="panel" hidden={!active} aria-hidden={!active}>
      <div className="pocket-head">
        <div className="section-label">
          {gear.pocket.length} OF {slots} SLOTS USED
        </div>
        <Button label={selecting ? "Done" : "Select"} onClick={() => (selecting ? finishSelect() : setSelecting(true))} />
      </div>
      {selecting ? <p className="sub">Tap an item to select it, including things inside a chest.</p> : null}
      {selecting ? (
        <div className="btn-row pocket-actions">
          <Button label="Discard" variant="danger" disabled={picks.length === 0} onClick={() => setConfirming(discardPicks(picks))} />
          <Button
            label="Put in chest"
            disabled={!canChest}
            onClick={() => {
              if (chests.length === 1) moveToChest(chests[0].name);
              else setChoosing(true);
            }}
          />
        </div>
      ) : null}
      {notice ? (
        <p className="pocket-note" role="alert">
          {notice}
        </p>
      ) : null}
      {confirming ? (
        <div className="card pocket-confirm" role="alertdialog" aria-label="Discard items">
          <div className="title">Discard these items?</div>
          <ul className="confirm-list">
            {confirming.map((pick, index) => (
              <li key={`${pick.chest}\n${pick.item.name}\n${index}`}>{pick.item.name}</li>
            ))}
          </ul>
          {contentsNote(confirming) ? <p className="body">{contentsNote(confirming)}</p> : null}
          <div className="btn-row" style={{ marginTop: 12 }}>
            <Button
              label="Discard"
              variant="danger"
              onClick={() => runMoves(confirming.map((pick) => ({ kind: "discard", item: pick.item, chest: pick.chest })))}
            />
            <Button label="Cancel" onClick={() => setConfirming(null)} />
          </div>
        </div>
      ) : null}
      {choosing ? (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="card-head">
            <div className="title">Put in which chest?</div>
            <Button label="Cancel" onClick={() => setChoosing(false)} />
          </div>
          <div className="pick-list">
            {destinations.map((chest) => (
              <button key={chest.name} type="button" className="pick" onClick={() => moveToChest(chest.name)}>
                <div className="title">{chest.name}</div>
                {chest.note ? <div className="body">{chest.note}</div> : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {chests.length ? (
        <div className="chest-list">
          {chests.map((chest) => {
            const chestSelected = Boolean(selected[pickKey("", chest.name)]);
            const open = Boolean(openChests[chest.name]);
            const count = chest.contents?.length || 0;
            return (
              <article key={chest.name} className={chestSelected ? "card selected" : "card"}>
                <div className="card-head">
                  {selecting ? (
                    <button type="button" className="chest-select" aria-pressed={chestSelected} onClick={() => toggleSelect("", chest.name)}>
                      <span className="title">{chest.name}</span>
                      {chestSelected ? <span className="hint">SELECTED</span> : null}
                    </button>
                  ) : (
                    <span className="title">{chest.name}</span>
                  )}
                  <Button
                    label={open ? "Hide contents" : "Show contents"}
                    onClick={() => setOpenChests((current) => ({ ...current, [chest.name]: !current[chest.name] }))}
                  />
                </div>
                {chest.note ? <div className="slot-note">{chest.note}</div> : null}
                <div className="meta">{countLabel(count)}</div>
                {open ? (
                  count ? (
                    chest.contents?.map((item) => {
                      const rowSelected = Boolean(selected[pickKey(chest.name, item.name)]);
                      return (
                        <div key={item.name} className={rowSelected ? "chest-row selected" : "chest-row"}>
                          {selecting ? (
                            <button type="button" className="chest-item" aria-pressed={rowSelected} onClick={() => toggleSelect(chest.name, item.name)}>
                              <span className="slot-name">
                                <span>{item.name}</span>
                                <span className="slot-qty">{item.qty}</span>
                              </span>
                              {item.note ? <span className="slot-note">{item.note}</span> : null}
                            </button>
                          ) : (
                            <div className="chest-item">
                              <span className="slot-name">
                                <span>{item.name}</span>
                                <span className="slot-qty">{item.qty}</span>
                              </span>
                              {item.note ? <span className="slot-note">{item.note}</span> : null}
                            </div>
                          )}
                          <Button label="Take out" onClick={() => takeOut(chest.name, item)} />
                        </div>
                      );
                    })
                  ) : (
                    <p className="body">Empty.</p>
                  )
                ) : null}
              </article>
            );
          })}
        </div>
      ) : null}
      <div className="pocket-grid">
        {loose.map((item) => {
          const targets = (source.equipTargets[item.name] || []).filter((slotName) => gear.equipped.some((entry) => entry.slot === slotName));
          const itemSelected = Boolean(selected[pickKey("", item.name)]);
          const cls = `slot-cell filled${itemSelected ? " selected" : ""}`;
          const body = (
            <>
              <div className="slot-name">
                <span>{item.name}</span>
                <span className="slot-qty">{item.qty}</span>
              </div>
              {item.note ? <div className="slot-note">{item.note}</div> : null}
              {selecting && itemSelected ? <div className="hint">SELECTED</div> : null}
              {!selecting && targets && targets.length ? (
                <div style={{ marginTop: 8 }}>
                  <Button
                    label={`Equip to ${targets[0]}`}
                    onClick={() => {
                      const next = equipItem(gear, source, item);
                      if (next) onChange(next);
                    }}
                  />
                </div>
              ) : null}
            </>
          );
          if (!selecting) {
            return (
              <div key={item.name} className={cls} title={item.note || item.name}>
                {body}
              </div>
            );
          }
          return (
            <button key={item.name} type="button" className={cls} title={item.note || item.name} aria-pressed={itemSelected} onClick={() => toggleSelect("", item.name)}>
              {body}
            </button>
          );
        })}
        {Array.from({ length: empties }).map((_, index) => (
          <div key={`empty-${index}`} className="slot-cell" title="Empty" />
        ))}
      </div>
      <footer className="pocket-footer">
        <div className="section-label">{waitingLabel(actions.length)}</div>
        <Button label={copied ? "Copied" : "Copy for DM"} onClick={() => void copyForDm()} />
      </footer>
    </section>
  );
}

export function MissionsTab({ sheet, active }: { sheet: SheetData; active: boolean }) {
  return (
    <section className="stack panel" hidden={!active} aria-hidden={!active}>
      {sheet.missions.map((mission) => (
        <Card key={mission.name}>
          <div className="card-head">
            <span className="title">{mission.name}</span>
            {missionPills(mission)}
          </div>
          <div className="body">{mission.detail}</div>
        </Card>
      ))}
    </section>
  );
}

export function EssencesTab({ sheet, active }: { sheet: SheetData; active: boolean }) {
  return (
    <section className="stack panel" hidden={!active} aria-hidden={!active}>
      <div className="grid">
        {sheet.essences.map((essence, index) => (
          <Card key={essence.name + index}>
            <div className="card-head">
              <span className="title">{essence.name}</span>
              <Pill text={essence.state === "Absorbed" ? "LOCKED" : "OPEN"} on={essence.state === "Absorbed"} />
            </div>
            <div className="body">{essence.state}</div>
          </Card>
        ))}
      </div>
      {sheet.essenceNotes.map((note) => (
        <Card key={note.name}>
          <div className="card-head">
            <span className="title">{note.name}</span>
            {note.tag ? <Pill text={note.tag} on={false} /> : null}
          </div>
          <div className="body">{note.detail}</div>
        </Card>
      ))}
    </section>
  );
}

export function AchievementsTab({ sheet, active }: { sheet: SheetData; active: boolean }) {
  return (
    <section className="panel" hidden={!active} aria-hidden={!active}>
      <div className="grid">
        {sheet.achievements.map((feat) => (
          <Card key={feat.name}>
            <div className="title">{feat.name}</div>
            <div className="body">{feat.detail}</div>
          </Card>
        ))}
      </div>
    </section>
  );
}

export function ProfileTab({ sheet, active }: { sheet: SheetData; active: boolean }) {
  return (
    <section className="card panel" hidden={!active} aria-hidden={!active}>
      {sheet.profile.map((row) => (
        <div key={row.label} className="profile-row">
          <span className="section-label k">{row.label.toUpperCase()}</span>
          <span className="v">{row.value}</span>
        </div>
      ))}
    </section>
  );
}
