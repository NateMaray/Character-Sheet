import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { applyPocketActions, equipItem, gearChangeActions, isContainer, makePocketAction, pocketActionsForDm, type GearState } from "../gear";
import {
  addSellEntries,
  clampSellQty,
  clearSellList,
  formatSellList,
  pruneSellList,
  readSellList,
  removeSellEntry,
  sameSellList,
  sellCandidates,
  sellKey,
  sellQtyText,
  writeSellList,
  type SellEntry,
} from "../sell";
import { essenceCountLabel, groupAbilities, parseAbilityDetail, rankLadder } from "../abilities";
import type { Ability, GearItem, GearSource, PocketAction, SheetData } from "../types";
import { Button, Card, Pill } from "./Bits";
import { WardrobeView } from "./WardrobeView";

type PocketPick = { item: GearItem; chest: string };

function pickKey(chest: string, name: string): string {
  return sellKey(chest, name);
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
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
    return copiedOk;
  } catch {
    return false;
  }
}

function ForSale({ on }: { on: boolean }) {
  if (!on) return null;
  return <span className="for-sale">For sale</span>;
}

function isEmptyChest(pocket: GearItem[], name: string): boolean {
  const item = pocket.find((entry) => entry.name === name);
  return Boolean(item && isContainer(item) && !(item.contents?.length));
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

function abilityMetaLine(ability: Ability): string {
  const progress = `${ability.progress}% to next rank`;
  return ability.tag ? `${ability.tag} · ${progress}` : progress;
}

function AbilityDetail({ detail }: { detail: string }) {
  const { effect, cost, cooldown } = parseAbilityDetail(detail);
  return (
    <>
      {effect ? <div className="ability-detail">{effect}</div> : null}
      {cost ? (
        <div className="ability-stat">
          <strong>Cost:</strong> {cost}
        </div>
      ) : null}
      {cooldown ? (
        <div className="ability-stat">
          <strong>Cooldown:</strong> {cooldown}
        </div>
      ) : null}
    </>
  );
}

function AbilityCard({ ability, panelId }: { ability: Ability; panelId: string }) {
  const rungs = rankLadder(ability);
  return (
    <Card>
      <div className="card-head">
        <span className="title">{ability.name}</span>
        <Pill text={ability.rank} on />
      </div>
      <div className="meta">{abilityMetaLine(ability)}</div>
      <div className="track" style={{ height: 8 }}>
        <span style={{ width: `${Math.max(ability.progress, 2)}%`, ["--bar" as string]: "var(--accent)" }} />
      </div>
      <AbilityDetail detail={ability.detail} />
      <details className="rank-details" name="ability-ranks">
        <summary aria-controls={panelId}>
          <span>Ranks</span>
          <span className="chev" aria-hidden="true" />
        </summary>
        <ol className="rank-ladder" id={panelId} aria-label={`${ability.name} rank ladder`}>
          {rungs.map((rung) => (
            <li key={rung.name} className={`rank-rung is-${rung.state}`} aria-current={rung.state === "current" ? "true" : undefined}>
              <span className="rank-name">{rung.name}</span>
              {rung.text ? <span className="rank-text">{rung.text}</span> : null}
            </li>
          ))}
        </ol>
      </details>
    </Card>
  );
}

export function AbilitiesTab({ sheet, active }: { sheet: SheetData; active: boolean }) {
  const groups = groupAbilities(sheet.abilities);
  return (
    <section className="stack panel" hidden={!active} aria-hidden={!active}>
      {groups.map((group) => (
        <div key={group.essence} className="essence-group">
          <div className="essence-head">
            <h2 className="section-label">{group.essence.toUpperCase()}</h2>
            <span className="essence-count">{essenceCountLabel(group.essence, group.abilities.length)}</span>
          </div>
          {group.abilities.map((ability, index) => (
            <AbilityCard key={`${group.essence}-${ability.name}-${index}`} ability={ability} panelId={`rank-ladder-${group.essence}-${index}`} />
          ))}
        </div>
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
  onSellActions,
}: {
  active: boolean;
  gear: GearState;
  source: GearSource;
  actions: PocketAction[];
  onChange: (next: GearState, actions?: PocketAction[]) => void;
  onSellActions: (actions: PocketAction[]) => void;
}) {
  // Wardrobe clothes are not pocket rows, so they never spend one of these slots.
  const slots = source.pocketSlots || 40;
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [openChests, setOpenChests] = useState<Record<string, boolean>>({});
  const [confirming, setConfirming] = useState<PocketPick[] | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState(false);
  const [sellList, setSellList] = useState<SellEntry[]>(() => readSellList());
  const [selling, setSelling] = useState(false);
  const [wardrobeOpen, setWardrobeOpen] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, { on: boolean; qty: number }>>({});
  const [copiedSell, setCopiedSell] = useState(false);
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

  useEffect(() => {
    if (!copiedSell) return;
    const timer = window.setTimeout(() => setCopiedSell(false), 1600);
    return () => window.clearTimeout(timer);
  }, [copiedSell]);

  useEffect(() => {
    const pruned = pruneSellList(sellList, gear.pocket);
    if (sameSellList(pruned, sellList)) return;
    writeSellList(pruned);
    setSellList(pruned);
  }, [gear.pocket, sellList]);

  useEffect(() => {
    if (!selling) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelling(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [selling]);

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
    const ok = await copyText(pocketActionsForDm(actions));
    if (ok) {
      setCopied(true);
      setNotice("");
      return;
    }
    setNotice("Could not copy. The changes are still saved on this phone.");
  };

  const forSale = (chest: string, name: string) => sellList.some((entry) => entry.item === name && entry.chest === chest);

  const commitSell = (next: SellEntry[], removed: SellEntry[], added: SellEntry[]) => {
    writeSellList(next);
    setSellList(next);
    const made = [
      ...removed.map((entry) => makePocketAction("unsell", { name: entry.item, qty: sellQtyText(entry.qty) }, entry.chest, gear.rev)),
      ...added.map((entry) => makePocketAction("sell", { name: entry.item, qty: sellQtyText(entry.qty) }, entry.chest, gear.rev)),
    ];
    if (made.length) onSellActions(made);
  };

  const openSell = () => {
    setWardrobeOpen(false);
    const next: Record<string, { on: boolean; qty: number }> = {};
    for (const candidate of sellCandidates(gear.pocket)) {
      const key = sellKey(candidate.chest, candidate.name);
      next[key] = { on: Boolean(selected[key]), qty: candidate.max };
    }
    setDrafts(next);
    setSelling(true);
  };

  const confirmSell = () => {
    const chosen: SellEntry[] = [];
    for (const candidate of sellCandidates(gear.pocket)) {
      const key = sellKey(candidate.chest, candidate.name);
      const draft = drafts[key];
      if (!draft?.on) continue;
      const qty = candidate.picker ? clampSellQty(draft.qty, candidate.max) : 1;
      chosen.push({ item: candidate.name, chest: candidate.chest, qty });
    }
    if (!chosen.length) return;
    const change = addSellEntries(sellList, chosen);
    commitSell(change.list, change.removed, change.added);
    setSelling(false);
  };

  const copySellList = async () => {
    const ok = await copyText(formatSellList(sellList));
    if (ok) {
      setCopiedSell(true);
      setNotice("");
      return;
    }
    setNotice("Could not copy. The sell list is still saved on this phone.");
  };

  const candidates = sellCandidates(gear.pocket);
  const chosenCount = candidates.filter((candidate) => drafts[sellKey(candidate.chest, candidate.name)]?.on).length;

  return (
    <section className="panel" hidden={!active} aria-hidden={!active}>
      <div className="pocket-head">
        <div className="section-label">
          {gear.pocket.length} OF {slots} SLOTS USED
        </div>
        <div className="btn-row">
          <Button label="Sell" onClick={openSell} />
          <Button
            label="Wardrobe"
            ariaLabel="Open wardrobe. These clothes do not use inventory slots."
            onClick={() => {
              setSelling(false);
              setWardrobeOpen(true);
            }}
          />
          <Button label={selecting ? "Done" : "Select"} onClick={() => (selecting ? finishSelect() : setSelecting(true))} />
        </div>
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
      <div className="card sell-panel">
        <div className="card-head">
          <div className="title">Sell list</div>
          <div className="btn-row">
            <Button
              label="Clear"
              disabled={sellList.length === 0}
              onClick={() => {
                const change = clearSellList(sellList);
                commitSell(change.list, change.removed, change.added);
              }}
            />
            <Button label={copiedSell ? "Copied" : "Copy sell list"} onClick={() => void copySellList()} />
          </div>
        </div>
        <p className="meta">DM sets the price.</p>
        {sellList.length === 0 ? (
          <p className="body">Nothing listed.</p>
        ) : (
          <ul className="sell-rows">
            {sellList.map((entry) => (
              <li key={sellKey(entry.chest, entry.item)} className="sell-row">
                <span className="sell-label">
                  <span className="title">
                    {entry.item} <span className="slot-qty">x{entry.qty}</span>
                  </span>
                  {entry.chest ? <span className="meta">In {entry.chest}</span> : null}
                </span>
                <Button label="×" ariaLabel={`Remove ${entry.item} from the sell list`} onClick={() => commitSell(removeSellEntry(sellList, entry.item, entry.chest), [entry], [])} />
              </li>
            ))}
          </ul>
        )}
      </div>
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
                <ForSale on={count === 0 && forSale("", chest.name)} />
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
                              <ForSale on={forSale(chest.name, item.name)} />
                            </button>
                          ) : (
                            <div className="chest-item">
                              <span className="slot-name">
                                <span>{item.name}</span>
                                <span className="slot-qty">{item.qty}</span>
                              </span>
                              {item.note ? <span className="slot-note">{item.note}</span> : null}
                              <ForSale on={forSale(chest.name, item.name)} />
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
              <ForSale on={forSale("", item.name)} />
              {selecting && itemSelected ? <div className="hint">SELECTED</div> : null}
              {!selecting && targets && targets.length ? (
                <div style={{ marginTop: 8 }}>
                  <Button
                    label={`Equip to ${targets[0]}`}
                    onClick={() => {
                      const next = equipItem(gear, source, item);
                      if (!next) return;
                      const made = gearChangeActions(gear, next);
                      onChange(next, made.length ? [...actions, ...made] : undefined);
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
        <div>
          <div className="section-label">{waitingLabel(actions.length)}</div>
          {actions.some((action) => !action.synced && (action.kind === "equip" || action.kind === "unequip")) ? (
            <div className="not-synced">Not synced</div>
          ) : null}
          <div className="pocket-rev">rev {gear.rev}</div>
        </div>
        <Button label={copied ? "Copied" : "Copy for DM"} onClick={() => void copyForDm()} />
      </footer>
      {wardrobeOpen ? (
        <WardrobeView source={source} gear={gear} actions={actions} onChange={onChange} onClose={() => setWardrobeOpen(false)} />
      ) : null}
      {selling
        ? createPortal(
        <div className="sheet-backdrop" onClick={() => setSelling(false)}>
          <div
            className="card sheet-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sell-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="card-head">
              <div className="title" id="sell-title">
                Sell
              </div>
              <Button label="Cancel" onClick={() => setSelling(false)} />
            </div>
            <p className="meta">DM sets the price.</p>
            {candidates.length === 0 ? (
              <p className="body">Nothing in your pocket to sell.</p>
            ) : (
              <div className="sell-options">
                {candidates.map((candidate, index) => {
                  const key = sellKey(candidate.chest, candidate.name);
                  const draft = drafts[key] ?? { on: false, qty: candidate.max };
                  const qty = candidate.picker ? clampSellQty(draft.qty, candidate.max) : 1;
                  return (
                    <div key={`${key}-${index}`} className="sell-option">
                      <label>
                        <input
                          type="checkbox"
                          checked={draft.on}
                          onChange={() =>
                            setDrafts((current) => {
                              const row = current[key] ?? { on: false, qty: candidate.max };
                              return { ...current, [key]: { ...row, on: !row.on } };
                            })
                          }
                        />
                        <span className="sell-name">
                          <span className="title">{candidate.name}</span>
                          {candidate.chest ? <span className="meta">In {candidate.chest}</span> : null}
                          {!candidate.chest && isEmptyChest(gear.pocket, candidate.name) ? <span className="meta">Empty chest</span> : null}
                        </span>
                      </label>
                      {candidate.picker ? (
                        <span className="qty-step">
                          <button
                            type="button"
                            className="btn"
                            aria-label={`Fewer ${candidate.name}`}
                            disabled={qty <= 1}
                            onClick={() =>
                              setDrafts((current) => {
                                const row = current[key] ?? { on: false, qty: candidate.max };
                                return { ...current, [key]: { ...row, qty: clampSellQty(row.qty - 1, candidate.max) } };
                              })
                            }
                          >
                            −
                          </button>
                          <input
                            type="number"
                            inputMode="numeric"
                            min={1}
                            max={candidate.max}
                            aria-label={`Quantity of ${candidate.name}`}
                            value={qty}
                            onChange={(event) => {
                              const nextQty = clampSellQty(Number(event.target.value), candidate.max);
                              setDrafts((current) => {
                                const row = current[key] ?? { on: false, qty: candidate.max };
                                return { ...current, [key]: { ...row, qty: nextQty } };
                              });
                            }}
                          />
                          <button
                            type="button"
                            className="btn"
                            aria-label={`More ${candidate.name}`}
                            disabled={qty >= candidate.max}
                            onClick={() =>
                              setDrafts((current) => {
                                const row = current[key] ?? { on: false, qty: candidate.max };
                                return { ...current, [key]: { ...row, qty: clampSellQty(row.qty + 1, candidate.max) } };
                              })
                            }
                          >
                            +
                          </button>
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
            <div className="sheet-actions">
              <Button label="Add to sell list" variant="primary" disabled={chosenCount === 0} onClick={confirmSell} />
              <Button label="Cancel" onClick={() => setSelling(false)} />
            </div>
          </div>
        </div>,
          document.body,
        )
        : null}
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
