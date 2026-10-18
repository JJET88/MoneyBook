"use client";

import { useState, useTransition } from "react";
import { addEntry, changeEntry, removeEntry } from "@/app/actions";
import { monthName } from "@/lib/dates";
import { formatMoney, minorToInput } from "@/lib/money";
import { useT } from "./I18n";
import KindToggle from "./KindToggle";
import { useToast } from "./Toast";

/**
 * The ruled page: one row per day, the date in the margin with what was spent
 * that day. Choose a line to change or delete it.
 */
export default function DayList({ days, currency, emptyText, today }) {
  const [openId, setOpenId] = useState(null);
  const t = useT();

  if (!days.length) return <p className="empty">{emptyText}</p>;
  return days.map((day) => (
    <div className={`day${day.date === today ? " is-today" : ""}`} key={day.date}>
      <div className="day-date">
        <b className="num">{day.day}</b>
        <span>{day.date === today ? t("days.today") : day.weekday}</span>
        {day.items.length > 1 && day.spent > 0 && <small className="num">{formatMoney(day.spent, currency)}</small>}
      </div>
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
              {open && <Editor entry={entry} currency={currency} close={() => setOpenId(null)} />}
            </div>
          );
        })}
      </div>
    </div>
  ));
}

function Editor({ entry, currency, close }) {
  const toast = useToast();
  const t = useT();
  const [form, setForm] = useState({ label: entry.label, amount: minorToInput(entry.amountMinor), date: entry.date, kind: entry.kind });
  const [error, setError] = useState(null);
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

  // One press: the toast offers Undo, which writes the entry back as it was.
  function remove() {
    startTransition(async () => {
      const result = await removeEntry(entry.id);
      if (result.error) return setError(result.error);
      close();
      toast(t("toast.deletedWhat", { label: entry.label, amount: formatMoney(entry.amountMinor, currency) }), {
        label: t("toast.undo"),
        run: async () => {
          const back = await addEntry({ kind: entry.kind, label: entry.label, amount: minorToInput(entry.amountMinor), date: entry.date });
          toast(back.error ?? t("toast.putBack"));
        },
      });
    });
  }

  return (
    <form className="editor" onSubmit={save} noValidate>
      <KindToggle kind={form.kind} onChange={(kind) => setForm({ ...form, kind })} />
      <div className="fields">
        <input className="input" aria-label={t("entry.whatFor")} maxLength={40} value={form.label} onChange={set("label")} />
        <input className="input num" aria-label={t("entry.amount")} inputMode="decimal" enterKeyHint="done" value={form.amount} onChange={set("amount")} />
        <input className="input wide" aria-label={t("entry.date")} type="date" value={form.date} onChange={set("date")} />
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="row actions">
        <button type="submit" className="primary" disabled={pending}>{t("edit.save")}</button>
        <button type="button" className="plain" onClick={close}>{t("edit.cancel")}</button>
        <button type="button" className="plain is-danger push-end" disabled={pending} onClick={remove}>{t("edit.delete")}</button>
      </div>
    </form>
  );
}
