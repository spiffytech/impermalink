import express from "express";

import db from "../lib/db";
import { Link } from "../lib/types";

const minLinkGroupSize = 3;

const appRouter = express.Router();

appRouter.use((req, res, next) => {
  if (!req.session?.email) {
    res.redirect(307, "/login");
    return void res.end();
  }
  res.locals.render = (view: string, options?: object) => {
    res.render(view, { userEmail: req.session!.email, ...options });
  };
  return void next();
});

appRouter.get("/", (req, res, next) => {
  const linksLinear: (Link & { linksToDomain: number })[] = db
    .prepare(
      "select *, count(domain) as linksToDomain from links where email=? group by domain order by linksToDomain desc, dateSaved desc"
    )
    .all(req.session!.email);
  console.log(JSON.stringify(linksLinear));

  const linkGroups: Map<string, Link[]> = new Map();
  linksLinear.forEach((link) => {
    const domain =
      link.linksToDomain >= minLinkGroupSize
        ? link.domain
        : "From around the Web";
    linkGroups.set(domain, [...(linkGroups.get(domain) ?? []), link]);
  });

  const linkGroupsToRender = Array.from(
    linkGroups.entries()
  ).map(([domain, links]) => ({ domain, links }));

  res.locals.render("app/home", {
    linkGroups: linkGroupsToRender,
  });
});

export default appRouter;
