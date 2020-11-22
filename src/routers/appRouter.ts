import express from "express";

import db from "../lib/db";
import { Link } from "../lib/types";

const appRouter = express.Router();

appRouter.use((req, res, next) => {
  if (req.session?.email) {
    res.locals.render = (view: string, options?: object) => {
      res.render(view, { userEmail: req.session!.email, ...options });
    };
    return void next();
  }
  res.redirect(307, "/login");
  next();
});

appRouter.get("/", (req, res, next) => {
  const links: Link[] = db
    .prepare(
      "select * from links where email=? group by domain order by dateSaved desc"
    )
    .all(req.session!.email);
  console.log(JSON.stringify(links));

  res.locals.render("app/home");
});

export default appRouter;
