import { useState } from "react";
import { deleteLoadout, equipToSlot, gearChangeActions, isBorrowed, itemsForSlot, loadLoadout, saveLoadout, unequip, unwearWardrobeItem, DEFAULT_DOLL, type GearState } from "../gear";
import type { GearSource, PocketAction } from "../types";
import { Button } from "./Bits";
import { LooksPanel } from "./LooksPanel";

function unsyncedEquip(actions: PocketAction[]): boolean {
  return actions.some((action) => !action.synced && (action.kind === "equip" || action.kind === "unequip"));
}

export function EquipmentTab({
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
  const [showLoadouts, setShowLoadouts] = useState(false);
  const [showLooks, setShowLooks] = useState(false);
  const [loadoutName, setLoadoutName] = useState("");
  const [pickedSlot, setPickedSlot] = useState<string | null>(null);
  const doll = source.doll?.length ? source.doll : DEFAULT_DOLL;

  const commit = (next: GearState | null) => {
    if (!next || next === gear) return;
    const made = gearChangeActions(gear, next);
    onChange(next, made.length ? [...actions, ...made] : undefined);
  };

  const unequipSlot = (slotName: string) => {
    commit(unequip(gear, source, slotName));
  };

  return (
    <section className="panel" hidden={!active} aria-hidden={!active}>
      <div className="card-head" style={{ marginBottom: 12 }}>
        <div className="section-label">EQUIPPED · UNEQUIP MOVES AN ITEM TO POCKET SPACE</div>
        <div className="btn-row">
          <Button label={showLooks ? "Hide looks" : "Looks"} onClick={() => setShowLooks((value) => !value)} />
          <Button label={showLoadouts ? "Hide loadouts" : "Loadouts"} onClick={() => setShowLoadouts((value) => !value)} />
        </div>
      </div>
      {unsyncedEquip(actions) ? <p className="not-synced">Not synced</p> : null}
      {showLooks ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <LooksPanel gear={gear} source={source} actions={actions} onChange={onChange} />
        </div>
      ) : null}
      {showLoadouts ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="title">Loadouts</div>
          <p className="body">Save the current setup under a name, or load a saved one. Combat and Travel ship as defaults.</p>
          <div className="btn-row" style={{ marginTop: 12, alignItems: "flex-end" }}>
            <label className="field">
              <span>Loadout name</span>
              <input
                value={loadoutName}
                placeholder="Name this setup"
                autoComplete="off"
                onChange={(event) => setLoadoutName(event.target.value)}
              />
            </label>
            <Button
              label="Save current"
              variant="primary"
              disabled={!loadoutName.trim()}
              onClick={() => {
                const next = saveLoadout(gear, loadoutName);
                if (!next) return;
                commit(next);
                setLoadoutName("");
              }}
            />
          </div>
          <div style={{ marginTop: 8 }}>
            {gear.loadouts.map((loadout) => {
              const summary = loadout.equipped.filter((slot) => slot.name).map((slot) => `${slot.slot}: ${slot.name}`).join(" · ") || "Nothing equipped";
              return (
                <div key={loadout.name} className="loadout">
                  <div style={{ flex: "1 1 200px" }}>
                    <div className="title">{loadout.name}</div>
                    <div className="body">{summary}</div>
                  </div>
                  <div className="btn-row">
                    <Button label="Load" onClick={() => commit(loadLoadout(gear, source, loadout))} />
                    <Button label="Delete" variant="danger" onClick={() => commit(deleteLoadout(gear, loadout.name))} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
      <div className="doll">
        {doll.map((row, rowIndex) =>
          row.map((slot, colIndex) => {
            if (!slot) return <div key={`pad-${rowIndex}-${colIndex}`} />;
            const item = gear.equipped.find((entry) => entry.slot === slot);
            const clothes = item?.clothes ?? [];
            const filled = Boolean(item && (item.name || clothes.length));
            const selected = pickedSlot === slot;
            const cls = `doll-slot${filled ? " filled" : ""}${selected ? " selected" : ""}`;
            return (
              <button key={slot} type="button" className={cls} onClick={() => setPickedSlot(selected ? null : slot)}>
                <div className="section-label">
                  {slot.toUpperCase()}
                  {filled || !item ? "" : ` · ${item.empty.toUpperCase()}`}
                </div>
                {item?.name ? (
                  <>
                    <div className="title" style={{ marginTop: 6 }}>
                      {item.name}
                    </div>
                    {item.note ? <div className="body">{item.note}</div> : null}
                    {isBorrowed(item.name, source.borrowed) ? <div className="borrowed">BORROWED</div> : null}
                  </>
                ) : clothes.length ? null : (
                  <div className="body">
                    {slot}: {item ? item.empty : "empty"}
                  </div>
                )}
                {clothes.length ? (
                  <div className="worn-list">
                    <div className="section-label">WORN CLOTHES</div>
                    <ul>
                      {clothes.map((cloth) => (
                        <li key={cloth.name}>{cloth.name}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <div className="hint">{selected ? "SELECTED" : "TAP TO EQUIP"}</div>
              </button>
            );
          }),
        )}
      </div>
      {pickedSlot ? (
        <div className="card" style={{ marginTop: 16, maxWidth: 720, marginLeft: "auto", marginRight: "auto" }}>
          <div className="card-head">
            <div className="title">Choose for {pickedSlot}</div>
            <Button label="Close" onClick={() => setPickedSlot(null)} />
          </div>
          {(() => {
            const worn = gear.equipped.find((entry) => entry.slot === pickedSlot);
            const fits = itemsForSlot(gear.pocket, source, pickedSlot);
            const emptyMsg = pickedSlot === "Head" || pickedSlot === "Armour" ? "No armour in your pocket yet." : "Nothing in your pocket fits this slot.";
            return (
              <div style={{ marginTop: 12 }}>
                {worn && worn.name ? (
                  <div className="body" style={{ marginBottom: 12 }}>
                    Currently equipped: <strong style={{ color: "var(--text)" }}>{worn.name}</strong>
                    <div style={{ marginTop: 8 }}>
                      <Button label="Unequip" onClick={() => unequipSlot(pickedSlot)} />
                    </div>
                  </div>
                ) : null}
                {worn?.clothes?.length ? (
                  <div className="worn-list" style={{ marginBottom: 12 }}>
                    <div className="section-label">WORN CLOTHES</div>
                    {worn.clothes.map((cloth) => (
                      <div key={cloth.name} className="look-head">
                        <div className="title">{cloth.name}</div>
                        <Button label="Unequip" ariaLabel={`Unequip ${cloth.name}`} onClick={() => commit(unwearWardrobeItem(gear, cloth.name))} />
                      </div>
                    ))}
                  </div>
                ) : null}
                {fits.length === 0 ? (
                  <div className="body">{emptyMsg}</div>
                ) : (
                  <div className="pick-list">
                    {fits.map((item) => (
                      <button
                        key={item.name}
                        type="button"
                        className="pick"
                        onClick={() => {
                          const next = equipToSlot(gear, source, item, pickedSlot);
                          if (next) commit(next);
                          setPickedSlot(null);
                        }}
                      >
                        <div className="title">
                          {item.name}
                          {item.qty ? `  ${item.qty}` : ""}
                        </div>
                        {item.note ? <div className="body">{item.note}</div> : null}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      ) : null}
    </section>
  );
}
