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
    error,
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

appRouter.get("/", (req, res) => renderLinkList(req, res));

export default appRouter;
