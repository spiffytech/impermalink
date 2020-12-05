const colorThief = require("colorthief");
const twColors: Record<
  string,
  string | Record<string, string>
> = require("tailwindcss/colors");
import genericPool from "generic-pool";
import mime from "mime";
import playwright from "playwright";

import type { Request, Response } from "express";
import type { Page } from "playwright";

import db from "../_lib/db";
import type { NewLink } from "../_lib/types";

// Derived from https://stackoverflow.com/questions/5623838/rgb-to-hex-and-hex-to-rgb
function hexToRgb(hex: string) {
  // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
  var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  hex = hex.replace(shorthandRegex, function (_m, r, g, b) {
    return r + r + g + g + b + b;
  });

  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16),
      ]
    : null;
}

const tailwindRgbColors50 = Object.values(twColors)
  .flatMap((palette) => {
    if (typeof palette === "string") {
      // Black/white are gravity wells, pulling in matches from better colors
      if (palette.toLowerCase() === "#fff" || palette.toLowerCase() === "#000")
        return null;
      return palette;
    } else return palette["400"];
  })
  .filter((val): val is string => Boolean(val));

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

async function parseColorsForImage(
  imgUrl: string
): Promise<{
  faviconColor: [number, number, number];
  faviconTailwindColor: string;
} | null> {
  try {
    const faviconColor: [number, number, number] = await colorThief.getColor(
      imgUrl
    );
    const faviconTailwindColor = tailwindRgbColors50
      .map((twColor) => {
        const twRgb = hexToRgb(twColor)!;
        return [
          twColor,
          Math.pow((twRgb[0] - faviconColor[0]) * 0.3, 2) +
            Math.pow((twRgb[1] - faviconColor[1]) * 0.59, 2) +
            Math.pow((twRgb[2] - faviconColor[2]) * 0.11, 2),
        ] as [string, number];
      })
      .sort((a, b) => (a[1] < b[1] ? -1 : 1))[0][0];

    return { faviconColor, faviconTailwindColor };
  } catch {
    return null;
  }
}

async function getPageFields(
  url: string
): Promise<{
  url: string;
  title: string;
  description: string | null;
  favicon: string | null;
  faviconColor: [number, number, number] | null;
  faviconTailwindColor: string | null;
}> {
  let page: Page | null = null;
  try {
    const maxFieldLength = 280;
    // Timeout is arbitrary, just there to provide nominal mitigation against
    // slowloris-style attacks
    page = await pool.acquire();

    // YouTube links shared from places like Reddit are shared in oembed format,
    // which we don't process correctly. Special-case their links to extract a
    // useful URL.
    const urlParts = new URL(url);
    const queryParamUrl = urlParts.searchParams.get("url")!;
    if (urlParts.hostname.endsWith("youtube.com") && queryParamUrl) {
      try {
        const embeddedUrlParts = new URL(queryParamUrl);
        if (
          embeddedUrlParts.hostname.endsWith("youtube.com") &&
          embeddedUrlParts.pathname.startsWith("/watch") &&
          embeddedUrlParts.searchParams.has("v")
        ) {
          url = queryParamUrl;
        }
      } catch (ex) {}
    }

    // Timeout is arbitrary, just there to provide nominal mitigation against
    // slowloris-style attacks. Apply networkidle because Twitter doesn't have anything loaded by the 'load' event
    const request = await page.goto(url, {
      waitUntil: "networkidle",
      timeout: 60000,
    });
    const contentType = request?.headers()?.["content-type"];
    const fileExtension = contentType && mime.getExtension(contentType);
    const urlFromPlaywright = await page.url();

    if (fileExtension === "html") {
      const title = await page.title();
      const descriptionFromPlaywright =
        (await (await page.$('meta[name="description"]'))?.getAttribute(
          "content"
        )) ?? null;

      const faviconPath =
        (await (await page.$('link[rel="icon"]'))?.getAttribute("href")) ??
        null;

      const favicon = faviconPath && new URL(faviconPath, url).toString();

      const { faviconColor = null, faviconTailwindColor = null } =
        ((favicon && (await parseColorsForImage(favicon))) || {}) ?? {};

      return {
        url: urlFromPlaywright,
        title: truncate(maxFieldLength, title),
        description: truncate(maxFieldLength, descriptionFromPlaywright),
        favicon,
        faviconColor,
        faviconTailwindColor,
      };
    } else {
      return {
        url: urlFromPlaywright,
        title: `Untitled ${fileExtension}`,
        description: null,
        favicon: null,
        faviconColor: null,
        faviconTailwindColor: null,
      };
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
  const {
    url,
    title,
    description,
    favicon,
    faviconColor,
    faviconTailwindColor,
  } = await getPageFields(urlRaw);

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
    body: null,
    favicon,
    faviconColor: JSON.stringify(faviconColor),
    faviconTailwindColor: faviconTailwindColor,
  };
  try {
    db.prepare(
      "insert into links (email, url, domain, title, description, body, favicon, faviconColor, faviconTailwindColor) values (?, ?, ?, ?, ?, ?, ?, ?, ?)"
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
