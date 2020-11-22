import * as path from "path";

import bsql from "better-sqlite3";

const db = bsql(path.join(process.env.DATA_DIR ?? process.cwd(), "db.sqlite"));
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
        domain text,
        url text not null,
        title text,
        dateSaved text not NULL DEFAULT (datetime('now', 'localtime')),
        dateDeleted text
      )`,
];
db.transaction(() => {
  const [{ user_version: schemaVersion }] = db.pragma("user_version");
  migrations.slice(schemaVersion).map((migration) => db.exec(migration));
  db.pragma(`user_version = ${migrations.length}`);
})();

export default db;
