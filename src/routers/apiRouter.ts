import axios from "axios";
import cheerio from "cheerio";
import express from "express";
import mime from "mime";

import db from "../lib/db";
import { NewLink, User } from "../lib/types";

const apiRouter = express.Router();
apiRouter.use((req, res, next) => {
  const user: User | undefined =
    req.query.token &&
    db.prepare("select * from users where apiKey=?").get(req.query.token);

  if (!user) {
    res.status(403);
    res.json({
      error:
        "You must include the 'token' query parameter containing your API token",
    });
    return void next();
  }

  res.locals.email = user.email;
  return void next();
});
apiRouter.post("/addLink", async (req, res) => {
  try {
    if (
      !req.headers["content-type"] ||
      mime.getExtension(req.headers["content-type"]) !== "txt"
    ) {
      res.status(400);
      return void res.json({
        error: "POST Content-Type must be 'text/plain'",
        received: req.headers["content-type"] ?? null,
      });
    }
    if (!req.body) {
      res.status(400);
      return void res.json({
        error: "Must supply a URL as the POST data body",
      });
    }

    let url: URL | null = null;
    try {
      url = new URL(req.body);
    } catch (ex) {
      res.status(400);
      return void res.send({ error: "URL could not be parsed" });
    }

    try {
      // Timeout is arbitrary, just there to provide nominal mitigation against
      // slowloris-style attacks
      const response = await axios.get(url.toString(), { timeout: 30000 });
      let title = "Untitled";
      if (mime.getExtension(response.headers["content-type"]) === "html") {
        const $ = cheerio.load(response.data);
        const titleTagText = $("title").text();
        if (titleTagText) title = titleTagText;
      } else {
        title = `Untitled ${mime.getExtension(
          response.headers["content-type"]
        )}`;
      }

      const record: NewLink = {
        email: res.locals.email,
        url: url.toString(),
        domain: url.hostname,
        title,
      };
      db.prepare(
        "insert into links (email, url, domain, title) values (?, ?, ?, ?)"
      ).run(...Object.values(record));

      res.send("success" + " " + title);
    } catch (ex) {
      if (ex.isAxiosError) {
        res.status(400);
        return void res.json({
          error: "Error fetching URL",
          fetchStatusCode: ex.response.status,
        });
      }
      console.log(ex);
      res.json({ error: "Unknown error occurred" });
    }
  } catch (ex) {
    console.log(ex);
    res.status(500);
    res.json({ error: "Unknown error occurred" });
  }
});

export default apiRouter;
