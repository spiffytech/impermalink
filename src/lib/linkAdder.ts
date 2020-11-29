import axios from "axios";
import cheerio from "cheerio";
import genericPool from "generic-pool";
import mime from "mime";
import playwright from "playwright";

import db from "../lib/db";
import { NewLink } from "../lib/types";

let browser: playwright.Browser | null = null;
export const pool = genericPool.createPool(
  {
    async create() {
      console.log("Creating Playwright");
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
        console.log("Closing Puppeteer");
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

async function getPageFields(
  url: string
): Promise<[string, string, string | null]> {
  try {
    // Timeout is arbitrary, just there to provide nominal mitigation against
    // slowloris-style attacks
    const response = await axios.get(url, { timeout: 30000 });
    const finalURL = response.request.res.responseUrl;
    const extension = mime.getExtension(response.headers["content-type"]);
    const maxFieldLength = 280;
    if (extension === "html") {
      const $ = cheerio.load(response.data);
      // Arbitrarily limit field size to the size of a tweet, just so we don't
      // get our DB spammed with some bonkers description
      const titleTagText = $("title").text().slice(0, maxFieldLength);
      const descriptionRaw = $('meta[name="description"]').attr("content");
      const description =
        (descriptionRaw &&
          (descriptionRaw?.length > maxFieldLength
            ? descriptionRaw?.slice(0, maxFieldLength) + "..."
            : descriptionRaw)) ||
        null;

      // Don't care if we're missing a description; lots of pages don't have //
      // descriptions. But if we don't have a title, maybe it's an SPA and we //
      // need to run client-side JS to get the title to appear. Twitter is this way.
      if (titleTagText) {
        return [finalURL, titleTagText, description];
      }

      const page = await pool.acquire();
      // networkidle because Twitter doesn't have anything loaded by the 'load' event
      await page.goto(url, { waitUntil: "networkidle" });

      const title = await page.title();
      const descriptionFromPlaywright =
        (await (await page.$('meta[name="description"]'))?.textContent()) ??
        null;
      const urlFromPlaywright = await page.url();
      await pool.destroy(page);

      return [urlFromPlaywright, title, descriptionFromPlaywright];
    } else if (
      // Handles YouTube embed links
      extension === "xml" &&
      (response.data as string).includes("<oembed>")
    ) {
      const title =
        cheerio.load(response.data)("title").text().slice(0, maxFieldLength) ||
        "Untitled XML file";
      return [finalURL, title, ""];
    } else {
      return [
        finalURL,
        `Untitled ${mime.getExtension(response.headers["content-type"])}`,
        null,
      ];
    }
  } catch (ex) {
    const error: Error & { details?: any } = new Error("Error fetching URL");
    if (ex.isAxiosError) {
      error.details = { fetchStatusCode: ex.response.status };
    } else {
      console.error(ex);
    }
    throw ex;
  }
}

export async function add(email: string, urlRaw: string) {
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
