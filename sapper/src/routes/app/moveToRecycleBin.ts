import type { Request, Response } from "express";

import db from "../_lib/db";

export function post(req: Request, res: Response) {
  const { linkId } = req.body;
  if (!linkId) return;
  // Don't update the deletion date if it's already set. UI shouldn't allow
  // this, but you never know. If we want to reset a deletion date, we'll create
  // a dedicated endpoint to do that.
  db.prepare(
    "update links set dateDeleted=datetime('now', 'localtime') where id=? and email=? and dateDeleted is null"
  ).run(linkId, res.locals.email);

  db.prepare(
    "delete from links where email=? and dateDeleted is not null and id not in (select id from links where email=? and dateDeleted is not null order by dateDeleted desc limit ?)"
  ).run(res.locals.email, res.locals.email, 1);

  res.send();
}
