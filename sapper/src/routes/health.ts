import type { Request, Response } from "express";

import db from "./_lib/db";

export function get(req: Request, res: Response) {
  try {
    db.prepare("select 1 from links limit 1").get();
    res.send("ok");
  } catch (ex) {
    res.status(500);
    res.send("fail");
  }
}
