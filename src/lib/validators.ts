import Joi from "joi";

export default {
  email: Joi.string().required().email().label("Email"),
  password: Joi.string().required().min(8).label("Password"),
  url: Joi.string()
    .required()
    .uri({ scheme: ["http", "https"], domain: {} }),
};
