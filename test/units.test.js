import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { readBackup, toBackup, toCsv } from "../lib/backup.js";
import { canShowLeft, groupByDay, leftAfter, leftAt, rankLabels, whereItWent, yearTable } from "../lib/book.js";
import { fullDate, isDate, isMonth, momentIn, monthName, serverToday, shiftMonth, shortDate, weekday } from "../lib/dates.js";
import { AppError } from "../lib/errors.js";
import { describeHistory, groupHistory } from "../lib/history.js";
import { translator } from "../lib/i18n/index.js";
import { addressFrom, createLimiter } from "../lib/limiter.js";
import { formatMoney, minorToInput, parseAmountMinor } from "../lib/money.js";
import { validateEntry, validatePasswordChange, validateSettings, validateSignup } from "../lib/validate.js";

const rejects = (fn, pattern) => assert.throws(fn, (e) => e instanceof AppError && e.status === 400 && pattern.test(e.message));

describe("money", () => {
  test("reads amounts as whole minor units", () => {
    assert.equal(parseAmountMinor("65"), 6500);
    assert.equal(parseAmountMinor(" 1,234.5 "), 123450);
    assert.equal(parseAmountMinor(".5"), 50);
    assert.equal(parseAmountMinor("65."), 6500);
    assert.equal(parseAmountMinor(12000), 1200000);
  });

  test("rounds on the text, so binary fractions cannot lose a satang", () => {
    assert.equal(parseAmountMinor("1.005"), 101);
    assert.equal(parseAmountMinor("0.994"), 99);
    assert.equal(parseAmountMinor(0.1 + 0.2), 30);
  });

  test("refuses what is not a plain amount", () => {
    for (const bad of ["", " ", ".", "abc", "-5", "1e5", "12.3.4", "0", "0.001", "5 baht", null, undefined, "1000000000000"]) {
      assert.equal(parseAmountMinor(bad), null, String(bad));
    }
    assert.equal(parseAmountMinor("0", { allowZero: true }), 0);
    assert.equal(parseAmountMinor("999999999999.99"), 99999999999999);
  });

  test("formats with separators, and decimals only when needed", () => {
    assert.equal(formatMoney(123400), "1,234");
    assert.equal(formatMoney(6550, "฿"), "฿65.50");
    assert.equal(formatMoney(5), "0.05");
    assert.equal(formatMoney(-123456789), "−1,234,567.89");
    assert.equal(formatMoney(0, "$"), "$0");
    assert.equal(minorToInput(6500), "65");
    assert.equal(minorToInput(6505), "65.05");
  });
});

describe("dates", () => {
  test("accepts only real calendar dates", () => {
    assert.equal(isDate("2026-09-30"), true);
    assert.equal(isDate("2028-02-29"), true);
    for (const bad of ["2026-02-30", "2026-13-01", "2026-9-3", "1999-12-31", "2101-01-01", "", null, 20260930]) assert.equal(isDate(bad), false, String(bad));
    assert.equal(isMonth("2026-09"), true);
    assert.equal(isMonth("2026-13"), false);
    assert.equal(isMonth("2026-09-01"), false);
  });

  test("steps across year ends and names things", () => {
    assert.equal(shiftMonth("2026-12", 1), "2027-01");
    assert.equal(shiftMonth("2026-01", -1), "2025-12");
    assert.equal(monthName("2026-09"), "September 2026");
    assert.equal(monthName("2026-09", { month: "long" }), "September");
    assert.equal(weekday("2026-09-30"), "Wed");
    assert.equal(shortDate("2026-03-31"), "31 Mar");
  });

  test("today follows the configured time zone and survives a bad one", () => {
    assert.match(serverToday("Asia/Bangkok"), /^\d{4}-\d{2}-\d{2}$/);
    assert.match(serverToday("Not/AZone"), /^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("the book's arithmetic", () => {
  // A ledger: 5,000 on 31 March, then six months of totals.
  const start = { date: "2026-03-31", amountMinor: 500000 };
  const months = [
    { ym: "2026-04", in: 0, out: 120000, net: -120000, count: 1 },
    { ym: "2026-05", in: 300000, out: 110000, net: 190000, count: 2 },
    { ym: "2026-06", in: 250000, out: 290000, net: -40000, count: 3 },
    { ym: "2026-07", in: 0, out: 80000, net: -80000, count: 1 },
    { ym: "2026-08", in: 0, out: 60000, net: -60000, count: 1 },
    { ym: "2026-09", in: 0, out: 90000, net: -90000, count: 30 },
  ];

  test("money left carries from month to month", () => {
    const left = (ym) => leftAfter(months, start, ym) / 100;
    assert.deepEqual(["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"].map(left), [3800, 5700, 5300, 4500, 3900, 3000]);
    assert.equal(left("2026-12"), 3000); // nothing written since: unchanged
    assert.equal(left("2026-02"), 0); // before the book started
    assert.equal(left("2026-03"), 5000);
  });

  test("left is shown only when there is something to count from", () => {
    assert.equal(canShowLeft([{ ym: "2026-09", in: 0, out: 500, net: -500, count: 1 }], null), false);
    assert.equal(canShowLeft([{ ym: "2026-09", in: 100, out: 500, net: -400, count: 2 }], null), true);
    assert.equal(canShowLeft([], start), true);
    assert.equal(leftAt([{ ym: "2026-09", in: 0, out: 500, net: -500, count: 1 }], null, "2026-09"), null);
    assert.equal(leftAt(months, start, "2026-02"), null); // before the book started
    assert.equal(leftAt(months, start, "2026-03"), 500000);
    assert.equal(leftAt(months, start, "2026-09"), 300000);
    assert.equal(leftAt([{ ym: "2026-09", in: 100, out: 500, net: -400, count: 2 }], null, "2026-10"), -400);
  });

  test("the year table puts the start row in its month and blanks the future", () => {
    const table = yearTable(months, start, 2026, "2026-10");
    assert.equal(table.rows.length, 13);
    assert.deepEqual(table.rows[2], { type: "start", label: "Start, 31 Mar", left: 500000 });
    const row = (ym) => table.rows.find((r) => r.ym === ym);
    assert.equal(row("2026-09").left, 300000);
    assert.equal(row("2026-10").left, 300000); // this month, nothing written yet
    assert.equal(row("2026-11").left, null); // has not happened
    assert.equal(row("2026-02").left, null); // before the book started
    assert.equal(row("2026-03").left, 500000);
    assert.equal(row("2026-06").share, 1);
    assert.equal(table.in, 550000);
    assert.equal(table.out, 750000);
    assert.equal(table.left, 300000);
    assert.equal(table.leftLabel, "Left now");
    assert.equal(yearTable(months, start, 2025, "2026-10").left, null);
    assert.equal(yearTable(months, start, 2025, "2026-10").canShowLeft, true);
    assert.equal(yearTable(months, start, 2027, "2026-10").left, 300000);
    assert.equal(yearTable(months, start, 2025, "2026-10").leftLabel, "Left at year end");
    assert.equal(yearTable(months, null, 2026, "2026-10").rows.length, 12);
    assert.equal(yearTable([], null, 2026, "2026-10").left, null);
    assert.equal(yearTable([], null, 2026, "2026-10").canShowLeft, false);
  });

  const entries = [
    { id: 1, date: "2026-07-02", kind: "out", label: "Taxi", amountMinor: 20000 },
    { id: 2, date: "2026-07-03", kind: "out", label: "taxi", amountMinor: 25000 },
    { id: 3, date: "2026-07-04", kind: "out", label: "taxi", amountMinor: 26000 },
    { id: 4, date: "2026-08-10", kind: "out", label: "food", amountMinor: 6500 },
    { id: 5, date: "2026-09-01", kind: "out", label: "food", amountMinor: 7500 },
    { id: 6, date: "2026-09-01", kind: "out", label: "Rice", amountMinor: 12000 },
    { id: 7, date: "2026-09-02", kind: "in", label: "allowance", amountMinor: 3000000 },
  ];

  test("quick choices follow recent habits and remember the last amount", () => {
    assert.deepEqual(rankLabels(entries, "out"), [
      { label: "food", lastMinor: 7500 },
      { label: "Rice", lastMinor: 12000 },
      { label: "taxi", lastMinor: 26000 }, // used most often, but not lately
    ]);
    assert.deepEqual(rankLabels(entries, "in"), [{ label: "allowance", lastMinor: 3000000 }]);
    assert.deepEqual(rankLabels([], "out"), []);
  });

  test("a month's page lists the newest day first", () => {
    const page = groupByDay(entries.filter((e) => e.date.startsWith("2026-09")));
    assert.deepEqual(page.map((d) => [d.day, d.weekday, d.items.map((e) => e.id)]), [[2, "Wed", [7]], [1, "Tue", [5, 6]]]);
    assert.equal(page[1].spent, page[1].items.filter((e) => e.kind === "out").reduce((sum, e) => sum + e.amountMinor, 0));
  });

  test("where it went: by label, largest first, the tail folded together", () => {
    assert.deepEqual(whereItWent(entries), [
      { name: "Taxi", total: 71000 },
      { name: "food", total: 14000 },
      { name: "Rice", total: 12000 },
    ]);
    assert.deepEqual(whereItWent(entries, 1), [{ name: "Taxi", total: 71000 }, { name: "Everything else", total: 26000 }]);
  });
});

describe("backup files", () => {
  const settings = { currency: "฿", start: { date: "2026-03-31", amountMinor: 500000 } };
  const entries = [
    { id: 11, date: "2026-09-01", kind: "out", label: "bill", amountMinor: 30000 },
    { id: 12, date: "2026-09-03", kind: "out", label: "food", amountMinor: 6550 },
    { id: 13, date: "2026-05-07", kind: "in", label: "money received", amountMinor: 300000 },
  ];

  test("a book written out and read back is the same book", () => {
    const file = toBackup(settings, entries, "2026-10-04");
    assert.equal(file.app, "money-book");
    assert.deepEqual(file.docs["m-2026-09"].entries[1], { id: "12", d: 3, k: "out", w: "food", a: 65.5 });
    const back = readBackup(JSON.stringify(file));
    assert.deepEqual(back.settings, settings);
    assert.equal(back.months, 2);
    assert.deepEqual(back.entries, entries.map(({ id, ...rest }) => rest));
  });

  test("an empty book still makes a valid file shape", () => {
    assert.deepEqual(toBackup({ currency: "", start: null }, [], "2026-10-04").docs, {});
  });

  test("damaged lines are skipped and the rest kept", () => {
    const text = JSON.stringify({
      app: "money-book",
      docs: {
        "m-2026-02": { entries: [
          { d: 30, k: "out", w: "no such day", a: 5 },
          { d: 3, k: "out", w: "   ", a: 5 },
          { d: 3, k: "out", w: "free", a: 0 },
          { d: 3, k: "sideways", w: "  two   words ", a: "12.5" },
          { d: 4, k: "in", w: "x".repeat(60), a: 1 },
          null,
        ] },
        "m-2026-13": { entries: [{ d: 1, k: "out", w: "bad month", a: 5 }] },
        "DROP TABLE": { entries: [{ d: 1, k: "out", w: "ignored", a: 5 }] },
        settings: { currency: "THB baht", start: { date: "2026-02-30", amount: 5 } },
      },
    });
    const back = readBackup(text);
    assert.deepEqual(back.entries, [
      { date: "2026-02-03", kind: "out", label: "two words", amountMinor: 1250 },
      { date: "2026-02-04", kind: "in", label: "x".repeat(40), amountMinor: 100 },
    ]);
    assert.deepEqual(back.settings, { currency: "THB ", start: null });
  });

  test("other files are refused", () => {
    for (const bad of ["", "not json", "[]", "{}", '{"app":"other","docs":{}}', '{"app":"money-book","docs":{}}', '{"app":"money-book","docs":[]}', '{"app":"money-book","docs":{"m-2026-09":{"entries":[]}}}']) {
      rejects(() => readBackup(bad), /not a Money Book backup/);
    }
    rejects(() => readBackup("x".repeat(1_500_001)), /too large/);
    rejects(() => readBackup(12), /too large/);
    assert.equal(readBackup('{"app":"money-book","docs":{"settings":{}}}').entries.length, 0); // settings alone is a book
  });

  test("the spreadsheet file cannot smuggle in a formula", () => {
    const csv = toCsv([
      { date: "2026-09-01", kind: "out", label: "food, drink", amountMinor: 6550 },
      { date: "2026-09-02", kind: "in", label: '=HYPERLINK("http://x")', amountMinor: 100 },
      { date: "2026-09-03", kind: "out", label: "-10 off", amountMinor: 500 },
    ]);
    assert.equal(csv, [
      "date,kind,what for,amount",
      '2026-09-01,spent,"food, drink",65.50',
      '2026-09-02,received,"\'=HYPERLINK(""http://x"")",1.00',
      "2026-09-03,spent,'-10 off,5.00",
      "",
    ].join("\r\n"));
  });
});

describe("forms", () => {
  test("an entry is tidied and checked", () => {
    assert.deepEqual(validateEntry({ label: "  iced   tea ", amount: "45", date: "2026-09-30", kind: "out" }), { date: "2026-09-30", kind: "out", label: "iced tea", amountMinor: 4500 });
    rejects(() => validateEntry({ label: "", amount: "45", date: "2026-09-30", kind: "out" }), /what it was for/);
    rejects(() => validateEntry({ label: "x".repeat(41), amount: "45", date: "2026-09-30", kind: "out" }), /40 characters/);
    rejects(() => validateEntry({ label: "tea", amount: "free", date: "2026-09-30", kind: "out" }), /amount/);
    rejects(() => validateEntry({ label: "tea", amount: "45", date: "2026-09-31", kind: "out" }), /date/);
    rejects(() => validateEntry({ label: "tea", amount: "45", date: "2026-09-30", kind: "both" }), /Spent or Received/);
    rejects(() => validateEntry(null), /what it was for/);
  });

  test("a new password needs the current one", () => {
    rejects(() => validatePasswordChange({ current: "", password: "long enough" }), /current password/);
    rejects(() => validatePasswordChange({ current: "old", password: "short" }), /at least 8/);
    assert.deepEqual(validatePasswordChange({ current: "old", password: "long enough" }), { current: "old", password: "long enough" });
  });

  test("the starting balance needs its amount and its date together", () => {
    assert.deepEqual(validateSettings({ currency: " ฿ ", amount: "", date: "" }), { currency: "฿", start: null });
    assert.deepEqual(validateSettings({ currency: "", amount: "0", date: "2026-03-31" }), { currency: "", start: { date: "2026-03-31", amountMinor: 0 } });
    rejects(() => validateSettings({ currency: "", amount: "5000", date: "" }), /date you had/);
    rejects(() => validateSettings({ currency: "", amount: "", date: "2026-03-31" }), /starting amount/);
    rejects(() => validateSettings({ currency: "bahts", amount: "", date: "" }), /4 characters/);
  });

  test("sign-up details", () => {
    assert.deepEqual(validateSignup({ name: " Ann ", email: " Ann@Example.com ", password: "long enough" }), { name: "Ann", email: "ann@example.com", password: "long enough" });
    rejects(() => validateSignup({ name: "Ann", email: "ann", password: "long enough" }), /email/);
    rejects(() => validateSignup({ name: "Ann", email: "ann@example.com", password: "short" }), /8 characters/);
  });
});

describe("demo data", () => {
  test("the demo book is the same every time, valid, and never dated in the future", async () => {
    const { demoBook } = await import("../scripts/seed.js");
    const book = demoBook("2026-10-04");
    assert.deepEqual(book, demoBook("2026-10-04"));
    assert.equal(book.settings.start.date, "2026-06-30");
    assert.ok(book.entries.length > 100);
    for (const e of book.entries) {
      assert.ok(isDate(e.date) && e.date >= "2026-07-01" && e.date <= "2026-10-04", e.date);
      assert.deepEqual(validateEntry({ ...e, amount: e.amountMinor / 100 }), e);
    }
  });
});

describe("history", () => {
  const t = translator("en");
  const food = { date: "2026-09-30", kind: "out", label: "food", amountMinor: 6550 };

  test("says what was added, changed and deleted, with the entry as it was", () => {
    assert.deepEqual(describeHistory({ action: "entry.add", detail: { after: food } }, t, "฿"), { title: "Added", lines: ["food, spent ฿65.50, 30 Sept 2026"], warn: false });
    const changed = describeHistory({ action: "entry.change", detail: { before: food, after: { ...food, kind: "in", label: "refund", amountMinor: 7000 } } }, t);
    assert.deepEqual(changed.lines, ["Was: food, spent 65.50, 30 Sept 2026", "Now: refund, received 70, 30 Sept 2026"]);
    assert.equal(describeHistory({ action: "entry.delete", detail: { before: food } }, t).title, "Deleted");
  });

  test("settings, restores and erases read as sentences", () => {
    const settings = describeHistory({ action: "settings.save", detail: { before: { currency: "", start: null }, after: { currency: "฿", start: { date: "2026-03-31", amountMinor: 500000 } } } }, t);
    assert.deepEqual(settings.lines, ["Was: no starting balance · no money sign", "Now: starting balance ฿5,000 on 31 Mar 2026 · money sign ฿"]);
    assert.deepEqual(describeHistory({ action: "book.restore", detail: { entries: 1, replaced: 12 } }, t).lines, ["1 entry from the backup replaced 12 entries."]);
    const erased = describeHistory({ action: "book.erase", detail: { entries: 3 } }, t);
    assert.deepEqual([erased.lines, erased.warn], [["3 entries and the starting balance were removed."], true]);
  });

  test("failed log-ins stand out, and an unknown action still shows", () => {
    assert.deepEqual(describeHistory({ action: "login.failed", detail: null }, t), { title: "Someone tried to log in with a wrong password", lines: [], warn: true });
    assert.equal(describeHistory({ action: "future.thing", detail: null }, t).title, "future.thing");
    assert.equal(describeHistory({ action: "login" }, translator("th")).title, "เข้าสู่ระบบ");
  });

  test("lines are grouped by the day they happened where the people are", () => {
    // 2026-10-17 18:30 UTC is already 18 October in Bangkok.
    const items = [{ id: 3, at: Date.UTC(2026, 9, 17, 18, 30), action: "login" }, { id: 2, at: Date.UTC(2026, 9, 17, 9, 5), action: "login" }];
    const days = groupHistory(items, t, "", "Asia/Bangkok");
    assert.deepEqual(days.map((d) => [d.date, d.items.map((i) => i.time)]), [["2026-10-18", ["01:30"]], ["2026-10-17", ["16:05"]]]);
    assert.equal(momentIn(0, "Not/AZone").date.length, 10); // a bad zone falls back instead of failing
    assert.equal(fullDate("2026-03-31"), "31 Mar 2026");
  });
});

describe("the attempt limiter", () => {
  const tooMany = (e) => e instanceof AppError && e.status === 429;

  test("allows a few tries per key, then refuses until the window has passed", async () => {
    let clock = 0;
    const attempt = createLimiter(3, 1000, { now: () => clock });
    await attempt("ann"); await attempt("ann"); await attempt("ann");
    await assert.rejects(attempt("ann"), tooMany);
    await attempt("ben"); // someone else is not held up
    clock = 500;
    await assert.rejects(attempt("ann"), tooMany);
    clock = 1000;
    await attempt("ann"); // the first tries are now old enough to forget
    await attempt("ann");
    await assert.rejects(attempt("ann"), tooMany); // the refused try at 500 still counts
  });

  test("a burst sent at the same moment cannot slip through together", async () => {
    const attempt = createLimiter(3, 1000, { now: () => 0 });
    const results = await Promise.allSettled(Array.from({ length: 10 }, () => attempt("ann")));
    assert.ok(results.filter((r) => r.status === "fulfilled").length <= 3);
  });

  test("limiters with different names keep separate counts", async () => {
    const store = (await import("../lib/limiter.js")).memoryStore();
    const login = createLimiter(1, 1000, { name: "login", store, now: () => 0 });
    const signup = createLimiter(1, 1000, { name: "signup", store, now: () => 0 });
    await login("x");
    await signup("x");
    await assert.rejects(login("x"), tooMany);
  });

  test("the address is the one the outermost trusted proxy saw", () => {
    assert.equal(addressFrom("203.0.113.9"), "203.0.113.9");
    assert.equal(addressFrom("1.2.3.4, 203.0.113.9"), "203.0.113.9"); // the first entry was made up by the browser
    assert.equal(addressFrom("1.2.3.4, 203.0.113.9, 10.0.0.2", 2), "203.0.113.9");
    assert.equal(addressFrom("203.0.113.9", 3), "203.0.113.9");
    assert.equal(addressFrom(null), "unknown");
  });
});
