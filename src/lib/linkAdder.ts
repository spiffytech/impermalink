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

async function getPageTitle(url: string): Promise<string> {
  try {
    // Timeout is arbitrary, just there to provide nominal mitigation against
    // slowloris-style attacks
    const response = await axios.get(url, { timeout: 30000 });
    if (mime.getExtension(response.headers["content-type"]) === "html") {
      const $ = cheerio.load(response.data);
      const titleTagText = $("title").text();
      return titleTagText ?? "Untitled";
    } else {
      return `Untitled ${mime.getExtension(response.headers["content-type"])}`;
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
  const title = await getPageTitle(url);

  const record: NewLink = {
    email,
    url,
    domain,
    title,
  };
  try {
    db.prepare(
      "insert into links (email, url, domain, title) values (?, ?, ?, ?)"
    ).run(...Object.values(record));
  } catch (ex) {
    console.error(ex);
    throw new Error("Error storing new link");
  }
}
