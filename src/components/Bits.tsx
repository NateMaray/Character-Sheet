import type { ReactNode } from "react";

export function Pill({ text, on }: { text: string; on: boolean }) {
  return <span className={on ? "pill on" : "pill"}>{text}</span>;
}

export function Card({ children }: { children: ReactNode }) {
  return <article className="card">{children}</article>;
}

export function Button({
  label,
  onClick,
  disabled,
  variant,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: "primary" | "danger";
}) {
  const cls = variant === "primary" ? "btn primary" : variant === "danger" ? "btn danger" : "btn";
  return (
    <button type="button" className={cls} onClick={onClick} disabled={disabled}>
      {label}
    </button>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="segmented" role="group">
      {options.map((option) => (
        <button key={option.value} type="button" aria-pressed={value === option.value} onClick={() => onChange(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  );
}
