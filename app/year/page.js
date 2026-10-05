import Link from "next/link";
import Rich from "@/components/Rich";
import { requireUser } from "@/lib/auth/current-user";
import { yearTable } from "@/lib/book";
import { serverToday } from "@/lib/dates";
import { getT } from "@/lib/i18n/server";
import { formatMoney } from "@/lib/money";
import { getSettings, monthTotals } from "@/lib/repos/book";

export async function generateMetadata() {
  const t = await getT();
  return { title: `${t("tabs.year")} · ${t("app.name")}` };
}

const validYear = (value) => /^\d{4}$/.test(value ?? "") && Number(value) >= 2000 && Number(value) <= 2100;

/** Year: twelve months side by side. /year?y=2025 opens 2025. */
export default async function YearPage({ searchParams }) {
  const user = await requireUser();
  const { y } = await searchParams;
  const [settings, t] = await Promise.all([getSettings(user.id), getT()]);
  const months = await monthTotals(user.id, settings.start?.date);

  // No year asked for: this year, or the newest written year if this one is blank.
  const todayYm = serverToday().slice(0, 7);
  let year = Number(todayYm.slice(0, 4));
  if (validYear(y)) year = Number(y);
  else if (months.length && !months.some((m) => m.ym.startsWith(String(year)))) year = Number(months.at(-1).ym.slice(0, 4));

  const table = yearTable(months, settings.start, year, todayYm, t);
  const money = (minor) => formatMoney(minor, settings.currency);

  return (
    <>
      <div className="stepper">
        {year > 2000 ? <Link className="step" href={`/year?y=${year - 1}`} aria-label={t("year.prev")} prefetch={false}>‹</Link> : <span className="step" />}
        <h2>{year}</h2>
        {year < 2100 ? <Link className="step" href={`/year?y=${year + 1}`} aria-label={t("year.next")} prefetch={false}>›</Link> : <span className="step" />}
      </div>

      <div className="panel">
        <dl className="figures">
          <div className="figure"><dt>{t("fig.spentYear")}</dt><dd className="num">{money(table.out)}</dd></div>
          <div className="figure"><dt>{t("fig.received")}</dt><dd className="num is-in">{money(table.in)}</dd></div>
          <div className="figure"><dt>{table.leftLabel}</dt><dd className={`num${table.left < 0 ? " is-low" : ""}`}>{table.left === null ? (table.canShowLeft ? "–" : "?") : money(table.left)}</dd></div>
        </dl>
        {!table.canShowLeft && <p className="hint"><Rich text={t("hint.needStart")} settings={<Link href="/settings">{t("tabs.settings")}</Link>} /></p>}
      </div>

      <div className="panel table-wrap">
        <table>
          <thead>
            <tr><th scope="col">{t("year.month")}</th><th scope="col">{t("fig.received")}</th><th scope="col">{t("fig.spent")}</th><th scope="col">{t("year.left")}</th></tr>
          </thead>
          <tbody>
            {table.rows.map((row) => row.type === "start" ? (
              <tr key="start">
                <th scope="row">{row.label}</th><td /><td /><td className="num">{money(row.left)}</td>
              </tr>
            ) : (
              <tr key={row.ym} className={row.count ? undefined : "is-empty"}>
                <th scope="row"><Link href={`/?m=${row.ym}`} prefetch={false}>{row.name}</Link></th>
                <td className="num">{row.in ? money(row.in) : ""}</td>
                <td className="num spent-cell">
                  {row.out ? money(row.out) : ""}
                  {row.out > 0 && <i style={{ width: `${row.share * 100}%` }} />}
                </td>
                <td className="num">{row.left === null ? "" : money(row.left)}</td>
              </tr>
            ))}
            <tr className="is-total">
              <th scope="row">{t("year.whole")}</th><td className="num">{money(table.in)}</td><td className="num">{money(table.out)}</td><td />
            </tr>
          </tbody>
        </table>
        <p className="hint">{t("year.chooseMonth")}</p>
      </div>
    </>
  );
}
