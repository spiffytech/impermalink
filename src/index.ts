import sourceMapSupport from "source-map-support";
sourceMapSupport.install();

import crypto from "crypto";
import path from "path";
import { promisify } from "util";

import axios from "axios";
import bodyParser from "body-parser";
import bsql from "better-sqlite3";
import cheerio from "cheerio";
import cookieSession from "cookie-session";
import dotenv from "dotenv";
import express from "express";
import mime from "mime";
import mustacheExpress from "mustache-express";
import Joi from "joi";

dotenv.config();

const validators = {
  email: Joi.string().required().email().label("Email"),
  password: Joi.string().required().min(8).label("Password"),
};

interface User {
  email: string;
  scrypt: string;
  salt: string;
  lastLogin: string;
  recycleBinSize: number;
  apiKey: string;
}

interface Link {
  id: number;
  email: string;
  domain: string | null;
  url: string;
  title: string | null;
  dateSaved: string;
  dateDeleted: string | null;
}
type NewLink = Omit<Link, "id" | "dateSaved" | "dateDeleted">;

const db = bsql(path.join(process.env.DATA_DIR ?? process.cwd(), "db.sqlite"));
const migrations: string[] = [
  `create table users (
        email text PRIMARY KEY not NULL,
        scrypt text not NULL,
        salt text not NULL,
        lastLogin text not NULL,
        recycleBinSize integer default 1,
        apiKey text not null
      );
  create table links (
        id integer primary key,
        email text not null,
        domain text,
        url text not null,
        title text,
        dateSaved text not NULL DEFAULT (datetime('now', 'localtime')),
        dateDeleted text
      )`,
];
db.transaction(() => {
  const [{ user_version: schemaVersion }] = db.pragma("user_version");
  migrations.slice(schemaVersion).map((migration) => db.exec(migration));
  db.pragma(`user_version = ${migrations.length}`);
})();

if (!process.env.SESSION_KEY) {
  throw new Error("Must provide SESSION_KEY environment variable");
}

const app = express();
app.use(
  cookieSession({
    name: "impermalink-session",
    keys: [process.env.SESSION_KEY],
    expires: new Date(new Date().getTime() + 1000 * 86400 * 365.25),
    sameSite: "strict",
    httpOnly: true,
  })
);
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.text());
app.set("views", path.join(__dirname, "templates"));
app.set("view engine", "mustache.html");
app.engine(
  "mustache.html",
  mustacheExpress(path.join(__dirname, "templates", "partials"))
);

const port = parseInt(process.env.PORT ?? "3000");

const appRouter = express.Router();
appRouter.use((req, res, next) => {
  if (req.session?.email) {
    res.locals.render = (view: string, options?: object) => {
      res.render(view, { userEmail: req.session!.email, ...options });
    };
    return void next();
  }
  res.redirect(307, "/login");
  next();
});
appRouter.get("/", (req, res, next) => {
  const links: Link[] = db
    .prepare(
      "select * from links where email=? group by domain order by dateSaved desc"
    )
    .all(req.session!.email);
  console.log(JSON.stringify(links));

  res.locals.render("app/home");
});

app.use("/app", appRouter);

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
app.use("/api", apiRouter);

const publicRouter = express.Router();
publicRouter.use((req, res, next) => {
  res.locals.render = (view: string, options?: object) => {
    res.render(view, {
      isOutsideApp: true,
      userEmail: req.session?.email,
      ...options,
    });
  };
  return void next();
});

publicRouter.get("/manifest.json", (_req, res) => {
  res.json({
    name: "Impermalink",
    short_name: "Impermalink",
    lang: "en-US",
    start_url: "/app",
    display: "browser",
    share_target: {
      action: "/app/share-target/",
      method: "POST",
      enctype: "application/x-www-form-encoded",
      params: {
        title: "title",
        text: "text",
        url: "url",
      },
    },
  });
});

publicRouter.get("/login", (req, res, next) => {
  try {
    if (req.session?.email) {
      res.redirect(307, "/app");
      return;
    }

    res.locals.render("login");
  } catch (ex) {
    return void next(ex);
  }
});
publicRouter.post("/login", async (req, res, next) => {
  const { email, password } = req.body;
  try {
    Joi.assert(
      { email, password },
      Joi.object({
        email: validators.email,
        password: validators.password,
      })
    );

    const existingUser: User | undefined = db
      .prepare("select * from users where email=?")
      .get(email);
    if (!existingUser) {
      throw new Error("You can't get in with those credentials");
    }

    // Who knows why TS is infering this return value as 'unknown'
    const hashBuffer = (await promisify(crypto.scrypt)(
      password,
      existingUser.salt,
      256 / 8
    )) as Buffer;
    const credentialsMatch = crypto.timingSafeEqual(
      Buffer.from(existingUser.scrypt, "hex"),
      hashBuffer
    );
    if (!credentialsMatch) {
      throw new Error("You can't get in with those credentials");
    }

    db.prepare(
      "update users set lastLogin=datetime('now', 'localtime') where email=?"
    ).run(existingUser.email);

    req.session!.email = email;
    res.redirect(302, "/app");
  } catch (ex) {
    res.status(400);
    console.log(JSON.stringify(ex.details));
    res.locals.render("login", {
      formErrors: ex.details ?? [{ message: ex.message }],
      email,
    });
    next();
  }
});

publicRouter.get("/signup", (req, res, next) => {
  try {
    if (req.session?.email) {
      res.redirect(307, "/app");
      return;
    }

    res.locals.render("signup");
  } catch (ex) {
    return void next(ex);
  }
});
publicRouter.post("/signup", async (req, res, next) => {
  const { email, password, password_again } = req.body;
  try {
    Joi.assert(
      { email, password, password_again },
      Joi.object({
        email: validators.email,
        password: validators.password,
        password_again: Joi.string()
          .required()
          .valid(Joi.ref("password"))
          .messages({
            "any.only": "You've gotta type the same password both times",
          }),
      })
    );

    const { "count(*)": existingUsersWithSameEmail } = db
      .prepare("select count(*) from users where email=?")
      .get(email);
    if (existingUsersWithSameEmail !== 0) {
      throw new Error("That email address was not accepted");
    }

    const salt = crypto.randomBytes(256 / 8).toString("hex");
    // Who knows why TS is infering this return value as 'unknown'
    const hashBuffer = (await promisify(crypto.scrypt)(
      password,
      salt,
      256 / 8
    )) as Buffer;
    const apiKey = crypto.randomBytes(256 / 8).toString("hex");
    const stmt = db.prepare(
      "insert into users (email, scrypt, salt, apiKey, lastLogin) values (?, ?, ?, ?, datetime('now', 'localtime'))"
    );
    stmt.run(email, hashBuffer.toString("hex"), salt, apiKey);

    req.session!.email = email;
    res.redirect(302, "/app");
  } catch (ex) {
    res.status(400);
    console.log(JSON.stringify(ex.details));
    res.locals.render("signup", {
      formErrors: ex.details ?? [{ message: ex.message }],
      email,
    });
    next();
  }
});

publicRouter.post("/logout", (req, res) => {
  req.session = null;
  res.redirect(301, "/");
});

publicRouter.get("/", async (_req, res, next) => {
  try {
    res.locals.render("index");
  } catch (ex) {
    return void next(ex);
  }
});

app.use(publicRouter);

app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
