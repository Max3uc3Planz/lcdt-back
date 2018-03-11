'use strict';

const handlers = require('./handlers');
const validate = require('./validate');
const { id } = require('~/utils/validate.js');


module.exports = [
  {
    method: 'GET',
    path: '/users/{userId}/addresses',
    handler: handlers.getAdresses,
    config: {
      validate: {
        params: {
          userId: id,
        },
      },
    },
  },
  {
    method: 'POST',
    path: '/users/{userId}/addresses',
    handler: handlers.createAddress,
    config: {
      validate: {
        payload: validate.newAddress,
        params: {
          userId: id,
        },
      },
    },
  },
  {
    method: 'PUT',
    path: '/users/{userId}/addresses/{addressId}',
    handler: handlers.updateAddress,
    config: {
      validate: {
        payload: validate.address,
        params: {
          userId: id,
          addressId: id,
        },
      },
    },
  },
  {
    method: 'DELETE',
    path: '/users/{userId}/addresses/{addressId}',
    handler: handlers.deleteAddress,
    config: {
      validate: {
        params: {
          userId: id,
          addressId: id,
        },
      },
    },
  },
  {
    method: 'POST',
    path: '/users/validate-address',
    handler: handlers.validateAddress,
    config: {
      auth: false,
      validate: {
        payload: validate.validateAddress,
      },
    },
  },
];
