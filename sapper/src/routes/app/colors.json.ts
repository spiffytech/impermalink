import type { Request, Response } from "express";
const twColors = require("tailwindcss/colors");

export function get(_req: Request, res: Response) {
  res.json(twColors);
}
