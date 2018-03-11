'use strict';

const Joi = require('joi');

const updateDeliveryType = Joi.object()
  .keys({
    id: Joi.number().integer().min(1).required(),
    label: Joi.string().required(),
    additionalCost: Joi.number().positive().required(),
    additionalCostTax: Joi.number().positive().min(Joi.ref('additionalCost')).required(),
  })
  .options({ stripUnknown: true });

module.exports = {
  updateDeliveryType,
};
