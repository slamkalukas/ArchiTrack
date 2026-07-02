#!/usr/bin/env node
/**
 * CI check: messages/sk.json and messages/en.json must have identical key sets
 * (spec/04-features.md §11 AC). Run with: node scripts/check-i18n-parity.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const messagesDir = path.join(__dirname, "..", "messages");

function flattenKeys(obj, prefix = "") {
  const keys = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      keys.push(...flattenKeys(value, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

function loadKeys(locale) {
  const filePath = path.join(messagesDir, `${locale}.json`);
  const content = JSON.parse(readFileSync(filePath, "utf-8"));
  return new Set(flattenKeys(content));
}

const sk = loadKeys("sk");
const en = loadKeys("en");

const missingInEn = [...sk].filter((key) => !en.has(key));
const missingInSk = [...en].filter((key) => !sk.has(key));

if (missingInEn.length > 0 || missingInSk.length > 0) {
  if (missingInEn.length > 0) {
    console.error("Keys present in sk.json but missing in en.json:");
    for (const key of missingInEn) console.error(`  - ${key}`);
  }
  if (missingInSk.length > 0) {
    console.error("Keys present in en.json but missing in sk.json:");
    for (const key of missingInSk) console.error(`  - ${key}`);
  }
  process.exit(1);
}

console.log(`i18n parity OK — ${sk.size} keys match in both catalogs.`);
