"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { addEntry } from "@/app/actions";
import { localToday } from "@/lib/dates";
import { formatMoney, minorToInput } from "@/lib/money";
import { useT } from "./I18n";
import { useToast } from "./Toast";

const STARTERS = { out: ["starter.food", "starter.transport", "starter.bill"], in: ["starter.allowance", "starter.salary"] };

/**
 * The form at the top of the Days page.
 * choices: { out: [{ label, lastMinor }], in: [...] }, most used lately first.
 */
export default function AddForm({ ym, defaultDate, choices, currency }) {
  const router = useRouter();
  const toast = useToast();
  const t = useT();
  const amountBox = useRef(null);
  const [kind, setKind] = useState("out");
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [error, setError] = useState(null);
  const [pending, startTransition] = useTransition();

  // The server guessed today's date from its own clock. The browser knows
  // the person's real date, so once the page is live, use that.
  useEffect(() => {
    const today = localToday();
    if (today.slice(0, 7) === ym) setDate(today);
  }, [ym]);

  const known = choices[kind];
  const chips = known.length ? known.slice(0, 7) : STARTERS[kind].map((key) => ({ label: t(key), lastMinor: null }));

  function choose(chip) {
    setLabel(chip.label);
    if (chip.lastMinor) setAmount(minorToInput(chip.lastMinor));
    amountBox.current?.focus();
    // Select the remembered amount, so typing a different one replaces it.
    requestAnimationFrame(() => amountBox.current?.select());
  }

  function submit(event) {
    event.preventDefault();
    startTransition(async () => {
      const result = await addEntry({ kind, label, amount, date });
      if (result.error) return setError(result.error);
      setError(null);
      setLabel("");
      setAmount("");
      toast(t("toast.added", { label: result.label, amount: formatMoney(result.amountMinor, currency) }));
      const month = result.date.slice(0, 7);
      if (month !== ym) router.push(`/?m=${month}`); // show the page it was written on
    });
  }

  return (
    <form className="panel form" onSubmit={submit} noValidate>
      <div className="kind" role="group" aria-label={t("entry.kinds")}>
        <button type="button" aria-pressed={kind === "out"} onClick={() => setKind("out")}>{t("fig.spent")}</button>
        <button type="button" aria-pressed={kind === "in"} onClick={() => setKind("in")}>{t("fig.received")}</button>
      </div>
      <div className="chips" role="group" aria-label={t("entry.quick")}>
        {chips.map((chip) => (
          <button type="button" key={chip.label} onClick={() => choose(chip)}>{chip.label}</button>
        ))}
      </div>
      <div className="fields">
        <label className="field">{t("entry.whatFor")}
          <input className="input" list="known-labels" maxLength={40} autoComplete="off" placeholder={t(kind === "in" ? "starter.allowance" : "starter.food")}
            value={label} onChange={(e) => setLabel(e.target.value)} />
        </label>
        <label className="field">{t("entry.amount")}
          <input className="input num" ref={amountBox} inputMode="decimal" autoComplete="off" placeholder="65"
            value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
        <label className="field wide">{t("entry.date")}
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
      </div>
      <datalist id="known-labels">
        {known.map((item) => <option key={item.label} value={item.label} />)}
      </datalist>
      {error && <p className="error" role="alert">{error}</p>}
      <button type="submit" className="primary" disabled={pending}>{t(pending ? "add.pending" : "add.submit")}</button>
    </form>
  );
}
