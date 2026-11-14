import { useEffect, useRef, useState, type PointerEvent } from "react";
import type { BattleMap, Enemy, MapLabel, Point, SheetData, TownMap, WorldMap } from "../types";
import { Button, Pill, Segmented } from "./Bits";

type View = "world" | "town" | "local";

function halo(fill: string) {
  return { fill, stroke: "rgba(5,8,16,0.92)", strokeWidth: 4, paintOrder: "stroke" as const };
}

function labelProps(label: MapLabel) {
  const tone = label.tone === "water" ? "var(--river)" : label.tone === "muted" ? "var(--muted)" : "var(--ink)";
  return {
    x: label.x,
    y: label.y,
    textAnchor: label.anchor || "start",
    fontSize: label.size || 12,
    fontStyle: label.italic ? "italic" : "normal",
    ...halo(tone),
  };
}

function pointsAttr(points: Point[]): string {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
}

function WorldSvg({ map, zoom }: { map: WorldMap; zoom: number }) {
  const [width, height] = map.viewBox;
  const route = pointsAttr(map.route.length ? map.route : map.places);
  const here = map.places.find((place) => place.current);
  return (
    <svg className="map-svg" viewBox={`0 0 ${width} ${height}`} width={`${zoom * 100}%`}>
      <defs>
        <mask id="world-fog">
          <rect x="0" y="0" width={width} height={height} fill="white" />
          {map.places.map((place) => (
            <circle key={place.name} cx={place.x} cy={place.y} r={map.fog.placeRadius} fill="black" />
          ))}
          <path d={map.river} stroke="black" strokeWidth={map.fog.riverWidth} fill="none" strokeLinecap="round" />
          <polyline points={route} stroke="black" strokeWidth={map.fog.routeWidth} fill="none" strokeLinejoin="round" strokeLinecap="round" />
        </mask>
      </defs>
      <rect x="0" y="0" width={width} height={height} fill="var(--ocean)" />
      <path d={map.land} fill="var(--land)" stroke="var(--land-edge)" strokeWidth="1.5" />
      <path d={map.region} fill="var(--region)" fillOpacity="0.22" />
      <path d={map.mountains} stroke="var(--muted)" strokeWidth="2" fill="none" />
      <path d={map.river} stroke="var(--river)" strokeWidth="6" fill="none" strokeLinecap="round" />
      <polyline points={route} stroke="var(--accent)" strokeWidth="3" strokeDasharray="8 6" fill="none" strokeLinejoin="round" />
      <rect x="0" y="0" width={width} height={height} fill="var(--fog)" fillOpacity={map.fog.overlay} mask="url(#world-fog)" />
      {map.labels.map((label) => (
        <text key={label.text + label.x} {...labelProps(label)}>
          {label.text}
        </text>
      ))}
      {map.places.map((place) => {
        const current = Boolean(place.current);
        return (
          <g key={place.name}>
            <circle cx={place.x} cy={place.y} r={current ? 10 : 6} fill={current ? "var(--accent)" : "var(--ink)"} stroke="var(--accent)" strokeWidth="3" />
            <text
              x={place.x + place.dx}
              y={place.y + place.dy}
              textAnchor={place.anchor}
              fontSize="13"
              fontWeight={current ? 700 : 500}
              {...halo("var(--ink)")}
            >
              {place.name}
            </text>
          </g>
        );
      })}
      {here ? (
        <text x={here.x} y={here.y + 46} textAnchor="middle" fontSize="11" fontWeight="700" {...halo("var(--ink)")}>
          {map.hereLabel}
        </text>
      ) : null}
    </svg>
  );
}

function TownSvg({ map, zoom }: { map: TownMap; zoom: number }) {
  const [width, height] = map.viewBox;
  const route = pointsAttr(map.route);
  const here = map.labels.find((label) => label.current);
  return (
    <svg className="map-svg" viewBox={`0 0 ${width} ${height}`} width={`${zoom * 100}%`}>
      <defs>
        <mask id="town-fog">
          <rect x="0" y="0" width={width} height={height} fill="white" />
          {map.reveal.map((spot, index) => (
            <circle key={index} cx={spot.x} cy={spot.y} r={spot.r} fill="black" />
          ))}
          <polyline points={route} stroke="black" strokeWidth="56" fill="none" strokeLinejoin="round" strokeLinecap="round" />
        </mask>
      </defs>
      <rect x="0" y="0" width={width} height={height} fill="var(--ocean)" />
      <path d={map.river} stroke="var(--river)" strokeWidth="14" fill="none" strokeLinecap="round" />
      <path d={map.island} fill="var(--land)" stroke="var(--land-edge)" strokeWidth="1.5" />
      <path d={map.oldCity} fill="var(--land)" stroke="var(--land-edge)" strokeWidth="1.5" />
      {map.districts.map((district) => (
        <path
          key={district.name}
          d={district.d}
          fill={district.tone === "guild" ? "var(--hostile)" : district.tone === "market" ? "var(--accent)" : "var(--river)"}
          fillOpacity={district.tone === "guild" ? 0.18 : district.tone === "market" ? 0.12 : 0.14}
        />
      ))}
      {map.bridges.map((bridge) => (
        <path
          key={bridge.y}
          d={`M ${map.bridge.x1},${bridge.y} Q ${map.bridge.cx},${bridge.y - map.bridge.lift} ${map.bridge.x2},${bridge.y}`}
          stroke={bridge.used ? "var(--accent)" : "var(--land-edge)"}
          strokeWidth={bridge.used ? 7 : 4}
          fill="none"
          strokeLinecap="round"
        />
      ))}
      {map.blocks.map((block, index) => (
        <rect key={index} x={block.x} y={block.y} width={block.w} height={block.h} rx="3" fill="rgba(255,255,255,0.06)" stroke="var(--land-edge)" />
      ))}
      {map.buildings.map((building) => (
        <rect key={building.name} x={building.x} y={building.y} width={building.w} height={building.h} rx="3" fill="#18263c" stroke="var(--line-strong)" strokeWidth="1.5" />
      ))}
      <polyline points={route} stroke="var(--accent)" strokeWidth="3" strokeDasharray="8 6" fill="none" strokeLinejoin="round" strokeLinecap="round" />
      <rect x="0" y="0" width={width} height={height} fill="var(--fog)" fillOpacity={map.fogOverlay} mask="url(#town-fog)" />
      {map.labelsStatic.map((label) => (
        <text key={label.text + label.x} {...labelProps(label)}>
          {label.text}
        </text>
      ))}
      {map.labels.map((label) => (
        <text
          key={label.name}
          x={label.x + label.dx}
          y={label.y + label.dy}
          textAnchor={label.anchor}
          fontSize={label.current ? 14 : 12}
          fontWeight={label.current ? 700 : 500}
          {...halo("var(--ink)")}
        >
          {label.name}
        </text>
      ))}
      {here ? (
        <g>
          <circle cx={here.x} cy={here.y} r="11" fill="var(--accent)" stroke="#07101c" strokeWidth="2" />
          <text x={here.x} y={here.y + 46} textAnchor="middle" fontSize="11" fontWeight="700" {...halo("var(--ink)")}>
            {map.hereLabel}
          </text>
        </g>
      ) : null}
    </svg>
  );
}

function markerGlyph(enemy: Enemy): string {
  if (enemy.marker) return enemy.marker;
  if (enemy.tone === "hostile" || enemy.tone === "warning") return "!";
  if (enemy.tone === "unknown") return "?";
  return "·";
}

function markerColor(enemy: Enemy): string {
  if (enemy.tone === "hostile") return "var(--hostile)";
  if (enemy.tone === "warning") return "var(--warning)";
  if (enemy.tone === "unknown") return "var(--unknown)";
  return "var(--neutral)";
}

function facingDeg(enemy: Enemy, player: { x: number; y: number }): number | null {
  if (enemy.facing === undefined) return null;
  if (typeof enemy.facing === "number") return enemy.facing;
  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;
  return (Math.atan2(dx, -dy) * 180) / Math.PI;
}

function Reeds({ points }: { points: Point[] }) {
  return (
    <>
      {points.map((point, index) => (
        <g key={index} transform={`translate(${point.x} ${point.y})`}>
          <path d="M 0,8 C -2,0 -3,-10 0,-16" stroke="var(--reed)" strokeWidth="2" fill="none" />
          <path d="M 0,8 C 3,-2 4,-12 1,-18" stroke="var(--reed)" strokeWidth="2" fill="none" />
          <path d="M 0,8 C 0,0 1,-8 -1,-14" stroke="var(--reed)" strokeWidth="1.5" fill="none" />
        </g>
      ))}
    </>
  );
}

function BattleSvg({ map, zoom }: { map: BattleMap; zoom: number }) {
  const fillFor = (token?: string) => {
    if (token === "water") return "var(--water)";
    if (token === "stone") return "var(--stone)";
    if (token === "floor") return "var(--floor)";
    if (token === "hide") return "var(--hide)";
    if (token === "bone") return "var(--bone)";
    if (token === "daylight") return "var(--day)";
    if (token === "muted") return "var(--muted)";
    return "var(--ground)";
  };
  return (
    <svg className="map-svg" viewBox={`0 0 ${map.width} ${map.height}`} width={`${zoom * 100}%`}>
      <defs>
        {map.lamp ? (
          <radialGradient id="lamp-glow" cx={map.lamp.x} cy={map.lamp.y} r={map.lamp.r} gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#f2d48a" stopOpacity="0.38" />
            <stop offset="0.55" stopColor="#f2d48a" stopOpacity="0.12" />
            <stop offset="1" stopColor="#f2d48a" stopOpacity="0" />
          </radialGradient>
        ) : null}
        {map.daylight ? (
          <radialGradient id="day-glow" cx={map.daylight.x} cy={map.daylight.y} r="110" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#fff6d2" stopOpacity="0.9" />
            <stop offset="0.35" stopColor="#f0d48a" stopOpacity="0.35" />
            <stop offset="1" stopColor="#f0d48a" stopOpacity="0" />
          </radialGradient>
        ) : null}
        <mask id="battle-fog">
          <rect x="0" y="0" width={map.width} height={map.height} fill="white" />
          {map.reveal.map((shape, index) =>
            shape.type === "ellipse" ? (
              <ellipse key={index} cx={shape.cx} cy={shape.cy} rx={shape.rx} ry={shape.ry} fill="black" />
            ) : (
              <path key={index} d={shape.d} stroke="black" strokeWidth={shape.width} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            ),
          )}
        </mask>
      </defs>
      <rect x="0" y="0" width={map.width} height={map.height} fill="var(--ground)" />
      {(map.extras || []).map((extra, index) => {
        if (extra.type === "rect") {
          return <rect key={index} x={extra.x} y={extra.y} width={extra.w} height={extra.h} rx={extra.rx || 0} fill={fillFor(extra.fill)} opacity={extra.opacity ?? 1} />;
        }
        if (extra.type === "ellipse") {
          return <ellipse key={index} cx={extra.cx} cy={extra.cy} rx={extra.rx} ry={extra.ry} fill={fillFor(extra.fill)} opacity={extra.opacity ?? 1} />;
        }
        return <path key={index} d={extra.d} fill={extra.fill ? fillFor(extra.fill) : "none"} stroke={extra.stroke ? fillFor(extra.stroke) : "none"} strokeWidth={extra.sw || 1} opacity={extra.opacity ?? 1} />;
      })}
      {map.tunnel ? (
        <>
          <path d={map.tunnel.d} stroke="var(--stone)" strokeWidth={map.tunnel.wall} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <path d={map.tunnel.d} stroke="var(--floor)" strokeWidth={map.tunnel.floor} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : null}
      {map.chamber ? <ellipse cx={map.chamber.x} cy={map.chamber.y} rx={map.chamber.rx} ry={map.chamber.ry} fill="#243246" stroke="var(--stone)" strokeWidth="8" /> : null}
      {map.reeds ? <Reeds points={map.reeds} /> : null}
      {map.nest ? (
        <g>
          <ellipse cx={map.nest.x} cy={map.nest.y} rx="62" ry="30" fill="var(--hide)" />
          <ellipse cx={map.nest.x - 8} cy={map.nest.y + 2} rx="34" ry="14" fill="#6b4634" opacity="0.9" />
          <path d={`M ${map.nest.x - 28} ${map.nest.y} l 16 -8 M ${map.nest.x - 6} ${map.nest.y + 8} l 18 -6 M ${map.nest.x + 12} ${map.nest.y - 4} l 14 8`} stroke="var(--bone)" strokeWidth="2" fill="none" />
        </g>
      ) : null}
      {map.daylight ? <circle cx={map.daylight.x} cy={map.daylight.y} r="110" fill="url(#day-glow)" /> : null}
      {map.lamp ? <rect x="0" y="0" width={map.width} height={map.height} fill="url(#lamp-glow)" /> : null}
      <rect x="0" y="0" width={map.width} height={map.height} fill="var(--fog)" fillOpacity={map.fogOverlay} mask="url(#battle-fog)" />
      {(map.labels || []).map((label) => (
        <text key={label.text + label.x} {...labelProps({ ...label, tone: label.tone || "muted" })}>
          {label.text}
        </text>
      ))}
      {map.nest ? (
        <text x={map.nest.x} y={map.nest.y + 46} textAnchor="middle" fontSize="11" {...halo("var(--bone)")}>
          {map.nest.label}
        </text>
      ) : null}
      {map.lantern ? (
        <g>
          <circle cx={map.lantern.x} cy={map.lantern.y} r="8" fill="#f2d48a" stroke="#07101c" strokeWidth="2" />
          <text x={map.lantern.x - 14} y={map.lantern.y + 4} textAnchor="end" fontSize="11" fontWeight="650" {...halo("var(--ink)")}>
            {map.lantern.label}
          </text>
        </g>
      ) : null}
      <g>
        <circle cx={map.player.x} cy={map.player.y} r="12" fill="var(--accent)" stroke="#07101c" strokeWidth="2" />
        <text x={map.player.x - 18} y={map.player.y + 4} textAnchor="end" fontSize="13" fontWeight="700" {...halo("var(--ink)")}>
          {map.player.label}
        </text>
      </g>
      {map.enemies.map((enemy) => {
        const radius = enemy.r || 11;
        const face = facingDeg(enemy, map.player);
        const label = enemy.mapLabel === "" ? "" : enemy.mapLabel || enemy.name;
        return (
          <g key={enemy.id}>
            <circle cx={enemy.x} cy={enemy.y} r={radius} fill={markerColor(enemy)} stroke="#07101c" strokeWidth="2" />
            {face !== null ? (
              <g transform={`translate(${enemy.x} ${enemy.y}) rotate(${face})`}>
                <path d={`M 0 ${-radius - 1} l 5 8 l -10 0 z`} fill="#07101c" />
              </g>
            ) : null}
            <text x={enemy.x} y={enemy.y + 4} textAnchor="middle" fill="#07101c" fontSize={radius > 8 ? 12 : 10} fontWeight="700">
              {markerGlyph(enemy)}
            </text>
            {label ? (
              <text
                x={enemy.labelX ?? enemy.x}
                y={enemy.labelY ?? enemy.y + radius + 16}
                textAnchor="middle"
                fontSize="11"
                fontWeight="650"
                {...halo("var(--ink)")}
              >
                {label}
              </text>
            ) : null}
          </g>
        );
      })}
      {map.compass ? (
        <text x={map.width - 12} y={map.height - 10} textAnchor="end" fontSize="11" {...halo("var(--muted)")}>
          {map.compass}
        </text>
      ) : null}
    </svg>
  );
}

export function MapTab({ map, active }: { map: SheetData["map"]; active: boolean }) {
  const [view, setView] = useState<View>("world");
  const [zoom, setZoom] = useState(1);
  const mapBox = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; l: number; t: number } | null>(null);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const here =
    view === "world"
      ? map.world.places.find((place) => place.current)
      : view === "town"
        ? map.town.labels.find((place) => place.current)
        : map.battle.player;
  const focus = here ? `${view}:${here.x},${here.y}` : view;

  useEffect(() => {
    const box = mapBox.current;
    if (!box || !here) return;
    const frame = requestAnimationFrame(() => {
      const svg = box.querySelector("svg");
      const vb = svg?.viewBox.baseVal;
      if (!svg || !vb?.width) return;
      const scale = (svg.clientWidth / vb.width) * zoomRef.current;
      box.scrollLeft = here.x * scale - box.clientWidth / 2;
      box.scrollTop = here.y * scale - box.clientHeight / 2;
    });
    return () => cancelAnimationFrame(frame);
  }, [focus]);

  const zoomTo = (z: number) => {
    const box = mapBox.current;
    const next = Math.min(4, Math.max(1, Math.round(z * 100) / 100));
    if (box) {
      const cx = (box.scrollLeft + box.clientWidth / 2) / zoom;
      const cy = (box.scrollTop + box.clientHeight / 2) / zoom;
      setZoom(next);
      requestAnimationFrame(() => {
        box.scrollLeft = cx * next - box.clientWidth / 2;
        box.scrollTop = cy * next - box.clientHeight / 2;
      });
    } else {
      setZoom(next);
    }
  };

  const onDown = (event: PointerEvent<HTMLDivElement>) => {
    const box = mapBox.current;
    if (!box) return;
    box.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY, l: box.scrollLeft, t: box.scrollTop };
  };
  const onMove = (event: PointerEvent<HTMLDivElement>) => {
    const box = mapBox.current;
    const start = drag.current;
    if (!box || !start) return;
    box.scrollLeft = start.l - (event.clientX - start.x);
    box.scrollTop = start.t - (event.clientY - start.y);
  };
  const onUp = () => {
    drag.current = null;
  };

  const title = view === "world" ? "World map" : view === "town" ? "Greenstone" : map.battle.title;
  const caption = view === "world" ? map.world.caption : view === "town" ? map.town.caption : map.battle.note;

  return (
    <section className="card panel" hidden={!active} aria-hidden={!active}>
      <div className="card-head">
        <span className="title">{title}</span>
        <Segmented
          value={view}
          onChange={(next) => {
            setView(next);
            setZoom(1);
            const box = mapBox.current;
            if (box) {
              box.scrollLeft = 0;
              box.scrollTop = 0;
            }
          }}
          options={[
            { value: "world", label: "World" },
            { value: "town", label: "Town" },
            { value: "local", label: "Battle" },
          ]}
        />
        <Pill text="STAR CHART" on />
      </div>
      <div className="map-tools">
        <Button label="Zoom in" onClick={() => zoomTo(zoom + 0.5)} disabled={zoom >= 4} />
        <Button label="Zoom out" onClick={() => zoomTo(zoom - 0.5)} disabled={zoom <= 1} />
        <Button label="Reset" onClick={() => zoomTo(1)} disabled={zoom === 1} />
        <span className="zoom-readout">{Math.round(zoom * 100)}% · drag or scroll to move around</span>
      </div>
      <div
        ref={mapBox}
        className={zoom > 1 ? "map-box grab" : "map-box"}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        {view === "world" ? <WorldSvg map={map.world} zoom={zoom} /> : view === "town" ? <TownSvg map={map.town} zoom={zoom} /> : <BattleSvg map={map.battle} zoom={zoom} />}
      </div>
      <p className="body">{caption}</p>
      {view === "local" && map.battle.enemies.length > 0 ? (
        <div style={{ marginTop: 16 }}>
          <div className="section-label">CONTACTS · {map.battle.enemies.length}</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {["Name", "Size", "Rank", "Type", "Status"].map((heading) => (
                    <th key={heading} scope="col">
                      {heading.toUpperCase()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {map.battle.enemies.map((enemy) => (
                  <tr key={enemy.id}>
                    <td className={`tone-${enemy.tone}`}>{enemy.name}</td>
                    <td>{enemy.size}</td>
                    <td>{enemy.rank}</td>
                    <td>{enemy.type}</td>
                    <td>{enemy.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
      {view === "world" && map.charted.length > 0 ? (
        <div className="charted">
          <div className="section-label">CHARTED</div>
          {map.charted.map((place) => (
            <article key={place.region + place.place}>
              <div className="where">
                {place.region} · {place.place}
                {place.current ? <em> · you are here</em> : null}
              </div>
              <div className="body">{place.seen}</div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
