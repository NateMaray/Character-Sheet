export type TimeIcon =
  | "dawn"
  | "morning"
  | "midday"
  | "afternoon"
  | "dusk"
  | "evening"
  | "night"
  | "late-night"
  | "clock";

const ICONS: Record<string, TimeIcon> = {
  dawn: "dawn",
  morning: "morning",
  midday: "midday",
  afternoon: "afternoon",
  dusk: "dusk",
  evening: "evening",
  night: "night",
  "late night": "late-night",
};

/** Icon for a time-of-day string. Unknown text still gets a clock. */
export function timeIconFor(time: string): TimeIcon {
  const key = time.trim().toLowerCase().replace(/\s+/g, " ");
  return ICONS[key] ?? "clock";
}

export function timeTone(icon: TimeIcon): "sun" | "dusk" | "moon" | "clock" {
  if (icon === "dusk") return "dusk";
  if (icon === "evening" || icon === "night" || icon === "late-night") return "moon";
  if (icon === "clock") return "clock";
  return "sun";
}
