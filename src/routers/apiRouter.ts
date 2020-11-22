import express from "express";
import mime from "mime";

import db from "../lib/db";
import * as linkAdder from "../lib/linkAdder";
import { User } from "../lib/types";

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

    await linkAdder.add(res.locals.email, req.body);

    res.json({ message: "Successfully added your link" });
  } catch (ex) {
    console.log(ex);
    res.status(500);
    res.json({ error: "Unknown error occurred" });
  }
});

export default apiRouter;
