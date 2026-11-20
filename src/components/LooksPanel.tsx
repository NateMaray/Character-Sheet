import { useState } from "react";
import { makePocketAction, wearLook, type GearState } from "../gear";
import { MAX_LOOKS, capturePieces, deleteLook, lookFromPieces, piecesFromLook, renameLook, saveLook } from "../looks";
import type { GearSource, PocketAction, WardrobeOutfit } from "../types";
import { Button } from "./Bits";

function unsyncedLooks(actions: PocketAction[]): boolean {
  return actions.some(
    (action) => !action.synced && (action.kind === "save_look" || action.kind === "delete_look" || action.kind === "wear_look" || action.kind === "rename_look"),
  );
}

export function LooksPanel({
  gear,
  source,
  actions,
  onChange,
}: {
  gear: GearState;
  source: GearSource;
  actions: PocketAction[];
  onChange: (next: GearState, actions?: PocketAction[]) => void;
}) {
  const [name, setName] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const trimmed = name.trim();
  const exists = gear.looks.some((look) => look.name === trimmed);
  const full = gear.looks.length >= MAX_LOOKS && !exists;
  const slots = Array.from({ length: MAX_LOOKS }, (_, index) => gear.looks[index] ?? null);

  const commit = (next: GearState, made: PocketAction[]) => {
    onChange(next, made.length ? [...actions, ...made] : undefined);
  };

  const save = () => {
    const look = lookFromPieces(trimmed, capturePieces(gear.equipped, source.borrowed));
    if (!look) return;
    const looks = saveLook(gear.looks, look);
    if (!looks) return;
    const action = makePocketAction("save_look", { name: look.name, qty: "" }, "", gear.rev, { detail: look.pieces ?? [] });
    commit({ ...gear, looks }, [action]);
    setName("");
  };

  const wear = (look: WardrobeOutfit) => {
    const detail = piecesFromLook(look, source);
    const next = wearLook(gear, detail, source);
    const action = makePocketAction("wear_look", { name: look.name, qty: "" }, "", gear.rev, { detail });
    commit(next, [action]);
  };

  const remove = (look: WardrobeOutfit) => {
    const action = makePocketAction("delete_look", { name: look.name, qty: "" }, "", gear.rev, { detail: look.pieces ?? [] });
    commit({ ...gear, looks: deleteLook(gear.looks, look.name) }, [action]);
    if (renaming === look.name) setRenaming(null);
  };

  const rename = (look: WardrobeOutfit) => {
    const looks = renameLook(gear.looks, look.name, renameDraft);
    if (!looks) return;
    const action = makePocketAction("rename_look", { name: renameDraft.trim(), qty: "" }, "", gear.rev, { detail: { from: look.name } });
    commit({ ...gear, looks }, [action]);
    setRenaming(null);
    setRenameDraft("");
  };

  return (
    <div className="looks" id="looks-panel">
      <div className="card-head">
        <div className="section-label">
          LOOKS · {gear.looks.length} OF {MAX_LOOKS}
        </div>
      </div>
      {unsyncedLooks(actions) ? <p className="not-synced">Not synced</p> : null}
      <p className="body">Save what you are wearing, including weapons. Ten looks. Wearing one puts those pieces on.</p>
      <div className="btn-row" style={{ marginTop: 8, alignItems: "flex-end" }}>
        <label className="field">
          <span>Look name</span>
          <input value={name} placeholder="Name this look" autoComplete="off" maxLength={40} onChange={(event) => setName(event.target.value)} />
        </label>
        <Button label={exists ? "Overwrite look" : "Save current look"} variant="primary" disabled={!trimmed || full} onClick={save} />
      </div>
      {full ? <p className="meta">Ten looks saved. Delete one or overwrite a name.</p> : null}
      <ol className="look-slots">
        {slots.map((look, index) => (
          <li key={look ? look.name : `empty-${index}`} className={look ? "look-slot filled" : "look-slot"}>
            {look ? (
              <>
                <div className="look-head">
                  <div className="look-copy">
                    <div className="title">{look.name}</div>
                    <div className="look-items">{look.items.length ? look.items.join(" · ") : "Nothing worn"}</div>
                  </div>
                  <Button label="Wear look" variant="primary" onClick={() => wear(look)} />
                </div>
                {renaming === look.name ? (
                  <div className="btn-row" style={{ marginTop: 8, alignItems: "flex-end" }}>
                    <label className="field">
                      <span>New name</span>
                      <input value={renameDraft} autoComplete="off" maxLength={40} onChange={(event) => setRenameDraft(event.target.value)} />
                    </label>
                    <Button label="Save name" disabled={!renameDraft.trim() || renameDraft.trim() === look.name} onClick={() => rename(look)} />
                    <Button label="Cancel" onClick={() => setRenaming(null)} />
                  </div>
                ) : (
                  <div className="btn-row" style={{ marginTop: 8 }}>
                    <Button
                      label="Rename"
                      onClick={() => {
                        setRenaming(look.name);
                        setRenameDraft(look.name);
                      }}
                    />
                    <Button label="Delete" variant="danger" onClick={() => remove(look)} />
                  </div>
                )}
              </>
            ) : (
              <div className="look-empty">Empty</div>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
