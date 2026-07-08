// Hand-written types matching supabase/schema.sql.
// Once you have a live Supabase project, you can regenerate the strict
// version with: `npx supabase gen types typescript --project-id <id> > src/lib/types.ts`
// (then re-add the row/App aliases below the generated Database type).

export interface Household {
  id: string;
  name: string;
  created_at: string;
}

export interface AppUser {
  id: string;
  household_id: string;
  name: string;
  email: string;
  telegram_user_id: string | null;
  google_calendar_connected: boolean;
  created_at: string;
}

export interface Recipe {
  id: string;
  household_id: string;
  title: string;
  source_url: string | null;
  rating: number | null;
  notes: string | null;
  created_at: string;
}

export interface MealPlan {
  id: string;
  household_id: string;
  week_start: string;
  status: "draft" | "approved";
  created_at: string;
}

export interface MealPlanDay {
  id: string;
  plan_id: string;
  day_index: number;
  recipe_id: string | null;
  free_text: string | null;
}

export interface GroceryItem {
  id: string;
  household_id: string;
  title: string;
  done: boolean;
  added_by_user_id: string | null;
  added_by_agent: string | null;
  source: "app" | "telegram" | "meal_plan";
  created_at: string;
}

export interface Chore {
  id: string;
  household_id: string;
  title: string;
  frequency: string;
  effort_weight: number;
  active: boolean;
  created_at: string;
}

export interface ChoreAssignment {
  id: string;
  chore_id: string;
  user_id: string;
  week_start: string;
  day_index: number | null;
  done_at: string | null;
  created_at: string;
}

export interface Category {
  id: string;
  household_id: string;
  name: string;
  monthly_cap_agorot: number;
  sort_order: number;
}

export interface Transaction {
  id: string;
  household_id: string;
  amount_agorot: number;
  direction: "expense" | "income";
  description: string;
  category_id: string | null;
  payer_user_id: string | null;
  source: "app" | "telegram" | "receipt" | "bank_import";
  bank_transaction_id: string | null;
  occurred_at: string;
  corrected: boolean;
  created_at: string;
}

export interface Task {
  id: string;
  household_id: string;
  title: string;
  assignee_user_id: string | null;
  due_date: string | null;
  due_time: string | null;
  done_at: string | null;
  source: "app" | "telegram";
  google_calendar_event_id: string | null;
  apple_calendar_event_uid: string | null;
  created_at: string;
}

export interface Link {
  id: string;
  household_id: string;
  url: string;
  title: string | null;
  thumbnail_url: string | null;
  note: string | null;
  platform: string | null;
  saved_by_user_id: string | null;
  created_at: string;
}

export interface AgentEvent {
  id: string;
  household_id: string;
  agent: "chef" | "home" | "finance" | "butler";
  type: "proposal" | "alert" | "digest" | "action";
  payload: Record<string, unknown>;
  status: "pending" | "approved" | "dismissed";
  created_at: string;
  resolved_at: string | null;
}

export interface CalendarConnection {
  id: string;
  user_id: string;
  provider: "google" | "apple";
  secret: string | null;
  caldav_username: string | null;
  caldav_principal_url: string | null;
  calendar_id: string | null;
  connected_at: string;
}

export interface BankConnection {
  id: string;
  household_id: string;
  company_id: string; // israeli-bank-scrapers CompanyTypes, e.g. 'hapoalim' | 'isracard' | 'max'
  display_name: string;
  credentials_encrypted: string;
  status: "active" | "error" | "disconnected";
  last_synced_at: string | null;
  last_error: string | null;
  created_at: string;
}

export interface BankTransaction {
  id: string;
  household_id: string;
  bank_connection_id: string | null;
  provider_transaction_id: string;
  amount_agorot: number;
  merchant_name: string | null;
  raw_category: string | null;
  status: "completed" | "pending";
  occurred_at: string;
  matched_transaction_id: string | null;
  created_at: string;
}

// Minimal Database shape so `createBrowserClient<Database>` type-checks.
// Loose (any-ish) on purpose until real generated types replace it.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any;
