import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const sql = readFileSync(new URL('../../database/001_initial_schema.sql', import.meta.url), 'utf8');
function fresh() { const db = new DatabaseSync(':memory:'); db.exec(sql); return db; }

test('schema applies cleanly and money columns reject bad values', () => {
  const db = fresh();
  db.exec(`INSERT INTO users(id,email,password_hash,role) VALUES (1,'a@x.com','h','super_admin')`);
  db.exec(`INSERT INTO trips(id,name,created_by) VALUES (1,'Goa',1)`);
  const ins = (total: number) => db.exec(`INSERT INTO expenses(trip_id,title,expense_date,category,total_paise,paid_by_type,paid_by_id,accounting_mode,split_method,created_by)
    VALUES (1,'Lunch','2026-10-01','Lunch',${total},'person',1,'individual','equal',1)`);
  ins(300000);
  assert.throws(() => ins(0));
  assert.throws(() => ins(-5));
});

test('schema: item subtotal check, no negative shares, no self-repayment, duplicate keys, FK enforced', () => {
  const db = fresh();
  db.exec(`INSERT INTO users(id,email,password_hash,role) VALUES (1,'a@x.com','h','super_admin')`);
  db.exec(`INSERT INTO trips(id,name,created_by) VALUES (1,'Goa',1)`);
  db.exec(`INSERT INTO expenses(id,trip_id,title,expense_date,category,total_paise,paid_by_type,paid_by_id,accounting_mode,split_method,created_by)
    VALUES (1,1,'Breakfast','2026-10-01','Breakfast',47000,'person',1,'individual','itemized',1)`);
  db.exec(`INSERT INTO expense_items(expense_id,name,unit_price_paise,quantity,subtotal_paise) VALUES (1,'Idly',5000,3,15000)`);
  assert.throws(() => db.exec(`INSERT INTO expense_items(expense_id,name,unit_price_paise,quantity,subtotal_paise) VALUES (1,'Puri',8000,4,99)`));
  assert.throws(() => db.exec(`INSERT INTO expense_allocations(expense_id,account_type,account_id,amount_paise) VALUES (1,'person',1,-1)`));
  db.exec(`INSERT INTO expense_allocations(expense_id,account_type,account_id,amount_paise) VALUES (1,'person',1,100)`);
  assert.throws(() => db.exec(`INSERT INTO expense_allocations(expense_id,account_type,account_id,amount_paise) VALUES (1,'person',1,100)`)); // no double row
  assert.throws(() => db.exec(`INSERT INTO repayments(trip_id,from_type,from_id,to_type,to_id,amount_paise,paid_on,recorded_by) VALUES (1,'person',1,'person',1,100,'2026-10-02',1)`));
  const rep = `INSERT INTO repayments(trip_id,from_type,from_id,to_type,to_id,amount_paise,paid_on,idempotency_key,recorded_by) VALUES (1,'person',2,'person',1,100,'2026-10-02','k',1)`;
  db.exec(rep);
  assert.throws(() => db.exec(rep)); // duplicate idempotency key
  assert.throws(() => db.exec(`INSERT INTO expenses(trip_id,title,expense_date,category,total_paise,paid_by_type,paid_by_id,accounting_mode,split_method,created_by) VALUES (99,'x','d','c',1,'person',1,'individual','equal',1)`)); // FK
});
