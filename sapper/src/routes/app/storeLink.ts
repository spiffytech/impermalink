import cheerio from "cheerio";
import genericPool from "generic-pool";
import mime from "mime";
import playwright from "playwright";

import type { Request, Response } from "express";
import type { Page } from "playwright";

import db from "../_lib/db";
import type { NewLink } from "../_lib/types";

let browser: playwright.Browser | null = null;
const pool = genericPool.createPool(
  {
    async create() {
      browser =
        browser ??
        (await playwright.chromium.launch({
          // Don't let Playwright handle the signals, or the pool shutdown will
          // error out trying to clean up its resources.
          handleSIGHUP: false,
          handleSIGINT: false,
          handleSIGTERM: false,
        }));
      return (await browser.newContext()).newPage();
    },
    async destroy(page: playwright.Page) {
      try {
        await page.context().close();

        // Since we set the pool to always have a resource, zero open pages means
        // we're draining the pool and need to clean up
        if (pool.size === 0) {
          await browser?.close();
          browser = null;
        }
      } catch (ex) {
        console.error(ex);
      }
    },
  },
  {
    min: 1,
    max: 5,
    idleTimeoutMillis: 10000,
  }
);

export async function terminatePool() {
  await pool.drain();
  await pool.clear();
}

function truncate(maxLength: number, str: string): string;
function truncate(maxLength: number, str: string | null): string | null;
function truncate(maxLength: number, str: string | null): string | null {
  if (!str) return str;
  if (str.length > maxLength - 3) {
    return str.slice(0, maxLength) + "...";
  }
  return str;
}

async function getPageFields(
  url: string
): Promise<[string, string, string | null]> {
  let page: Page | null = null;
  try {
    const maxFieldLength = 280;
    // Timeout is arbitrary, just there to provide nominal mitigation against
    // slowloris-style attacks
    page = await pool.acquire();
    // Timeout is arbitrary, just there to provide nominal mitigation against
    // slowloris-style attacks. Apply networkidle because Twitter doesn't have anything loaded by the 'load' event
    const request = await page.goto(url, {
      waitUntil: "networkidle",
      timeout: 30000,
    });
    const contentType = request?.headers()?.["content-type"];
    const fileExtension = contentType && mime.getExtension(contentType);
    const urlFromPlaywright = await page.url();

    if (fileExtension === "html") {
      const title = await page.title();
      const descriptionFromPlaywright =
        (await (await page.$('meta[name="description"]'))?.textContent()) ??
        null;
      return [
        urlFromPlaywright,
        truncate(maxFieldLength, title),
        truncate(maxFieldLength, descriptionFromPlaywright),
      ];
    } else if (
      // Handles YouTube embed links
      fileExtension === "xml"
    ) {
      const content = await page.content();
      if (!content.includes("<oembed>"))
        return [urlFromPlaywright, "Untitled XML", ""];
      const titleRaw = cheerio.load(content)("title").text();
      const title = titleRaw
        ? truncate(maxFieldLength, titleRaw)
        : "Untitled XML file";
      return [urlFromPlaywright, title, ""];
    } else {
      return [urlFromPlaywright, `Untitled ${fileExtension}`, null];
    }
  } catch (ex) {
    const error: Error & { details?: any } = new Error("Error fetching URL");
    if (ex.isAxiosError) {
      error.details = { fetchStatusCode: ex.response.status };
    } else {
      console.error(ex);
    }
    throw ex;
  } finally {
    page && (await pool.destroy(page));
  }
}

async function add(email: string, urlRaw: string) {
  const [url, title, description] = await getPageFields(urlRaw);

  // I don't like putting this check _after_ the URL fetch, but I also don't
  // want to store both the original + finalized URLs. And that'd still be
  // abusable with minimal URL manipulation anyway, so it'd just prevent
  // accidental duplications.
  const alreadyHaveLink = db
    .prepare("select 1 from links where email=? and url=?")
    .get(email, url);
  if (alreadyHaveLink) return;

  const record: NewLink = {
    email,
    url,
    domain: new URL(url).hostname,
    title,
    description,
  };
  try {
    db.prepare(
      "insert into links (email, url, domain, title, description) values (?, ?, ?, ?, ?)"
    ).run(...Object.values(record));
  } catch (ex) {
    console.error(ex);
    throw new Error("Error storing new link");
  }
}

export async function post(req: Request, res: Response) {
  try {
    const email = res.locals.email;
    let url: string | null = null;
    if (typeof req.body === "string") {
      url = req.body;
    } else if (req.body.text) {
      url = req.body.text;
    } else {
      res.status(400);
      res.send("It doesn't look like you passed us a URL");
      return;
    }

    // We don't want the user to sit here staring at the loading screen while we
    // fetch
    const addP = add(email, url!);

    if (req.query.source === "share-target") {
      res.redirect(302, "/app/storeLink");
    } else {
      await addP;
      res.send();
    }
  } catch (ex) {
    console.error(ex);
    res.status(500);
    res.send();
  }
}
