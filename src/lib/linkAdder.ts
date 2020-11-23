import axios from "axios";
import cheerio from "cheerio";
import mime from "mime";

import db from "../lib/db";
import { NewLink } from "../lib/types";

function parseUrl(urlRaw: string): [string, string] {
  try {
    const url = new URL(urlRaw);
    // Return stringified URL so we know it's a nice standardized (sanitized?) string
    return [url.toString(), url.hostname];
  } catch (ex) {
    throw new Error("URL could not be parsed");
  }
}

async function getPageFields(url: string): Promise<[string, string | null]> {
  try {
    // Timeout is arbitrary, just there to provide nominal mitigation against
    // slowloris-style attacks
    const response = await axios.get(url, { timeout: 30000 });
    if (mime.getExtension(response.headers["content-type"]) === "html") {
      const $ = cheerio.load(response.data);
      // Arbitrarily limit field size to the size of a tweet, just so we don't
      // get our DB spammed with some bonkers description
      const maxFieldLength = 280;
      const titleTagText = $("title").text().slice(0, maxFieldLength);
      const title = titleTagText || "Untitled";
      const description =
        $('meta[name="description"]')
          .attr("content")
          ?.slice(0, maxFieldLength) || null;
      return [title, description];
    } else {
      return [
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
  const [url, domain] = parseUrl(urlRaw);

  const alreadyHaveLink = db
    .prepare("select 1 from links where email=? and url=?")
    .get(email, url);
  if (alreadyHaveLink) return;

  const [title, description] = await getPageFields(url);

  const record: NewLink = {
    email,
    url,
    domain,
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
