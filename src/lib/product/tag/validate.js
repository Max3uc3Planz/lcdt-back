'use strict';

const Joi = require('joi');

exports.newTag = Joi.object().keys({
  label: Joi.string().required(),
});

exports.tag = Joi.object().keys({
  label: Joi.string().required(),
}).options({ stripUnknown: true });
