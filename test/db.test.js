import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";

/**
 * Database tests. They run only when a test database is provided, and they
 * empty it first, so never point them at real data:
 *
 *   MYSQL_TEST_DATABASE=moneybook_test MYSQL_TEST_USER=... MYSQL_TEST_PASSWORD=... npm test
 */
const env = process.env;
const enabled = Boolean(env.MYSQL_TEST_DATABASE);

describe("database", { skip: !enabled && "set MYSQL_TEST_DATABASE to run" }, () => {
  let db, users, book, sessions, AppError, leftAfter;
  let ann, ben;
  const is404 = (e) => e instanceof AppError && e.status === 404;
  const line = (date, kind, label, amount) => ({ date, kind, label, amountMinor: amount * 100 });

  before(async () => {
    Object.assign(process.env, {
      MYSQL_HOST: env.MYSQL_TEST_HOST || "localhost",
      MYSQL_PORT: env.MYSQL_TEST_PORT || "3306",
      MYSQL_USER: env.MYSQL_TEST_USER || "moneybook",
      MYSQL_PASSWORD: env.MYSQL_TEST_PASSWORD || "",
      MYSQL_DATABASE: env.MYSQL_TEST_DATABASE,
    });
    db = await import("../lib/db.js");
    ({ AppError } = await import("../lib/errors.js"));
    ({ leftAfter } = await import("../lib/book.js"));
    users = await import("../lib/repos/users.js");
    book = await import("../lib/repos/book.js");
    sessions = await import("../lib/auth/sessions.js");
    await db.query("SET FOREIGN_KEY_CHECKS = 0");
    for (const table of ["entries", "settings", "sessions", "users"]) await db.query(`DROP TABLE IF EXISTS ${table}`);
    await db.query("SET FOREIGN_KEY_CHECKS = 1");
    const { applySchema } = await import("../scripts/db-setup.js");
    await applySchema();
    await applySchema(); // running it twice must be harmless

    ann = await users.createUser({ name: "Ann", email: "ann@example.com", passwordHash: "x" });
    ben = await users.createUser({ name: "Ben", email: "ben@example.com", passwordHash: "x" });
  });
  after(() => db?.closePool());

  test("an email can only sign up once", async () => {
    await assert.rejects(users.createUser({ name: "Ann again", email: "ann@example.com", passwordHash: "x" }), (e) => e instanceof AppError && e.status === 409);
  });

  test("a new book is empty and has no settings", async () => {
    assert.deepEqual(await book.getSettings(ann.id), { currency: "", start: null });
    assert.deepEqual(await book.listMonth(ann.id, "2026-09"), []);
    assert.deepEqual(await book.monthTotals(ann.id), []);
  });

  test("entries come back by month, in date order, with dates as plain text", async () => {
    await book.addEntry(ann.id, line("2026-09-30", "out", "food", 75));
    await book.addEntry(ann.id, line("2026-09-01", "out", "bill", 300));
    await book.addEntry(ann.id, line("2026-09-30", "out", "egg", 40));
    await book.addEntry(ann.id, line("2026-08-31", "out", "august", 10));
    await book.addEntry(ann.id, line("2026-10-01", "out", "october", 10));
    const september = await book.listMonth(ann.id, "2026-09");
    assert.deepEqual(september.map((e) => [e.date, e.label, e.amountMinor]), [["2026-09-01", "bill", 30000], ["2026-09-30", "food", 7500], ["2026-09-30", "egg", 4000]]);
    assert.equal(typeof september[0].id, "number");
    assert.deepEqual((await book.listMonth(ann.id, "2026-12")), []);
  });

  test("one person never sees or changes another's entries", async () => {
    const [bill] = await book.listMonth(ann.id, "2026-09");
    assert.deepEqual(await book.listMonth(ben.id, "2026-09"), []);
    assert.deepEqual(await book.monthTotals(ben.id), []);
    await assert.rejects(book.updateEntry(ben.id, bill.id, line("2026-09-01", "out", "mine now", 1)), is404);
    await assert.rejects(book.deleteEntry(ben.id, bill.id), is404);
    assert.equal((await book.listMonth(ann.id, "2026-09"))[0].label, "bill");
  });

  test("an entry can be changed, moved to another month, and deleted", async () => {
    const [bill] = await book.listMonth(ann.id, "2026-09");
    await book.updateEntry(ann.id, bill.id, line("2026-09-01", "out", "bill", 300)); // saving without changes is not an error
    await book.updateEntry(ann.id, bill.id, line("2026-07-15", "in", "refund", 20.5));
    assert.equal((await book.listMonth(ann.id, "2026-09")).length, 2);
    assert.deepEqual((await book.listMonth(ann.id, "2026-07")).map((e) => [e.kind, e.label, e.amountMinor]), [["in", "refund", 2050]]);
    await book.deleteEntry(ann.id, bill.id);
    await assert.rejects(book.deleteEntry(ann.id, bill.id), is404);
    await assert.rejects(book.updateEntry(ann.id, 999999, line("2026-07-15", "in", "x", 1)), is404);
  });

  test("the database itself refuses a zero or negative amount", async () => {
    await assert.rejects(book.addEntry(ann.id, line("2026-09-01", "out", "free", 0)), /chk_entry_amount/);
    await assert.rejects(book.addEntry(ann.id, line("2026-09-01", "out", "minus", -5)), /chk_entry_amount/);
  });

  test("settings are saved, replaced and cleared", async () => {
    await book.saveSettings(ann.id, { currency: "฿", start: { date: "2026-03-31", amountMinor: 500000 } });
    assert.deepEqual(await book.getSettings(ann.id), { currency: "฿", start: { date: "2026-03-31", amountMinor: 500000 } });
    await book.saveSettings(ann.id, { currency: "$", start: null });
    assert.deepEqual(await book.getSettings(ann.id), { currency: "$", start: null });
    assert.deepEqual(await book.getSettings(ben.id), { currency: "", start: null });
  });

  test("restoring a backup replaces the book, and the balances come out as written", async () => {
    // A ledger: 5,000 on 31 March, then month totals and money received.
    const backup = {
      settings: { currency: "฿", start: { date: "2026-03-31", amountMinor: 500000 } },
      entries: [
        line("2026-03-20", "out", "before the book started", 999),
        line("2026-03-31", "out", "on the starting day", 1),
        line("2026-04-30", "out", "month total", 1200),
        line("2026-05-07", "in", "money received", 3000),
        line("2026-05-31", "out", "month total", 1100),
        line("2026-06-02", "in", "money received", 2500),
        line("2026-06-02", "out", "course fee", 2500),
        line("2026-06-30", "out", "month total", 400),
        line("2026-07-31", "out", "month total", 800),
        line("2026-08-31", "out", "month total", 600),
        line("2026-09-30", "out", "month total", 900),
      ],
    };
    await book.replaceBook(ann.id, backup);
    const settings = await book.getSettings(ann.id);
    const months = await book.monthTotals(ann.id, settings.start.date);
    assert.deepEqual(months.map((m) => m.ym), ["2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"]);
    assert.deepEqual(months[0], { ym: "2026-03", in: 0, out: 100000, net: 0, count: 2 }); // shown, but already inside the starting balance
    assert.deepEqual(months[3], { ym: "2026-06", in: 250000, out: 290000, net: -40000, count: 3 });
    const left = months.slice(1).map((m) => leftAfter(months, settings.start, m.ym) / 100);
    assert.deepEqual(left, [3800, 5700, 5300, 4500, 3900, 3000]);
    // Without a starting date every entry counts.
    assert.equal((await book.monthTotals(ann.id))[0].net, -100000);
    assert.equal((await book.allEntries(ann.id)).length, 11);
    assert.deepEqual((await book.recentEntries(ann.id, 2)).map((e) => e.date), ["2026-09-30", "2026-08-31"]);
  });

  test("a restore that fails part-way leaves the old book untouched", async () => {
    const broken = { settings: { currency: "X", start: null }, entries: [line("2026-01-01", "out", "fine", 5), line("2026-01-02", "out", "x".repeat(41), 5)] };
    await assert.rejects(book.replaceBook(ann.id, broken));
    assert.equal((await book.allEntries(ann.id)).length, 11);
    assert.equal((await book.getSettings(ann.id)).currency, "฿");
  });

  test("a large backup goes in (in batches) and totals stay exact", async () => {
    const many = Array.from({ length: 1201 }, (_, i) => line(`2025-${String((i % 12) + 1).padStart(2, "0")}-15`, "out", "coffee", 0.1));
    await book.replaceBook(ben.id, { settings: { currency: "", start: null }, entries: many });
    const totals = await book.monthTotals(ben.id);
    assert.equal(totals.length, 12);
    assert.equal(totals.reduce((sum, m) => sum + m.out, 0), 12010); // 1,201 x 0.10 = 120.10 exactly
  });

  test("erasing removes one person's book and nobody else's", async () => {
    await book.eraseBook(ben.id);
    assert.deepEqual(await book.allEntries(ben.id), []);
    assert.deepEqual(await book.getSettings(ben.id), { currency: "", start: null });
    assert.equal((await book.allEntries(ann.id)).length, 11);
  });

  test("a session finds its user until it is destroyed or expires", async () => {
    const { token } = await sessions.createSession(ann.id);
    assert.deepEqual(await sessions.findSessionUser(token), { id: ann.id, name: "Ann", email: "ann@example.com" });
    assert.equal(await sessions.findSessionUser("made-up-token"), null);
    assert.equal(await sessions.findSessionUser(undefined), null);
    const [row] = await db.query("SELECT token_hash AS hash FROM sessions");
    assert.notEqual(row.hash, token); // only the hash is stored
    await db.query("UPDATE sessions SET expires_at = ?", [Date.now() - 1]);
    assert.equal(await sessions.findSessionUser(token), null);
    await sessions.deleteExpiredSessions();
    assert.equal((await db.query("SELECT COUNT(*) AS n FROM sessions"))[0].n, 0);
    const again = await sessions.createSession(ann.id);
    await sessions.destroySession(again.token);
    assert.equal(await sessions.findSessionUser(again.token), null);
  });

  test("deleting a user removes their book with them", async () => {
    await db.query("DELETE FROM users WHERE id = ?", [ann.id]);
    assert.equal((await db.query("SELECT COUNT(*) AS n FROM entries"))[0].n, 0);
    assert.equal((await db.query("SELECT COUNT(*) AS n FROM settings"))[0].n, 0);
  });
});
