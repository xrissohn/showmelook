/* eslint-disable */
// @ts-nocheck
// 시뮬레이션용 가짜 Supabase: 엣지 함수가 쓰는 쿼리 문법만 메모리 배열 위에서 흉내 낸다.
// 실제 함수 코드를 그대로 실행하고, 운영 DB에는 아무것도 쓰지 않는다.
type Row = Record<string, any>;
const clone = <T,>(x: T): T => structuredClone(x);
const uuid = () => crypto.randomUUID();
const now = () => new Date().toISOString();

export class FakeDb {
  tables: Record<string, Row[]> = {};
  users = new Map<string, { id: string; email: string }>(); // token -> user
  usersById = new Map<string, { id: string; email: string }>();
  uniques: Record<string, string[]> = { look_feedback: ['user_id', 'look_id'], product_feedback_scores: ['product_id'] };
  log: string[] = [];
  addUser(id: string, email: string) { const u = { id, email }; this.users.set(`tok_${id}`, u); this.usersById.set(id, u); return `tok_${id}`; }
  t(name: string) { return (this.tables[name] ??= []); }
  seed(name: string, rows: Row[]) { this.t(name).push(...rows.map(clone)); }
}

const val = (r: Row, col: string) => { if (col.includes('->>')) { const [b, k] = col.split('->>'); return r[b]?.[k]; } return r[col]; };
const cmp = (op: string, a: any, v: any): boolean => {
  const A = typeof a === 'number' ? a : String(a ?? ''); const V = typeof a === 'number' ? Number(v) : String(v);
  switch (op) { case 'eq': return a === v || String(a) === String(v); case 'neq': return String(a) !== String(v);
    case 'gt': return a != null && A > V; case 'gte': return a != null && A >= V; case 'lt': return a != null && A < V; case 'lte': return a != null && A <= V; default: throw new Error('op ' + op); }
};
const CHECKS: Record<string, (r: Row) => string | null> = {
  look_feedback: (r) => ![-1, 0, 1].includes(r.rating) ? 'rating check' : r.comment && r.comment.length > 1000 ? 'comment length check' : !['none', 'clean', 'flagged', 'approved', 'rejected'].includes(r.moderation_status) ? 'moderation_status check' : null,
  product_feedback: (r) => !['like', 'dislike', 'click', 'cart', 'purchase', 'view', 'remove', 'payment_notify_request', 'style_like', 'style_dislike'].includes(r.action_type) ? 'action_type check' : null,
  admin_email_outbox: (r) => !String(r.to_email).includes('@') ? 'to_email check' : null,
};
const DEFAULTS: Record<string, () => Row> = {
  look_feedback: () => ({ moderation_status: 'none', moderation_categories: [], product_ids: [], used_in_learning: false, decided_by: null, decided_at: null, created_at: now(), updated_at: now() }),
  feedback_reports: () => ({ created_at: now(), email_recipients: [], emailed_at: null }),
  recommendation_insights: () => ({ created_at: now(), status: 'active' }),
  admin_email_outbox: () => ({ status: 'pending', attempts: 0, created_at: now() }),
  product_feedback: () => ({ created_at: now() }),
};

class Q implements PromiseLike<any> {
  op: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select'; payload: any; returning = false; count?: string; head = false;
  filters: Array<(r: Row) => boolean> = []; orderBy?: { col: string; asc: boolean }; lim?: number; mode?: 'single' | 'maybeSingle'; onConflict?: string; ignoreDup = false;
  constructor(private db: FakeDb, private table: string) {}
  select(_cols = '*', opts?: { count?: string; head?: boolean }) { if (this.op === 'select') { this.count = opts?.count; this.head = !!opts?.head; } else this.returning = true; return this; }
  insert(p: any) { this.op = 'insert'; this.payload = p; return this; }
  upsert(p: any, o?: { onConflict?: string; ignoreDuplicates?: boolean }) { this.op = 'upsert'; this.payload = p; this.onConflict = o?.onConflict; this.ignoreDup = !!o?.ignoreDuplicates; return this; }
  update(p: any) { this.op = 'update'; this.payload = p; return this; }
  delete() { this.op = 'delete'; return this; }
  private f(op: string, c: string, v: any) { this.filters.push((r) => cmp(op, val(r, c), v)); return this; }
  eq(c: string, v: any) { return this.f('eq', c, v); } neq(c: string, v: any) { return this.f('neq', c, v); }
  gt(c: string, v: any) { return this.f('gt', c, v); } gte(c: string, v: any) { return this.f('gte', c, v); }
  lt(c: string, v: any) { return this.f('lt', c, v); } lte(c: string, v: any) { return this.f('lte', c, v); }
  in(c: string, arr: any[]) { this.filters.push((r) => arr.map(String).includes(String(val(r, c)))); return this; }
  filter(c: string, op: string, v: any) { return this.f(op, c, v); }
  or(expr: string) { const parts = expr.split(',').map((p) => { const i = p.indexOf('.'); const j = p.indexOf('.', i + 1); return { c: p.slice(0, i), op: p.slice(i + 1, j), v: p.slice(j + 1) }; }); this.filters.push((r) => parts.some((p) => cmp(p.op, val(r, p.c), p.v))); return this; }
  order(col: string, o?: { ascending?: boolean }) { this.orderBy = { col, asc: o?.ascending !== false }; return this; }
  limit(n: number) { this.lim = n; return this; }
  maybeSingle() { this.mode = 'maybeSingle'; return this; } single() { this.mode = 'single'; return this; }
  then<R1 = any, R2 = never>(ok?: ((v: any) => R1 | PromiseLike<R1>) | null, err?: ((e: any) => R2 | PromiseLike<R2>) | null) { return this.run().then(ok, err); }

  private prep(row: Row) { return { id: uuid(), ...(DEFAULTS[this.table]?.() ?? {}), ...clone(row) }; }
  private validate(r: Row) { return CHECKS[this.table]?.(r) ?? null; }
  private conflictKey(r: Row, cols: string[]) { return cols.map((c) => String(r[c])).join('|'); }
  private async run(): Promise<any> {
    const t = this.db.t(this.table);
    const matched = () => t.filter((r) => this.filters.every((f) => f(r)));
    const err = (m: string, code = '23514') => ({ data: null, error: { message: `${this.table}: ${m}`, code }, count: null });
    if (this.op === 'select') {
      let rows = matched();
      if (this.orderBy) { const { col, asc } = this.orderBy; rows = [...rows].sort((a, b) => (String(a[col]) < String(b[col]) ? -1 : String(a[col]) > String(b[col]) ? 1 : 0) * (asc ? 1 : -1)); }
      const total = rows.length; if (this.lim !== undefined) rows = rows.slice(0, this.lim);
      if (this.mode) { if (rows.length === 0) return this.mode === 'single' ? err('no rows', 'PGRST116') : { data: null, error: null, count: null }; if (rows.length > 1) return err('multiple rows', 'PGRST116'); return { data: clone(rows[0]), error: null, count: null }; }
      return { data: this.head ? null : clone(rows), error: null, count: this.count ? total : null };
    }
    if (this.op === 'insert' || this.op === 'upsert') {
      const list = (Array.isArray(this.payload) ? this.payload : [this.payload]) as Row[];
      const out: Row[] = []; const ucols = this.db.uniques[this.table];
      for (const raw of list) {
        const keyCols = this.onConflict ? this.onConflict.split(',') : ucols;
        if (this.op === 'upsert' && keyCols) { const ex = t.find((r) => this.conflictKey(r, keyCols) === this.conflictKey(raw, keyCols)); if (ex) { if (this.ignoreDup) continue; for (const [k, v] of Object.entries(raw)) if (v !== undefined) ex[k] = clone(v); const bad = this.validate(ex); if (bad) return err(bad); out.push(ex); continue; } }
        const row = this.prep(Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== undefined)));
        const bad = this.validate(row); if (bad) return err(bad);
        if (ucols && t.some((r) => this.conflictKey(r, ucols) === this.conflictKey(row, ucols))) return err('duplicate key', '23505');
        t.push(row); out.push(row);
      }
      if (this.mode === 'single' || this.mode === 'maybeSingle') return { data: out[0] ? clone(out[0]) : null, error: null, count: null };
      return { data: this.returning ? clone(out) : null, error: null, count: null };
    }
    if (this.op === 'update') { const rows = matched(); for (const r of rows) for (const [k, v] of Object.entries(this.payload as Row)) if (v !== undefined) r[k] = clone(v); return { data: this.returning ? clone(rows) : null, error: null, count: null }; }
    const rows = matched(); this.db.tables[this.table] = t.filter((r) => !rows.includes(r)); return { data: this.returning ? clone(rows) : null, error: null, count: null };
  }
}

export function makeClient(db: FakeDb) {
  return {
    from: (table: string) => new Q(db, table),
    auth: {
      getUser: async (token: string) => { const u = db.users.get(token); return u ? { data: { user: u }, error: null } : { data: { user: null }, error: { message: 'invalid token' } }; },
      admin: { getUserById: async (id: string) => { const u = db.usersById.get(id); return u ? { data: { user: u }, error: null } : { data: { user: null }, error: { message: 'not found' } }; } },
    },
    rpc: async () => ({ data: null, error: null }),
  };
}
