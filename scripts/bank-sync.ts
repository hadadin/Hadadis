/**
 * Pulls transactions for every connected bank/credit-card account and
 * reconciles them against the manual `transaction` log (PRD 14: "bank/
 * credit-card import ... reconciled against manual log").
 *
 * Run locally or on a cron (see README "Banking integration" for why this
 * isn't a Vercel route — Puppeteer/headless-Chrome doesn't fit serverless
 * function limits reliably): `npm run bank:sync`
 */
import "dotenv/config";
import { CompanyTypes, scrapeCompany, toAgorot } from "../src/lib/integrations/israeli-bank-scrapers";
import { decryptJSON } from "../src/lib/integrations/crypto";
import { createServiceClient } from "../src/lib/supabase/service";
import type { ScraperCredentials } from "israeli-bank-scrapers";

const LOOKBACK_DAYS = 14;
// Match a bank transaction to a manually-logged one within this window/tolerance
// before assuming it's new (PRD FR-4 doesn't specify exact numbers — tune as needed).
const MATCH_WINDOW_DAYS = 3;
const MATCH_TOLERANCE_AGOROT = 100; // ₪1

async function main() {
  const supabase = createServiceClient();

  const { data: connections, error } = await supabase
    .from("bank_connection")
    .select("*")
    .eq("status", "active");

  if (error || !connections) {
    console.error("Could not load bank connections:", error?.message);
    process.exit(1);
  }

  if (connections.length === 0) {
    console.log("No active bank connections. Run `npm run bank:add` first.");
    return;
  }

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - LOOKBACK_DAYS);

  for (const conn of connections) {
    console.log(`\nSyncing ${conn.display_name} (${conn.company_id})…`);
    const credentials = decryptJSON<ScraperCredentials>(conn.credentials_encrypted);

    try {
      const result = await scrapeCompany(conn.company_id as CompanyTypes, credentials, startDate);

      if (!result.success) {
        console.error(`  ✗ ${result.errorType}: ${result.errorMessage}`);
        await supabase
          .from("bank_connection")
          .update({ status: "error", last_error: result.errorMessage ?? result.errorType })
          .eq("id", conn.id);
        continue;
      }

      let imported = 0;
      for (const account of result.accounts ?? []) {
        for (const txn of account.txns) {
          const identifier = String(txn.identifier ?? `${account.accountNumber}-${txn.date}-${txn.chargedAmount}`);

          const { data: existing } = await supabase
            .from("bank_transaction")
            .select("id")
            .eq("provider_transaction_id", identifier)
            .maybeSingle();
          if (existing) continue; // already synced — idempotent

          const amountAgorot = toAgorot(Math.abs(txn.chargedAmount));
          const occurredAt = txn.date.slice(0, 10);

          const { data: bankTxn } = await supabase
            .from("bank_transaction")
            .insert({
              household_id: conn.household_id,
              bank_connection_id: conn.id,
              provider_transaction_id: identifier,
              amount_agorot: amountAgorot,
              merchant_name: txn.description,
              raw_category: txn.category ?? null,
              status: txn.status,
              occurred_at: occurredAt,
            })
            .select()
            .single();

          if (!bankTxn) continue;
          imported++;

          // Reconciliation: look for a manually-logged expense within the
          // match window/tolerance that isn't linked to a bank row yet.
          const windowStart = new Date(occurredAt);
          windowStart.setDate(windowStart.getDate() - MATCH_WINDOW_DAYS);
          const windowEnd = new Date(occurredAt);
          windowEnd.setDate(windowEnd.getDate() + MATCH_WINDOW_DAYS);

          const { data: candidates } = await supabase
            .from("transaction")
            .select("id, amount_agorot")
            .eq("household_id", conn.household_id)
            .eq("direction", "expense")
            .is("bank_transaction_id", null)
            .gte("occurred_at", windowStart.toISOString().slice(0, 10))
            .lte("occurred_at", windowEnd.toISOString().slice(0, 10));

          const match = (candidates ?? []).find(
            (c) => Math.abs(c.amount_agorot - amountAgorot) <= MATCH_TOLERANCE_AGOROT
          );

          if (match) {
            await supabase.from("transaction").update({ bank_transaction_id: bankTxn.id }).eq("id", match.id);
            await supabase.from("bank_transaction").update({ matched_transaction_id: match.id }).eq("id", bankTxn.id);
          } else {
            // No manual entry — create one so it shows up in Finance for
            // the household to categorize (source='bank_import', no
            // category yet, matching PRD's "reconciled against manual log").
            const { data: newTxn } = await supabase
              .from("transaction")
              .insert({
                household_id: conn.household_id,
                amount_agorot: amountAgorot,
                direction: "expense",
                description: txn.description,
                category_id: null,
                payer_user_id: null,
                source: "bank_import",
                bank_transaction_id: bankTxn.id,
                occurred_at: occurredAt,
              })
              .select()
              .single();
            if (newTxn) {
              await supabase.from("bank_transaction").update({ matched_transaction_id: newTxn.id }).eq("id", bankTxn.id);
            }
          }
        }
      }

      await supabase
        .from("bank_connection")
        .update({ status: "active", last_synced_at: new Date().toISOString(), last_error: null })
        .eq("id", conn.id);

      console.log(`  ✓ ${imported} new transaction(s)`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`  ✗ Sync failed: ${message}`);
      await supabase.from("bank_connection").update({ status: "error", last_error: message }).eq("id", conn.id);
    }
  }
}

main().then(() => process.exit(0));
