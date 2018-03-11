'use strict';

const Joi = require('joi');
const { newAddress } = require('~/lib/user/address/validate');

const orderItem = Joi.object()
  .keys({
    productId: Joi.number().integer().min(1).required(),
    qty: Joi.number().integer().min(1).required(),
  })
  .options({ stripUnknown: true });

exports.newOrder = Joi.object()
  .keys({
    paymentMethod: Joi.string().required(),
    discountCode: Joi.string(),
    weekDay: Joi.number().integer().min(0).max(6),
    deliveryType: Joi.number().integer().min(1).required(),
    timeMin: Joi.number().integer().min(0).max(2359).required(),
    timeMax: Joi.number().integer().min(0).max(2359).required(),
    address: newAddress,
    addressId: Joi.number().integer().min(1),
    telephone: Joi.number().integer().min(1).required(),
    items: Joi.array().items(orderItem).min(1).required(),
    promoCode: Joi.string().alphanum(),
    sponsorshipCode: Joi.string().alphanum(),
  })
  .xor('address', 'addressId')
  .nand('promoCode', 'sponsorshipCode')
  .options({ stripUnknown: true });

exports.historyQuery = Joi.object()
  .keys({
    page: Joi.number().min(1).required(),
    start: Joi.date().iso(),
    end: Joi.date().iso().min(Joi.ref('start', { default: '2017-01-01 00:00:00.000+02' })),
  })
  .options({ stripUnknown: true });

exports.status = Joi.object()
  .keys({
    newStatus: Joi.number().integer().min(1).required(),
  })
  .options({ stripUnknown: true });
