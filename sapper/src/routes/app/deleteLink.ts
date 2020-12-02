import type { Request, Response } from "express";

import db from "../_lib/db";

export async function post(req: Request, res: Response) {
  if (!req.body.linkId) return void res.send();

  db.prepare("delete from links where email=? and id=?").run(
    res.locals.email,
    req.body.linkId
  );
  res.send();
}
