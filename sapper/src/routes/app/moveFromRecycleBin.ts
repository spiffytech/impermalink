import type { Request, Response } from "express";

import db from "../_lib/db";

export function post(req: Request, res: Response) {
  const { linkId } = req.body;
  if (!linkId) return;

  db.prepare("update links set dateDeleted=null where id=? and email=?").run(
    linkId,
    res.locals.email
  );

  res.send();
}
