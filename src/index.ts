import sourceMapSupport from "source-map-support";
sourceMapSupport.install();

import cluster from "cluster";
import { cpus } from "os";
import path from "path";

import bodyParser from "body-parser";
import cookieSession from "cookie-session";
import dotenv from "dotenv";
import express from "express";
import geopattern from "geopattern";
import morgan from "morgan";
import nunjucks from "nunjucks";
const tailwindColors = require("tailwindcss/colors");

import apiRouter from "./routers/apiRouter";
import appRouter from "./routers/appRouter";
import publicRouter from "./routers/publicRouter";

import db from "./lib/db";
import { pool } from "./lib/linkAdder";

dotenv.config();

if (!process.env.SESSION_KEY) {
  throw new Error("Must provide SESSION_KEY environment variable");
}

const app = express();
app.use(morgan("combined"));
app.use(
  cookieSession({
    name: "impermalink-session",
    keys: [process.env.SESSION_KEY],
    expires: new Date(new Date().getTime() + 1000 * 86400 * 365.25),
    sameSite: "strict",
    httpOnly: true,
  })
);
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.text());
const njEnv = nunjucks.configure(path.join(__dirname, "templates"), {
  autoescape: true,
  express: app,
});
app.set("view engine", "njk");

njEnv.addFilter("pattern", (str: string) => {
  const url = geopattern
    .generate(str, { color: tailwindColors.warmGray[200] })
    .toDataUrl();
  return `background-image: ${url};`;
});

const port = parseInt(process.env.PORT ?? "3000");

publicRouter.get("/favicon.ico", (_req, res) =>
  res.redirect(301, "/static/favicon.ico")
);
// Service worker needs to be at / because browsers scope what they handle to
// the folder they're found in
publicRouter.get("/sw.js", (_req, res) =>
  res.sendFile(path.join(__dirname, "static", "sw.js"))
);
app.use("/api", apiRouter);
app.use("/app", appRouter);
app.use(publicRouter);
app.use("/static", express.static(path.join(__dirname, "static")));

app.get("/health", (req, res) => {
  try {
    db.prepare("select 1 from links limit 1").get();
    res.send("ok");
  } catch (ex) {
    res.status(500);
    res.send("fail");
  }
});

if (cluster.isMaster) {
  for (let i = 0; i < cpus().length; i++) {
    cluster.fork();
  }
  process.on("SIGTERM", async () => {
    await pool.drain();
    await pool.clear();
  });
  process.on("SIGINT", async () => {
    await pool.drain();
    await pool.clear();
  });
} else {
  const server = app.listen(port, () => {
    console.log(`Listening on port ${port}`);
  });
  process.on("SIGTERM", async () => {
    server.close();
    await pool.drain();
    await pool.clear();
  });
  process.on("SIGINT", async () => {
    server.close();
    await pool.drain();
    await pool.clear();
  });
}
