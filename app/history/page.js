import Link from "next/link";
import { ClearHistory } from "@/components/SettingsForms";
import { requireUser } from "@/lib/auth/current-user";
import { monthName, serverToday, weekday } from "@/lib/dates";
import { groupHistory } from "@/lib/history";
import { getT } from "@/lib/i18n/server";
import { getSettings } from "@/lib/repos/book";
import { listHistory } from "@/lib/repos/history";

export async function generateMetadata() {
  const t = await getT();
  return { title: `${t("tabs.history")} · ${t("app.name")}` };
}

/** History: what happened in the book, newest first. /history?before=123 opens the lines older than line 123. */
export default async function HistoryPage({ searchParams }) {
  const user = await requireUser();
  const { before } = await searchParams;
  const cursor = /^\d{1,15}$/.test(before ?? "") ? Number(before) : null;
  const [settings, t, { items, more }] = await Promise.all([getSettings(user.id), getT(), listHistory(user.id, { before: cursor })]);
  const days = groupHistory(items, t, settings.currency);
  const thisYear = serverToday().slice(0, 4);

  return (
    <>
      <section className="page" aria-labelledby="history-title">
        <h3 id="history-title">{t("history.title")}</h3>
        <p className="hint page-hint">{t("history.hint")}</p>
        {!days.length && <p className="empty">{t("history.empty")}</p>}
        {days.map((day) => (
          <div className="day" key={day.date}>
            <div className="day-date">
              <b className="num">{Number(day.date.slice(8, 10))}</b>
              <span>{monthName(day.date.slice(0, 7), { month: "short", ...(day.date.startsWith(thisYear) ? {} : { year: "numeric" }) }, t.locale)}</span>
              <small>{weekday(day.date, t.locale)}</small>
            </div>
            <ol className="day-items">
              {day.items.map((item) => (
                <li className={`log${item.warn ? " is-warn" : ""}`} key={item.id}>
                  <span className="log-time num">{item.time}</span>
                  <div className="log-what">
                    <b>{item.title}</b>
                    {item.lines.map((line, i) => <span key={i}>{line}</span>)}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        ))}
        {(more || cursor) && (
          <div className="row pager">
            {cursor && <Link className="plain" href="/history" prefetch={false}>{t("history.newest")}</Link>}
            {more && <Link className="plain" href={`/history?before=${items.at(-1).id}`} prefetch={false}>{t("history.older")}</Link>}
          </div>
        )}
      </section>
      {items.length > 0 && <ClearHistory />}
    </>
  );
}
