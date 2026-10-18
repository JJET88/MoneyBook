"use client";

import { useT } from "./I18n";

/** Spent or Received: two buttons, one pressed. */
export default function KindToggle({ kind, onChange }) {
  const t = useT();
  return (
    <div className="kind" role="group" aria-label={t("entry.kinds")}>
      <button type="button" aria-pressed={kind === "out"} onClick={() => onChange("out")}>{t("fig.spent")}</button>
      <button type="button" className="is-in" aria-pressed={kind === "in"} onClick={() => onChange("in")}>{t("fig.received")}</button>
    </div>
  );
}
