const Joi = require('joi');

exports.createCategory = Joi.object().keys({
  label: Joi.string().required(),
  description: Joi.string(),
  products: Joi.array().items(Joi.number().min(1)),
}).options({ stripUnknown: true });

exports.modifyCategory = Joi.object().keys({
  id: Joi.number().min(1).required(),
  label: Joi.string().required(),
  description: Joi.string(),
  products: Joi.array().items(Joi.number().min(1)),
}).options({ stripUnknown: true });
