import * as crypto from "crypto";
import { promisify } from "util";

import Joi from "joi";

import type { Request, Response, NextFunction } from "express";

import db from "./_lib/db";
import validators from "./_lib/validators";

import type { User } from "./_lib/types";

export async function logIn(email: string, password: string) {
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
}

export async function post(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body;
    await logIn(email, password);
    req.session!.email = email;
    // This will let us wipe existing sessions in the future
    req.session!.sessionStart = new Date().toISOString();
    res.send();
  } catch (ex) {
    console.log(JSON.stringify(ex.details));
    res.status(400);
    res.json({
      errors: ex.details ?? [{ message: ex.message }],
    });
  }
}
