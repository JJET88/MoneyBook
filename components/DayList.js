"use client";

import { useState, useTransition } from "react";
import { changeEntry, removeEntry } from "@/app/actions";
import { monthName } from "@/lib/dates";
import { formatMoney, minorToInput } from "@/lib/money";
import { useT } from "./I18n";
import { useToast } from "./Toast";

/** The ruled page: one row per day, the date in the margin. Choose a line to change or delete it. */
export default function DayList({ days, currency, emptyText }) {
  const [openId, setOpenId] = useState(null);
  const t = useT();

  if (!days.length) return <p className="empty">{emptyText}</p>;
  return days.map((day) => (
    <div className="day" key={day.date}>
      <div className="day-date"><b className="num">{day.day}</b>{day.weekday}</div>
      <div className="day-items">
        {day.items.map((entry) => {
          const open = openId === entry.id;
          const amount = formatMoney(entry.amountMinor, currency);
          return (
            <div className="line" key={entry.id}>
              <button type="button" className={`item${entry.kind === "in" ? " is-in" : ""}`} aria-expanded={open}
                aria-label={t(entry.kind === "in" ? "entry.lineIn" : "entry.lineOut", { label: entry.label, amount })}
                onClick={() => setOpenId(open ? null : entry.id)}>
                <span className="what">{entry.label}</span>
                <span className="amt num">{entry.kind === "in" ? "+" : ""}{amount}</span>
              </button>
              {open && <Editor entry={entry} close={() => setOpenId(null)} />}
            </div>
          );
        })}
      </div>
    </div>
  ));
}

function Editor({ entry, close }) {
  const toast = useToast();
  const t = useT();
  const [form, setForm] = useState({ label: entry.label, amount: minorToInput(entry.amountMinor), date: entry.date, kind: entry.kind });
  const [error, setError] = useState(null);
  const [armed, setArmed] = useState(false); // deleting takes two presses: there is no undo
  const [pending, startTransition] = useTransition();
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  function save(event) {
    event.preventDefault();
    startTransition(async () => {
      const result = await changeEntry(entry.id, form);
      if (result.error) return setError(result.error);
      const moved = result.date.slice(0, 7) !== entry.date.slice(0, 7);
      toast(moved ? t("toast.moved", { month: monthName(result.date.slice(0, 7), undefined, t.locale) }) : t("toast.saved"));
      close();
    });
  }

  function remove() {
    if (!armed) return setArmed(true);
    startTransition(async () => {
      const result = await removeEntry(entry.id);
      if (result.error) return setError(result.error);
      toast(t("toast.deleted"));
      close();
    });
  }

  return (
    <form className="editor" onSubmit={save} noValidate>
      <div className="fields">
        <input className="input" aria-label={t("entry.whatFor")} maxLength={40} value={form.label} onChange={set("label")} />
        <input className="input num" aria-label={t("entry.amount")} inputMode="decimal" value={form.amount} onChange={set("amount")} />
        <input className="input full-sm" aria-label={t("entry.date")} type="date" value={form.date} onChange={set("date")} />
        <select className="input full-sm" aria-label={t("entry.kind")} value={form.kind} onChange={set("kind")}>
          <option value="out">{t("fig.spent")}</option>
          <option value="in">{t("fig.received")}</option>
        </select>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="row">
        <button type="submit" className="primary" disabled={pending}>{t("edit.save")}</button>
        <button type="button" className="plain" onClick={close}>{t("edit.cancel")}</button>
        <button type="button" className="plain is-danger" disabled={pending} onClick={remove}>{t(armed ? "edit.deleteAgain" : "edit.delete")}</button>
      </div>
    </form>
  );
}
