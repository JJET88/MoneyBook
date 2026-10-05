import Link from "next/link";
import AddForm from "@/components/AddForm";
import DayList from "@/components/DayList";
import Rich from "@/components/Rich";
import { requireUser } from "@/lib/auth/current-user";
import { canShowLeft, groupByDay, leftAt, rankLabels, whereItWent } from "@/lib/book";
import { isMonth, monthName, serverToday, shiftMonth } from "@/lib/dates";
import { getT } from "@/lib/i18n/server";
import { formatMoney } from "@/lib/money";
import { getSettings, listMonth, monthTotals, recentEntries } from "@/lib/repos/book";

/** Days: one month of the book. /?m=2026-09 opens September 2026. */
export default async function DaysPage({ searchParams }) {
  const user = await requireUser();
  const { m } = await searchParams;
  const [settings, t] = await Promise.all([getSettings(user.id), getT()]);
  const [months, recent] = await Promise.all([monthTotals(user.id, settings.start?.date), recentEntries(user.id)]);

  // No month asked for: open this month, or the newest written month if this one is still blank.
  const today = serverToday();
  let ym = today.slice(0, 7);
  if (isMonth(m)) ym = m;
  else if (months.length && !months.some((x) => x.ym === ym)) ym = months.at(-1).ym;

  const entries = await listMonth(user.id, ym);
  const totals = months.find((x) => x.ym === ym) ?? { in: 0, out: 0 };
  const left = leftAt(months, settings.start, ym); // null when it is not known
  const countable = canShowLeft(months, settings.start);
  const money = (minor) => formatMoney(minor, settings.currency);
  const bars = whereItWent(entries, 8, t);
  const month = (options) => monthName(ym, options, t.locale);
  const largest = Math.max(...bars.map((bar) => bar.total), 1);
  const [previous, next] = [shiftMonth(ym, -1), shiftMonth(ym, 1)];

  return (
    <>
      <div className="stepper">
        {isMonth(previous) ? <Link className="step" href={`/?m=${previous}`} aria-label={t("days.prevMonth")} prefetch={false}>‹</Link> : <span className="step" />}
        <h2>{month()}</h2>
        {isMonth(next) ? <Link className="step" href={`/?m=${next}`} aria-label={t("days.nextMonth")} prefetch={false}>›</Link> : <span className="step" />}
      </div>

      <div className="panel">
        <dl className="figures">
          <div className="figure"><dt>{t("fig.spent")}</dt><dd className="num">{money(totals.out)}</dd></div>
          <div className="figure"><dt>{t("fig.received")}</dt><dd className="num is-in">{money(totals.in)}</dd></div>
          <div className="figure"><dt>{t("fig.leftMonthEnd")}</dt><dd className={`num${left < 0 ? " is-low" : ""}`}>{left === null ? (countable ? "–" : "?") : money(left)}</dd></div>
        </dl>
        {!countable && <p className="hint"><Rich text={t("hint.needStart")} settings={<Link href="/settings">{t("tabs.settings")}</Link>} /></p>}
        {countable && left === null && <p className="hint">{t("hint.beforeStart")}</p>}
      </div>

      {/* key: a different month is a fresh form, with that month's date in it */}
      <AddForm key={ym} ym={ym} defaultDate={today.slice(0, 7) === ym ? today : `${ym}-01`} currency={settings.currency}
        choices={{ out: rankLabels(recent, "out"), in: rankLabels(recent, "in") }} />

      <section className="page" aria-labelledby="page-title">
        <h3 id="page-title">{t("days.pageTitle", { month: month({ month: "long" }) })}</h3>
        <DayList days={groupByDay(entries, t.locale)} currency={settings.currency}
          emptyText={t("days.empty", { month: month() })} />
        <div className="total-line"><span>{t("days.totalSpent")}</span><span className="num">{money(totals.out)}</span></div>
      </section>

      {bars.length > 1 && (
        <section className="panel" aria-labelledby="bars-title">
          <h3 id="bars-title">{t("days.whereItWent")}</h3>
          <div className="bars">
            {bars.map((bar) => (
              <div className="bar-row" key={bar.name}>
                <span className="name">{bar.name}</span>
                <div className="bar-track"><div className="bar-fill" style={{ width: `${(bar.total / largest) * 100}%` }} /></div>
                <span className="num">{money(bar.total)}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
