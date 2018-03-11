'use strict';

const Joi = require('joi');

exports.code = Joi.string().alphanum();

exports.createPromoCode = Joi.object()
  .keys({
    code: Joi.string().required(),
    amount: Joi.number().positive(),
    amountTax: Joi.number().positive(),
    amountPercentage: Joi.number().positive(),
    usageLimit: Joi.number().positive(),
    expirationDate: Joi.date(),
    firstOrderOnly: Joi.boolean().required(),
    typeId: Joi.number().positive().required(),
  })
  .and('amount', 'amountTax')
  .xor('amountTax', 'amountPercentage')
  .options({ stripUnknown: true });
