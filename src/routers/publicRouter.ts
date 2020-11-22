import crypto from "crypto";
import { promisify } from "util";

import express from "express";
import Joi from "joi";

import db from "../lib/db";
import { User } from "../lib/types";
import validators from "../lib/validators";

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

export default publicRouter;
