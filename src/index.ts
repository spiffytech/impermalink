import sourceMapSupport from "source-map-support";
sourceMapSupport.install();

import path from "path";

import bodyParser from "body-parser";
import cookieSession from "cookie-session";
import dotenv from "dotenv";
import express from "express";
import mustacheExpress from "mustache-express";

import apiRouter from "./routers/apiRouter";
import appRouter from "./routers/appRouter";
import publicRouter from "./routers/publicRouter";

dotenv.config();

if (!process.env.SESSION_KEY) {
  throw new Error("Must provide SESSION_KEY environment variable");
}

const app = express();
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
app.set("views", path.join(__dirname, "templates"));
app.set("view engine", "mustache.html");
app.engine(
  "mustache.html",
  mustacheExpress(path.join(__dirname, "templates", "partials"))
);

const port = parseInt(process.env.PORT ?? "3000");

app.use("/api", apiRouter);
app.use("/app", appRouter);
app.use(publicRouter);

app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
