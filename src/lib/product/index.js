'use strict';

const handlers = require('./handlers');
const validateUtils = require('~/utils/validate');
const config = require('~/config');
const tagRoutes = require('./tag');
const catRoutes = require('./category');
const optionRoutes = require('./option');
const validate = require('./validate');

//const imgFolder = config.get('/publicImgFolder');

exports.register = (server, options, next) => {
  server.route([
    ...tagRoutes,
    ...catRoutes,
    ...optionRoutes,
    {
      method: 'GET',
      path: '/products',
      handler: handlers.getProducts,
    },
    {
      method: 'GET',
      path: '/products/available',
      handler: handlers.getAvailableProducts,
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/products/{productId}',
      handler: handlers.getProduct,
      config: {
        auth: false,
        validate: {
          params: {
            productId: validateUtils.id,
          },
        },
      },
    },
    {
      method: 'GET',
      path: '/products/{productId}/detail',
      handler: handlers.getProductDetail,
      config: {
        validate: {
          params: {
            productId: validateUtils.id,
          },
        },
      },
    },
    {
      method: 'POST',
      path: '/products',
      handler: handlers.addProduct,
      config: {
        payload: {
          parse: true,
          output: 'stream',
          allow: ['multipart/form-data', 'image/png'],
        },
      },
    },
    {
      method: 'PUT',
      path: '/products/{productId}',
      handler: handlers.updateProduct,
      config: {
        validate: {
          params: {
            productId: validateUtils.id,
          },
        },
        payload: {
          parse: true,
          output: 'stream',
          allow: ['multipart/form-data', 'image/png'],
        },
      },
    },
    {
      method: 'DELETE',
      path: '/products/{productId}',
      handler: handlers.deleteProduct,
      config: {
        validate: {
          params: {
            productId: validateUtils.id,
          },
        },
      },
    },
    {
      method: 'GET',
      path: `/${imgFolder}/products/{productId}/{fileName}`,
      handler: { file: handlers.serveProductImg },
      config: {
        auth: false,
        validate: {
          params: {
            productId: validateUtils.id,
            fileName: validateUtils.fileName,
          },
        },
      },
    },
    {
      method: 'GET',
      path: '/products/stock',
      handler: handlers.getProductsStocks,
      config: {
        validate: {
          query: validate.productsQuery,
        },
      },
    },
    {
      method: 'GET',
      path: '/products/{productId}/stock',
      handler: handlers.getProductStocks,
      config: {
        validate: {
          params: {
            productId: validateUtils.id,
          },
        },
      },
    },
    {
      method: 'PUT',
      path: '/products/stock',
      handler: handlers.updateProductsStocks,
      config: {
        validate: {
          payload: validate.productsStocks,
        },
      },
    },
    {
      method: 'PUT',
      path: '/products/{productId}/stock',
      handler: handlers.updateProductStocks,
      config: {
        validate: {
          payload: validate.productStocks,
        },
      },
    },
  ]);

  next();
};

exports.register.attributes = {
  name: 'ProductPlugin',
  version: '1.0.0',
};
