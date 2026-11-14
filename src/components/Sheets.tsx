import { equipItem, type GearState } from "../gear";
import type { GearSource, SheetData } from "../types";
import { Button, Card, Pill } from "./Bits";

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
  onChange,
}: {
  active: boolean;
  gear: GearState;
  source: GearSource;
  onChange: (next: GearState) => void;
}) {
  const slots = source.pocketSlots || 40;
  return (
    <section className="panel" hidden={!active} aria-hidden={!active}>
      <div className="section-label" style={{ marginBottom: 8 }}>
        {gear.pocket.length} OF {slots} SLOTS USED
      </div>
      <div className="pocket-grid">
        {Array.from({ length: slots }).map((_, index) => {
          const item = gear.pocket[index];
          const targets = item ? source.equipTargets[item.name] : undefined;
          return (
            <div key={index} className={item ? "slot-cell filled" : "slot-cell"} title={item ? item.note : "Empty"}>
              {item ? (
                <>
                  <div className="slot-name">
                    <span>{item.name}</span>
                    <span className="slot-qty">{item.qty}</span>
                  </div>
                  {item.note ? <div className="slot-note">{item.note}</div> : null}
                  {targets && targets.length ? (
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
              ) : null}
            </div>
          );
        })}
      </div>
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
