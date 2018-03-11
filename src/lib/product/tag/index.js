'use strict';

const validateUtils = require('~/utils/validate');
const handlers = require('./handlers');
const config = require('~/config');

const imgFolder = config.get('/publicImgFolder');

module.exports = [
  {
    method: 'GET',
    path: '/tags',
    handler: handlers.getAllTags,
  },
  {
    method: 'GET',
    path: '/tags/{tagId}/detail',
    handler: handlers.getTagDetail,
    config: {
      validate: {
        params: {
          tagId: validateUtils.id,
        },
      },
    },
  },
  {
    method: 'GET',
    path: `/${imgFolder}/tags/{tagId}/{fileName}`,
    handler: { file: handlers.serveTagImg },
    config: {
      auth: false,
      validate: {
        params: {
          tagId: validateUtils.id,
          fileName: validateUtils.fileName,
        },
      },
    },
  },
  {
    method: 'POST',
    path: '/tags',
    handler: handlers.addTag,
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
    path: '/tags/{tagId}',
    handler: handlers.updateTag,
    config: {
      validate: {
        params: {
          tagId: validateUtils.id,
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
    path: '/tags/{tagId}',
    handler: handlers.deleteTag,
    config: {
      validate: {
        params: { tagId: validateUtils.id },
      },
    },
  },
];
