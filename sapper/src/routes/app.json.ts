import type { Request, Response, NextFunction } from "express";

import db from "./_lib/db";
import type { Link, LinkGroup } from "./_lib/types";

const minLinkGroupSize = process.env.GROUP_SIZE ?? 2;

export async function get(req: Request, res: Response, next: NextFunction) {
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

  const linkGroupsSerializable: LinkGroup[] = Array.from(
    linkGroups.entries()
  ).map(([domain, links]) => ({ domain, links }));

  res.json({ linkGroups: linkGroupsSerializable });
}
