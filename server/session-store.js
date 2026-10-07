import session from 'express-session';

export class SQLiteSessionStore extends session.Store {
  constructor(database) {
    super();
    this.database = database;
    this.getSession = database.prepare('SELECT data, expires_at FROM sessions WHERE sid = ?');
    this.setSession = database.prepare(`
      INSERT INTO sessions (sid, data, expires_at) VALUES (?, ?, ?)
      ON CONFLICT(sid) DO UPDATE SET data = excluded.data, expires_at = excluded.expires_at
    `);
    this.touchSession = database.prepare('UPDATE sessions SET expires_at = ? WHERE sid = ?');
    this.deleteSession = database.prepare('DELETE FROM sessions WHERE sid = ?');
    this.pruneSessions = database.prepare('DELETE FROM sessions WHERE expires_at <= ?');
  }

  get(sid, callback) {
    try {
      const row = this.getSession.get(sid);
      if (!row || row.expires_at <= Date.now()) {
        this.deleteSession.run(sid);
        callback(null, null);
        return;
      }
      callback(null, JSON.parse(row.data));
    } catch (error) {
      callback(error);
    }
  }

  set(sid, value, callback = () => {}) {
    try {
      const expiresAt = value.cookie?.expires
        ? new Date(value.cookie.expires).getTime()
        : Date.now() + (value.cookie?.maxAge || 8 * 60 * 60 * 1000);
      this.setSession.run(sid, JSON.stringify(value), expiresAt);
      callback(null);
    } catch (error) {
      callback(error);
    }
  }

  touch(sid, value, callback = () => {}) {
    try {
      const expiresAt = value.cookie?.expires
        ? new Date(value.cookie.expires).getTime()
        : Date.now() + (value.cookie?.maxAge || 8 * 60 * 60 * 1000);
      this.touchSession.run(expiresAt, sid);
      callback(null);
    } catch (error) {
      callback(error);
    }
  }

  destroy(sid, callback = () => {}) {
    try {
      this.deleteSession.run(sid);
      callback(null);
    } catch (error) {
      callback(error);
    }
  }

  prune() {
    this.pruneSessions.run(Date.now());
  }
}