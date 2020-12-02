import type { Request, Response } from "express";

export async function post(req: Request, res: Response) {
  req.session = null;
  res.send();
}
