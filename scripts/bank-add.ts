/**
 * Interactive CLI to connect a bank/credit-card account.
 *
 * Run locally: `npm run bank:add` — never through the deployed web app.
 * Credentials go straight from your terminal to your own Supabase project,
 * encrypted before they're written. They are never sent to, or seen by,
 * Claude / any chat session — paste them here, not in chat.
 */
import "dotenv/config";
import * as readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { SCRAPERS } from "../src/lib/integrations/israeli-bank-scrapers";
import { encryptJSON } from "../src/lib/integrations/crypto";
import { createServiceClient } from "../src/lib/supabase/service";

// Byte codes, not literal control characters (keeps this file's source clean/diffable).
const BYTE_ETX = 3; // Ctrl+C
const BYTE_BACKSPACE = 127;
const BYTE_BACKSPACE_ALT = 8;

async function maskedQuestion(rl: readline.Interface, prompt: string): Promise<string> {
  stdout.write(prompt);
  return new Promise((resolve) => {
    let value = "";
    const onData = (chunk: Buffer) => {
      const code = chunk[0];
      const char = chunk.toString("utf8");

      if (char === "\n" || char === "\r") {
        stdin.removeListener("data", onData);
        stdin.setRawMode?.(false);
        stdout.write("\n");
        resolve(value);
        return;
      }
      if (code === BYTE_ETX) {
        stdin.setRawMode?.(false);
        process.exit(1);
      }
      if (code === BYTE_BACKSPACE || code === BYTE_BACKSPACE_ALT) {
        value = value.slice(0, -1);
        stdout.write("\x08 \x08");
        return;
      }
      value += char;
      stdout.write("*");
    };
    stdin.setRawMode?.(true);
    stdin.resume();
    stdin.on("data", onData);
  });
}

async function main() {
  const rl = readline.createInterface({ input: stdin, output: stdout });
  const supabase = createServiceClient();

  const { data: household } = await supabase.from("household").select("id, name").limit(1).single();
  if (!household) {
    console.error("No household found — run supabase/seed.sql first.");
    process.exit(1);
  }
  console.log(`Household: ${household.name}\n`);

  console.log("Available institutions:");
  const companies = Object.keys(SCRAPERS) as (keyof typeof SCRAPERS)[];
  companies.forEach((id, i) => console.log(`  ${i + 1}. ${SCRAPERS[id].name} (${id})`));

  const choice = await rl.question("\nPick a number: ");
  const companyId = companies[parseInt(choice, 10) - 1];
  if (!companyId) {
    console.error("Invalid choice.");
    process.exit(1);
  }

  const displayName = await rl.question(
    `Display name (e.g. "Noam's ${SCRAPERS[companyId].name}"): `
  );

  const credentials: Record<string, string> = {};
  for (const field of SCRAPERS[companyId].loginFields) {
    if (field === "otpCodeRetriever" || field === "otpLongTermToken") {
      console.log(
        `Skipping "${field}" — this institution needs 2FA, which this simple CLI doesn't` +
          " automate yet. See israeli-bank-scrapers' docs for the OTP flow if you hit this."
      );
      continue;
    }
    const isSecret = field.toLowerCase().includes("password");
    const value = isSecret
      ? await maskedQuestion(rl, `${field}: `)
      : await rl.question(`${field}: `);
    credentials[field] = value;
  }

  const { error } = await supabase.from("bank_connection").insert({
    household_id: household.id,
    company_id: companyId,
    display_name: displayName || SCRAPERS[companyId].name,
    credentials_encrypted: encryptJSON(credentials),
    status: "active",
  });

  if (error) {
    console.error("Failed to save connection:", error.message);
    process.exit(1);
  }

  console.log(`\n✅ Connected. Run "npm run bank:sync" to pull transactions.`);
  rl.close();
  process.exit(0);
}

main();
