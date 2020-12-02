import * as crypto from "crypto";
import { promisify } from "util";

import type { Request, Response } from "express";
import Joi from "joi";

import db from "./_lib/db";
import validators from "./_lib/validators";

export async function post(req: Request, res: Response) {
  const { email, password, passwordAgain } = req.body;
  try {
    Joi.assert(
      { email, password, passwordAgain },
      Joi.object({
        email: validators.email,
        password: validators.password,
        passwordAgain: Joi.string()
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
    console.error(ex);
    res.status(400);
    res.locals.render("signup", {
      formErrors: ex.details ?? [{ message: ex.message }],
      email,
    });
  }
}
