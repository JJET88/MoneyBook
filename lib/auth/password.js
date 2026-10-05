import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

// scrypt is deliberately slow and memory-hungry, which is what makes stolen
// hashes expensive to crack. The parameters are stored with each hash so they
// can be raised later without breaking existing accounts.
const PARAMS = { N: 2 ** 15, r: 8, p: 1 };
const KEY_LENGTH = 32;
const MAX_MEMORY = 64 * 1024 * 1024;

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, KEY_LENGTH, { ...PARAMS, maxmem: MAX_MEMORY });
  return ["scrypt", PARAMS.N, PARAMS.r, PARAMS.p, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function verifyPassword(password, stored) {
  const [scheme, N, r, p, salt, expected] = String(stored).split("$");
  if (scheme !== "scrypt" || !expected) return false;
  const expectedKey = Buffer.from(expected, "base64");
  const key = await scryptAsync(password, Buffer.from(salt, "base64"), expectedKey.length, {
    N: Number(N), r: Number(r), p: Number(p), maxmem: MAX_MEMORY,
  });
  return timingSafeEqual(key, expectedKey);
}

// Checked when someone logs in with an email that has no account, so that
// "no such user" takes as long as "wrong password" and the two look the same.
let dummyHash;
export async function wasteTimeLikeAVerify(password) {
  dummyHash ??= await hashPassword("not a real password");
  await verifyPassword(password, dummyHash);
}
