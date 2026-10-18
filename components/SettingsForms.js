"use client";

import { useRef, useState, useTransition } from "react";
import { changePassword, clearMyHistory, eraseEverything, restoreBackup, saveSettings } from "@/app/actions";
import { MAX_BACKUP_CHARS, readBackup } from "@/lib/backup";
import { AppError } from "@/lib/errors";
import { minorToInput } from "@/lib/money";
import { useT } from "./I18n";
import { useToast } from "./Toast";

export function StartingBalance({ settings }) {
  const toast = useToast();
  const t = useT();
  const [form, setForm] = useState({
    amount: settings.start ? minorToInput(settings.start.amountMinor) : "",
    date: settings.start?.date ?? "",
    currency: settings.currency,
  });
  const [error, setError] = useState(null);
  const [pending, startTransition] = useTransition();
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  function submit(event) {
    event.preventDefault();
    startTransition(async () => {
      const result = await saveSettings(form);
      setError(result.error ?? null);
      if (result.ok) toast(t("toast.settingsSaved"));
    });
  }

  return (
    <form className="panel form" onSubmit={submit} noValidate>
      <h2>{t("start.title")}</h2>
      <p className="hint">{t("start.hint")}</p>
      <div className="fields">
        <label className="field full-sm">{t("entry.amount")}
          <input className="input num" inputMode="decimal" autoComplete="off" placeholder="0" value={form.amount} onChange={set("amount")} />
        </label>
        <label className="field full-sm">{t("start.date")}
          <input className="input" type="date" value={form.date} onChange={set("date")} />
        </label>
        <label className="field wide">{t("start.currency")}
          <input className="input" maxLength={4} autoComplete="off" placeholder={t("start.currencyExample")} value={form.currency} onChange={set("currency")} />
        </label>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <button type="submit" className="primary" disabled={pending}>{t("start.save")}</button>
    </form>
  );
}

export function Backup({ monthsInBook }) {
  const toast = useToast();
  const t = useT();
  const picker = useRef(null);
  const [waiting, setWaiting] = useState(null); // { text, months, entries } read from a file, not yet restored
  const [error, setError] = useState(null);
  const [pending, startTransition] = useTransition();

  async function picked(event) {
    const file = event.target.files?.[0];
    event.target.value = ""; // so choosing the same file again still fires
    if (!file) return;
    setWaiting(null);
    try {
      if (file.size > MAX_BACKUP_CHARS) throw new AppError(400, "err.backupTooLarge");
      const text = await file.text();
      // Checked here so the person hears at once; the server checks again and is the one that counts.
      const { months, entries } = readBackup(text);
      setError(null);
      setWaiting({ text, months, entries: entries.length });
    } catch (problem) {
      setError(problem instanceof AppError ? t(problem.key, problem.vars) : t("backup.unreadable"));
    }
  }

  function restore() {
    startTransition(async () => {
      const result = await restoreBackup(waiting.text);
      setWaiting(null);
      if (result.error) return setError(result.error);
      toast(t("toast.restored"));
    });
  }

  return (
    <div className="panel stack">
      <h2>{t("backup.title")}</h2>
      <p className="hint">{t("backup.hint")}</p>
      <div className="row">
        <a className="plain" href="/api/backup" download>{t("backup.save")}</a>
        <button type="button" className="plain" onClick={() => picker.current?.click()}>{t("backup.restore")}</button>
        <a className="plain" href="/api/export" download>{t("backup.csv")}</a>
        <input ref={picker} type="file" accept=".json,application/json" hidden onChange={picked} />
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {waiting && (
        <div className="stack">
          <p className="error" role="alert">
            {t("backup.confirm", {
              entries: t("count.entries", { n: waiting.entries }),
              months: t("count.months", { n: waiting.months }),
              current: t("count.months", { n: monthsInBook }),
            })}
          </p>
          <div className="row">
            <button type="button" className="plain is-danger" disabled={pending} onClick={restore}>{t("backup.replace")}</button>
            <button type="button" className="plain" onClick={() => setWaiting(null)}>{t("edit.cancel")}</button>
          </div>
        </div>
      )}
    </div>
  );
}

export function StartAgain() {
  const toast = useToast();
  const t = useT();
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState(null);
  const [pending, startTransition] = useTransition();

  function erase() {
    if (!armed) {
      setArmed(true);
      setTimeout(() => setArmed(false), 5000); // an unanswered question goes away by itself
      return;
    }
    setArmed(false);
    startTransition(async () => {
      const result = await eraseEverything();
      setError(result.error ?? null);
      if (result.ok) toast(t("toast.erased"));
    });
  }

  return (
    <div className="panel stack">
      <h2>{t("erase.title")}</h2>
      <p className="hint">{t("erase.hint")}</p>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="row">
        <button type="button" className="plain is-danger" disabled={pending} onClick={erase}>{t(armed ? "erase.again" : "erase.button")}</button>
      </div>
    </div>
  );
}

export function Password() {
  const toast = useToast();
  const t = useT();
  const [form, setForm] = useState({ current: "", password: "" });
  const [error, setError] = useState(null);
  const [pending, startTransition] = useTransition();
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  function submit(event) {
    event.preventDefault();
    startTransition(async () => {
      const result = await changePassword(form);
      setError(result.error ?? null);
      if (result.ok) {
        setForm({ current: "", password: "" });
        toast(t("toast.passwordChanged"));
      }
    });
  }

  return (
    <form className="panel form" onSubmit={submit} noValidate>
      <h2>{t("password.title")}</h2>
      <p className="hint">{t("password.hint")}</p>
      <label className="field">{t("password.current")}
        <input className="input" type="password" autoComplete="current-password" value={form.current} onChange={set("current")} />
      </label>
      <label className="field">{t("password.new")}
        <input className="input" type="password" autoComplete="new-password" value={form.password} onChange={set("password")} />
      </label>
      {error && <p className="error" role="alert">{error}</p>}
      <button type="submit" className="primary" disabled={pending}>{t("password.save")}</button>
    </form>
  );
}

export function ClearHistory() {
  const toast = useToast();
  const t = useT();
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState(null);
  const [pending, startTransition] = useTransition();

  function clear() {
    if (!armed) {
      setArmed(true);
      setTimeout(() => setArmed(false), 5000);
      return;
    }
    setArmed(false);
    startTransition(async () => {
      const result = await clearMyHistory();
      setError(result.error ?? null);
      if (result.ok) toast(t("toast.historyCleared"));
    });
  }

  return (
    <div className="panel stack">
      <h2>{t("history.clearTitle")}</h2>
      <p className="hint">{t("history.clearHint")}</p>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="row">
        <button type="button" className="plain is-danger" disabled={pending} onClick={clear}>{t(armed ? "history.clearAgain" : "history.clearTitle")}</button>
      </div>
    </div>
  );
}
