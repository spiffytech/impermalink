import cluster from "cluster";
import * as path from "path";

import bsql from "better-sqlite3";

const db = bsql(path.join(process.env.DATA_DIR ?? process.cwd(), "db.sqlite"));

if (cluster.isMaster) {
  db.exec("PRAGMA journal_mode=WAL;");
  const migrations: string[] = [
    `create table users (
        email text PRIMARY KEY not NULL,
        scrypt text not NULL,
        salt text not NULL,
        lastLogin text not NULL,
        recycleBinSize integer default 1,
        apiKey text not null
      );
  create table links (
        id integer primary key,
        email text not null,
        domain text not null,
        url text not null,
        title text,
        description text,
        dateSaved text not NULL DEFAULT (datetime('now', 'localtime')),
        dateDeleted text
      )`,
  ];
  db.transaction(() => {
    const [{ user_version: schemaVersion }] = db.pragma("user_version");
    migrations.slice(schemaVersion).map((migration) => db.exec(migration));
    db.pragma(`user_version = ${migrations.length}`);
  })();

  // SQLite can't clean up WAL checkpoints if there's always something reading
  // from the DB. You have to manually call a checkpoint with a more advanced
  // read-blocking mechanism like RESTART, or the WAL log will grow unboundedly.
  setInterval(() => {
    db.exec("PRAGMA wal_checkpoint(RESTART)");
  }, 60000 * 60);
}

export default db;
