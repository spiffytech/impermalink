import sourceMapSupport from "source-map-support";
sourceMapSupport.install();

import bodyParser from "body-parser";
import cookieSession from "cookie-session";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();
import sirv from "sirv";
import express from "express";
import compression from "compression";
import * as sapper from "@sapper/server";

import type { Request, Response } from "express";

import db from "./routes/_lib/db";
import { terminatePool } from "./routes/app/storeLink";

const { PORT, NODE_ENV } = process.env;
const dev = NODE_ENV === "development";

if (!process.env.SESSION_KEY) {
  throw new Error("Must supply SESSION_KEY");
}

const server = express()
  .use(
    cookieSession({
      name: "impermalink-session",
      keys: [process.env.SESSION_KEY],
      expires: new Date(new Date().getTime() + 1000 * 86400 * 365.25),
      sameSite: "strict",
      httpOnly: true,
    })
  )
  .use(bodyParser.json())
  .use(bodyParser.urlencoded({ extended: true }))
  .use(bodyParser.text())
  .use((req, res, next) => {
    if (!req.session) req.session = {};
    res.locals.email = req.session.email ?? null;
    next();
  })
  .use("/app", (req, res, next) => {
    if (!res.locals.email) {
      if (!req.headers["x-apikey"]) {
        res.status(403);
        res.send("You must be logged in to access this route");
        return;
      }

      const user = db
        .prepare("select email from users where apiKey=?")
        .get(req.headers["x-apikey"]);
      if (!user) {
        res.status(403);
        res.send("You must be logged in to access this route");
        return;
      }

      res.locals.email = user.email;
    }
    next();
  })
  .use("/app/share-target", cors({ origin: true, credentials: true }))
  .use(
    compression({ threshold: 0 }),
    sirv("static", { dev }),
    sapper.middleware({
      session: (_req: Request, res: Response) => res.locals,
    })
  )
  .listen(PORT, () => {
    console.log("Listening");
  });

process.on("SIGTERM", async () => {
  server.close();
  await terminatePool();
  process.exit();
});
