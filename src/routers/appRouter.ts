import express, { Request, Response, NextFunction } from "express";
import Joi from "joi";

import db from "../lib/db";
import * as linkAdder from "../lib/linkAdder";
import { Link } from "../lib/types";
import validators from "../lib/validators";

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

  res.locals.email = req.session.email;

  return void next();
});

async function renderLinkList(req: Request, res: Response, error?: string) {
  const countsByDomain = new Map<string, number>(
    Array.from(
      db
        .prepare(
          "select domain, count(domain) as numLinks from links where email=? group by domain"
        )
        .all(res.locals.email)
        .map(({ domain, numLinks }) => [domain, numLinks])
    )
  );
  const linksLinear: (Link & { linksToDomain: number })[] = db
    .prepare("select * from links where email=? order by dateSaved desc")
    .all(res.locals.email);

  const linkGroups: Map<string, Link[]> = new Map();
  linksLinear.forEach((link) => {
    const domain =
      countsByDomain.get(link.domain)! >= minLinkGroupSize
        ? link.domain
        : "From around the Web";
    linkGroups.set(domain, [...(linkGroups.get(domain) ?? []), link]);
  });

  const linkGroupsToRender = Array.from(
    linkGroups.entries()
  ).map(([domain, links]) => ({ domain, links }));

  res.locals.render("app/home", {
    linkGroups: linkGroupsToRender,
    error,
    htmx: Boolean(req.headers["hx-request"]),
  });
}

appRouter.post("/addLink", async (req, res) => {
  const { newLink } = req.body;

  try {
    Joi.assert(newLink, validators.url);
  } catch {
    res.status(400);
    return renderLinkList(
      req,
      res,
      "Link's gotta actually be a link to a real place"
    );
  }

  try {
    await linkAdder.add(res.locals.email, newLink);
    res.redirect(302, "/app");
  } catch (ex) {
    console.error(ex);
    return renderLinkList(
      req,
      res,
      "An unknown error occurred trying to save your link"
    );
  }
});

appRouter.post("/moveLinkToRecycleBin", (req, res) => {
  if (!req.query.linkId) {
    return void res.redirect(302, req.headers["referer"] || "/app");
  }
  // Don't update the deletion date if it's already set. UI shouldn't allow
  // this, but you never know. If we want to reset a deletion date, we'll create
  // a dedicated endpoint to do that.
  db.prepare(
    "update links set dateDeleted=datetime('now', 'localtime') where id=? and email=? and dateDeleted is null"
  ).run(req.query.linkId, res.locals.email);

  db.prepare(
    "delete from links where email=? and dateDeleted is not null and id not in (select id from links where email=? and dateDeleted is not null order by dateDeleted desc limit ?)"
  ).run(res.locals.email, res.locals.email, 1);

  return void res.redirect(302, req.headers["referer"] || "/app");
});

appRouter.post("/undeleteLink", (req, res) => {
  if (!req.query.linkId) {
    return void res.redirect(302, req.headers["referer"] || "/app");
  }
  db.prepare("update links set dateDeleted=null where id=? and email=?").run(
    req.query.linkId,
    res.locals.email
  );

  return void res.redirect(302, req.headers["referer"] || "/app");
});

appRouter.post("/emptyRecycleBin", (req, res) => {
  db.prepare("delete from links where email=? and dateDeleted is not null").run(
    res.locals.email
  );
});

appRouter.get("/", (req, res) => renderLinkList(req, res));

export default appRouter;
