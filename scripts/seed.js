// Creates a demo account with four months of made-up entries, so there is
// something to look at straight away. Safe to run again: it rewrites the
// demo book and touches nobody else's.
//
//   npm run seed      then log in as demo@example.com / demo-book-123
import { hashPassword } from "../lib/auth/password.js";
import { serverToday, shiftMonth } from "../lib/dates.js";
import { closePool } from "../lib/db.js";
import { replaceBook } from "../lib/repos/book.js";
import { createUser, findUserByEmail } from "../lib/repos/users.js";
import { applySchema } from "./db-setup.js";

const DEMO = { name: "Demo", email: "demo@example.com", password: "demo-book-123" };

/** A small repeatable random number generator: the same demo book every time. */
function randomFrom(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function demoBook(today) {
  const random = randomFrom(2026);
  const pick = (list) => list[Math.floor(random() * list.length)];
  const entries = [];
  const add = (date, kind, label, amount) => date <= today && entries.push({ date, kind, label, amountMinor: amount * 100 });
  const firstMonth = shiftMonth(today.slice(0, 7), -3);

  for (let i = 0; i < 4; i++) {
    const ym = shiftMonth(firstMonth, i);
    const daysInMonth = new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0)).getUTCDate();
    const day = (d) => `${ym}-${String(d).padStart(2, "0")}`;
    add(day(1), "out", "phone bill", 299);
    add(day(2), "in", "allowance", 9000);
    add(day(5), "out", "rent", 4500);
    for (let d = 1; d <= daysInMonth; d++) {
      if (random() < 0.85) add(day(d), "out", "food", pick([55, 60, 65, 65, 70, 75, 120]));
      if (random() < 0.3) add(day(d), "out", "transport", pick([30, 45, 57, 72]));
      if (d % 7 === 3) add(day(d), "out", pick(["rice", "vegetables", "eggs", "milk"]), pick([48, 85, 100, 145, 159]));
      if (random() < 0.06) add(day(d), "out", pick(["coffee with friends", "book", "haircut"]), pick([90, 150, 220]));
    }
  }
  const lastDayBefore = new Date(Date.UTC(Number(firstMonth.slice(0, 4)), Number(firstMonth.slice(5, 7)) - 1, 0)).toISOString().slice(0, 10);
  return { settings: { currency: "฿", start: { date: lastDayBefore, amountMinor: 1200000 } }, entries };
}

if (process.argv[1]?.endsWith("seed.js")) {
  try {
    await applySchema();
    const user = (await findUserByEmail(DEMO.email)) ?? (await createUser({ name: DEMO.name, email: DEMO.email, passwordHash: await hashPassword(DEMO.password) }));
    const book = demoBook(serverToday());
    await replaceBook(user.id, book);
    console.log(`Demo book ready: ${book.entries.length} entries. Log in as ${DEMO.email} / ${DEMO.password}`);
  } catch (error) {
    console.error(`Could not create the demo book: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}
