'use strict';

const handlers = require('./handlers');
const validate = require('./validate');
const utilsValidate = require('~/utils/validate');

module.exports = [
  {
    method: 'GET',
    path: '/product-categories/available',
    handler: handlers.getCategoriesAvailable,
    config: {
      auth: false,
    },
  },
  {
    method: 'GET',
    path: '/product-categories',
    handler: handlers.getCategories,
  },
  {
    method: 'GET',
    path: '/product-categories/{catId}',
    handler: handlers.getCategory,
    config: {
      validate: {
        params: { catId: utilsValidate.id },
      },
    },
  },
  {
    method: 'POST',
    path: '/product-categories',
    handler: handlers.createCategory,
    config: {
      validate: {
        payload: validate.createCategory,
      },
    },
  },
  {
    method: 'PUT',
    path: '/product-categories/{catId}',
    handler: handlers.updateCategory,
    config: {
      validate: {
        params: { catId: utilsValidate.id },
        payload: validate.modifyCategory,
      },
    },
  },
  {
    method: 'DELETE',
    path: '/product-categories/{catId}',
    handler: handlers.deleteCategory,
    config: {
      validate: {
        params: { catId: utilsValidate.id },
      },
    },
  },
];
