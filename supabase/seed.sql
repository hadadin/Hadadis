-- House Hadadi — seed / reset script
-- Safe to re-run: wipes household-scoped data and reloads sample content for testing.
-- Run AFTER schema.sql, and after creating the two auth users (see README "Auth setup").
--
-- Usage: replace the two placeholder auth UIDs below with the real ids from
-- Supabase Auth > Users (or `select id, email from auth.users;`) before running.

begin;

delete from bank_transaction;
delete from bank_connection;
delete from calendar_connection;
delete from inbound_message;
delete from agent_event;
delete from link;
delete from task;
delete from transaction;
delete from category;
delete from chore_assignment;
delete from chore;
delete from grocery_item;
delete from meal_plan_day;
delete from meal_plan;
delete from recipe;
delete from app_user;
delete from household;

-- 1. Household
insert into household (id, name) values
  ('00000000-0000-0000-0000-000000000001', 'House Hadadi');

-- 2. Users — ⚠ replace these UUIDs with real auth.users ids before running.
insert into app_user (id, household_id, name, email) values
  ('11111111-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Noam', 'noam@example.com'),
  ('22222222-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Wife', 'wife@example.com');

-- 3. Finance categories with placeholder caps (₪ — set real numbers together, see Open Question #4)
insert into category (household_id, name, monthly_cap_agorot, sort_order) values
  ('00000000-0000-0000-0000-000000000001', 'Groceries', 300000, 1),
  ('00000000-0000-0000-0000-000000000001', 'Dining out', 150000, 2),
  ('00000000-0000-0000-0000-000000000001', 'Utilities', 100000, 3),
  ('00000000-0000-0000-0000-000000000001', 'Transport', 80000, 4),
  ('00000000-0000-0000-0000-000000000001', 'Fun/misc', 60000, 5);

-- 4. Sample recipes
insert into recipe (household_id, title, source_url, rating) values
  ('00000000-0000-0000-0000-000000000001', 'Mujadara', null, 5),
  ('00000000-0000-0000-0000-000000000001', 'Shakshuka', null, 4),
  ('00000000-0000-0000-0000-000000000001', '15-minute stir fry', null, 4);

-- 5. This week's meal plan (draft)
insert into meal_plan (id, household_id, week_start, status) values
  ('33333333-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', date_trunc('week', current_date)::date, 'draft');

-- 6. Grocery list
insert into grocery_item (household_id, title, added_by_user_id, source) values
  ('00000000-0000-0000-0000-000000000001', 'Milk', '11111111-0000-0000-0000-000000000001', 'app'),
  ('00000000-0000-0000-0000-000000000001', 'Eggs', '22222222-0000-0000-0000-000000000002', 'app'),
  ('00000000-0000-0000-0000-000000000001', 'Coffee', '11111111-0000-0000-0000-000000000001', 'app');

-- 7. Chores
insert into chore (household_id, title, frequency, effort_weight) values
  ('00000000-0000-0000-0000-000000000001', 'Dishes', 'daily', 1.0),
  ('00000000-0000-0000-0000-000000000001', 'Laundry', 'weekly', 1.5),
  ('00000000-0000-0000-0000-000000000001', 'Floors (sponja)', 'weekly', 1.2),
  ('00000000-0000-0000-0000-000000000001', 'Trash', 'weekly', 0.5);

-- 8. Sample transactions (this month)
insert into transaction (household_id, amount_agorot, direction, description, category_id, payer_user_id, occurred_at)
select '00000000-0000-0000-0000-000000000001', 4500, 'expense', 'Coffee', id, '22222222-0000-0000-0000-000000000002', current_date
from category where name = 'Dining out' and household_id = '00000000-0000-0000-0000-000000000001';

insert into transaction (household_id, amount_agorot, direction, description, category_id, payer_user_id, occurred_at)
select '00000000-0000-0000-0000-000000000001', 22000, 'expense', 'Shufersal groceries', id, '11111111-0000-0000-0000-000000000001', current_date
from category where name = 'Groceries' and household_id = '00000000-0000-0000-0000-000000000001';

-- 9. Tasks
insert into task (household_id, title, assignee_user_id, due_date) values
  ('00000000-0000-0000-0000-000000000001', 'Renew car insurance', '11111111-0000-0000-0000-000000000001', current_date + interval '2 days'),
  ('00000000-0000-0000-0000-000000000001', 'Call the plumber', '22222222-0000-0000-0000-000000000002', current_date + interval '5 days');

-- 10. Notepad
insert into link (household_id, url, title, saved_by_user_id, platform) values
  ('00000000-0000-0000-0000-000000000001', 'https://example.com/15-min-dinner', '15-minute dinner ideas', '11111111-0000-0000-0000-000000000001', 'generic');

commit;
