'use strict';

const Joi = require('joi');

const phone = Joi.string().regex(/^(0|\+33)[1-9]([-. ]?[0-9]{2}){4}$/, 'Numéro Français').required();

exports.newPhone = Joi.object().keys({
  phone,
});

exports.phone = Joi.object().keys({
  phone,
  isMain: Joi.boolean(),
}).options({ stripUnknown: true });

exports.phoneOnly = phone;
