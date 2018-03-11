'use strict';

const handlers = require('./handlers');
const validate = require('./validate');

module.exports = [
  {
    method: 'GET',
    path: '/promo-codes/{code}/validate',
    handler: handlers.validatePromoCode,
    config: {
      validate: {
        params: {
          code: validate.code,
        },
      },
    },
  },
  {
    method: 'GET',
    path: '/promotional-codes',
    handler: handlers.getAllPromoCode,
  },
  {
    method: 'GET',
    path: '/promotional-codes/types',
    handler: handlers.getAllPromoCodeType,
  },
  {
    method: 'POST',
    path: '/promotional-codes',
    handler: handlers.createPromoCode,
    config: {
      validate: {
        payload: validate.createPromoCode,
      },
    },
  },
];
