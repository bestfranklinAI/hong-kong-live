import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  normalizeSearchText,
  searchResultSchema,
  type SearchResult,
  type CatalogueStatus,
} from '@hk/contracts';
import type { SearchRepository } from './repository';

/** Node-only persistence adapter. The HTTP app can receive a different repository on Workers. */
export class RestaurantStore implements SearchRepository {
  private readonly db: DatabaseSync;
  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS restaurants (id TEXT PRIMARY KEY, data TEXT NOT NULL, text TEXT NOT NULL, address TEXT NOT NULL, attempted_at INTEGER, resolved INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS catalogue_meta (id INTEGER PRIMARY KEY CHECK(id=1), source_date TEXT, fetched_at TEXT, imported_at TEXT, hash TEXT);
      CREATE VIRTUAL TABLE IF NOT EXISTS restaurant_fts USING fts5(id UNINDEXED, text, tokenize='trigram');`);
  }
  status(now: number): CatalogueStatus {
    const meta = this.db.prepare('SELECT * FROM catalogue_meta WHERE id=1').get();
    const counts = this.db
      .prepare('SELECT count(*) AS count, coalesce(sum(resolved),0) AS resolved FROM restaurants')
      .get()!;
    const sourceDate = meta?.source_date as string | undefined;
    return {
      sourceDate: sourceDate ?? null,
      fetchedAt: (meta?.fetched_at as string) ?? null,
      importedAt: (meta?.imported_at as string) ?? null,
      count: Number(counts.count),
      resolved: Number(counts.resolved),
      stale: !sourceDate || now - Date.parse(`${sourceDate}T09:00:00+08:00`) > 48 * 3600000,
    };
  }
  get(id: string): SearchResult | undefined {
    const row = this.db.prepare('SELECT data FROM restaurants WHERE id=?').get(id);
    return row ? searchResultSchema.parse(JSON.parse(String(row.data))) : undefined;
  }
  search(query: string, limit: number): SearchResult[] {
    const tokens = normalizeSearchText(query).split(' ').filter(Boolean).slice(0, 8);
    if (!tokens.length) return [];
    const indexed = tokens.filter((token) => [...token].length >= 3);
    const where = tokens.map(() => "r.text LIKE ? ESCAPE '\\'").join(' AND ');
    const bindings = tokens.map((token) => `%${token.replace(/[\\%_]/g, '\\$&')}%`);
    // Trigram candidates handle mixed Chinese/English; one/two-character terms use bounded catalogue scanning.
    const sql = `SELECT r.data FROM restaurants r ${indexed.length ? 'JOIN restaurant_fts f ON f.id=r.id' : ''} WHERE ${indexed.length ? 'restaurant_fts MATCH ? AND ' : ''}${where} ORDER BY r.id LIMIT ?`;
    const values = indexed.length
      ? [indexed.map((token) => `"${token}"`).join(' AND '), ...bindings, limit]
      : [...bindings, limit];
    return this.db
      .prepare(sql)
      .all(...values)
      .map((row) => searchResultSchema.parse(JSON.parse(String(row.data))));
  }
  nearby(lat: number, lng: number, limit: number) {
    return this.db
      .prepare(
        `SELECT data FROM restaurants WHERE resolved=1
      AND json_extract(data,'$.location.lat') BETWEEN ? AND ?
      AND json_extract(data,'$.location.lng') BETWEEN ? AND ?
      ORDER BY pow(json_extract(data,'$.location.lat')-?,2) + pow((json_extract(data,'$.location.lng')-?)*0.925,2) LIMIT ?`,
      )
      .all(lat - 0.02, lat + 0.02, lng - 0.022, lng + 0.022, lat, lng, limit)
      .map((row) => searchResultSchema.parse(JSON.parse(String(row.data))));
  }
  publish(records: SearchResult[], date: string, hash: string, fetchedAt: string, now: number) {
    const oldStatus = this.status(now);
    if (oldStatus.sourceDate && date < oldStatus.sourceDate)
      throw new Error('Refusing an older source publication.');
    if (
      oldStatus.count &&
      (records.length < oldStatus.count * 0.5 || records.length > oldStatus.count * 1.5)
    )
      throw new Error('Unexpected catalogue size change; retaining last good snapshot.');
    if (this.db.prepare('SELECT hash FROM catalogue_meta WHERE id=1').get()?.hash === hash) {
      this.db.prepare('UPDATE catalogue_meta SET fetched_at=? WHERE id=1').run(fetchedAt);
      return;
    }
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const old = new Map(
        this.db
          .prepare('SELECT id, data, attempted_at FROM restaurants')
          .all()
          .map((row) => [String(row.id), row]),
      );
      this.db.exec('DELETE FROM restaurants; DELETE FROM restaurant_fts');
      const insert = this.db.prepare(
        'INSERT INTO restaurants(id,data,text,address,attempted_at,resolved) VALUES(?,?,?,?,?,?)',
      );
      const index = this.db.prepare('INSERT INTO restaurant_fts(id,text) VALUES(?,?)');
      for (const record of records) {
        const previous = old.get(record.id);
        const parsed = previous
          ? searchResultSchema.parse(JSON.parse(String(previous.data)))
          : undefined;
        const unchanged =
          parsed && normalizeSearchText(parsed.address) === normalizeSearchText(record.address);
        const row = unchanged
          ? { ...record, location: parsed.location, locationPrecision: parsed.locationPrecision }
          : record;
        const text = normalizeSearchText(
          [row.name, row.nameZh, row.address, row.addressZh, row.district].join(' '),
        );
        insert.run(
          row.id,
          JSON.stringify(row),
          text,
          row.address,
          unchanged ? (previous?.attempted_at ?? null) : null,
          row.location ? 1 : 0,
        );
        index.run(row.id, text);
      }
      this.db
        .prepare('INSERT OR REPLACE INTO catalogue_meta VALUES(1,?,?,?,?)')
        .run(date, fetchedAt, new Date(now).toISOString(), hash);
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
  pending(now: number, limit: number) {
    return this.db
      .prepare(
        'SELECT data FROM restaurants WHERE resolved=0 AND (attempted_at IS NULL OR attempted_at<?) ORDER BY attempted_at, id LIMIT ?',
      )
      .all(now - 7 * 86400000, limit)
      .map((row) => searchResultSchema.parse(JSON.parse(String(row.data))));
  }
  locate(id: string, address: string, match: SearchResult | undefined, now: number) {
    const row = this.get(id);
    if (!row || row.address !== address) return;
    const next = match?.location
      ? { ...row, location: match.location, locationPrecision: 'address' as const }
      : row;
    this.db
      .prepare('UPDATE restaurants SET data=?, attempted_at=?, resolved=? WHERE id=?')
      .run(JSON.stringify(next), now, next.location ? 1 : 0, id);
  }
  close() {
    this.db.close();
  }
}
