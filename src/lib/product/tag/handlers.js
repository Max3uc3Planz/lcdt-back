'use strict';

const Boom = require('boom');
const Joi = require('joi');

const config = require('~/config');
const validate = require('./validate');
const mediaUtils = require('~/utils/media');

module.exports = {
  getAllTags,
  getTagDetail,
  serveTagImg,
  addTag,
  updateTag,
  deleteTag,
};

function getAllTags(request, reply) {
  const db = request.getDb();
  const { Tag, UserRole } = db.getModels();
  const { roleId } = request.auth.credentials;

  if (roleId !== UserRole.ROLE_ADMIN) {
    return reply(Boom.forbidden(`Vous n'avez pas le droit d'accéder à cette ressource !`));
  }

  const promise = Tag.findAll({
    attributes: ['id', 'label', 'iconUrl'],
  }).catch(err => {
    throw Boom.boomify(err);
  });

  return reply(promise);
}

function getTagDetail(request, reply) {
  const db = request.getDb();
  const { roleId } = request.auth.credentials;
  const { Tag, UserRole } = db.getModels();

  const tagId = request.params.tagId;

  if (roleId !== UserRole.ROLE_ADMIN) {
    return reply(Boom.forbidden(`Vous n'avez pas le droit d'accéder au détail de ce mot-clef !`));
  }

  const promise = Tag.findOne({
    where: { id: tagId },
  })
    .then(tag => {
      if (!tag) {
        throw Boom.notFound(`Le mot-clef demandé n'existe pas. Id : ${tagId}`);
      }

      return tag;
    })
    .catch(err => {
      throw Boom.boomify(err);
    });

  return reply(promise);
}

function serveTagImg(request) {
  const { tagId, fileName } = request.params;

  return `${config.get('/publicImgFolder')}/tags/${tagId}/${fileName}`;
}

function addTag(request, reply) {
  const db = request.getDb();
  const sequelize = db.sequelize;
  const { roleId } = request.auth.credentials;
  const { Tag, UserRole } = db.getModels();

  if (roleId !== UserRole.ROLE_ADMIN) {
    return reply(Boom.forbidden(`Vous n'avez pas le droit d'ajouter un mot-clef !`));
  }

  let tagData = null;

  try {
    tagData = JSON.parse(request.payload.tagData);
  } catch (e) {
    return reply(Boom.badRequest(`Données du mot-clef erronées envoyées.`));
  }

  const picUpload = request.payload.file;
  const validationResult = Joi.validate(tagData, validate.newTag);

  // Joi validation of the payload because we sent the data as form-data and not JSON.
  if (validationResult.error !== null) {
    return reply(Boom.badData(validationResult.error));
  }

  tagData = validationResult.value;

  const promise = sequelize
    .transaction(transaction => {
      const innerPromise = Tag.create(tagData, { transaction })
        .then(tag => {
          tagData.id = tag.id;

          if (picUpload) {
            return mediaUtils.createImage(picUpload, `tags/${tag.id}`).then(imgPath => {
              tagData.iconUrl = imgPath;
              return imgPath;
            });
          }

          return null;
        })
        .then(pImg => {
          if (picUpload && !pImg) {
            throw Boom.notFound(`Impossible d'enregistrer l'icône du mot-clef`);
          }

          return Tag.update(
            { iconUrl: tagData.iconUrl },
            { where: { id: tagData.id }, transaction }
          );
        })
        .then(() => Tag.findOne({ where: { id: tagData.id }, transaction }))
        .catch(err => {
          // We remove the image uploaded because the product was not added.
          if (tagData.iconUrl) {
            return mediaUtils
              .deleteImage(tagData.iconUrl)
              .then(() => {
                throw err;
              })
              .catch(innerErr => {
                throw innerErr;
              });
          }

          throw err;
        });

      return innerPromise;
    })
    .catch(err => {
      throw Boom.boomify(err);
    });

  return reply(promise);
}

function updateTag(request, reply) {
  const db = request.getDb();
  const sequelize = db.sequelize;
  const { roleId } = request.auth.credentials;
  const { Tag, UserRole } = db.getModels();

  if (roleId !== UserRole.ROLE_ADMIN) {
    return reply(Boom.forbidden(`Vous n'avez pas le droit de modifier un mot-clef !`));
  }

  let tagData = null;
  let tagDb = null;
  let oldImagePath = null;

  try {
    tagData = JSON.parse(request.payload.tagData);
  } catch (e) {
    return reply(Boom.badRequest(`Données de mot-clef erronées envoyées.`));
  }

  const tagId = request.params.tagId;
  const picUpload = request.payload.file;
  const validationResult = Joi.validate(tagData, validate.tag);

  // Joi validation of the payload because we sent the data as form-data and not JSON.
  if (validationResult.error !== null) {
    return reply(Boom.badData(validationResult.error));
  }

  tagData = validationResult.value;

  const promise = sequelize
    .transaction(transaction => {
      const innerPromise = Tag.findOne({ where: { id: tagId } })
        .then(tag => {
          if (!tag) {
            throw Boom.notFound(`Le mot-clef n'existe pas. Id : ${tagId}`);
          }

          tagDb = tag;

          if (picUpload) {
            return mediaUtils.createImage(picUpload, `tags/${tagId}`).then(imgPath => {
              tagData.iconUrl = imgPath;
              return imgPath;
            });
          }

          return null;
        })
        .then(pImg => {
          if (picUpload && !pImg) {
            throw Boom.notFound(`Impossible d'enregistrer l'icône du mot-clef`);
          }

          // We keep the old image path in order to remove it if the update was successfull.
          oldImagePath = tagDb.iconUrl;

          return tagDb.update(tagData, { transaction });
        })
        .catch(err => {
          if (tagData.iconUrl) {
            // We remove the image uploaded because the product was not updated.
            return mediaUtils
              .deleteImage(tagData.iconUrl)
              .then(() => {
                throw err;
              })
              .catch(innerErr => {
                throw innerErr;
              });
          }

          throw err;
        })
        .then(() => {
          if (picUpload) {
            // We delete the previous image if everything went good.
            return mediaUtils.deleteImage(oldImagePath);
          }

          return true;
        })
        .then(() => Tag.findOne({ where: { id: tagId }, transaction }));

      return innerPromise;
    })
    .catch(err => {
      throw Boom.boomify(err);
    });

  return reply(promise);
}

function deleteTag(request, reply) {
  const db = request.getDb();
  const { sequelize } = db;
  const { Tag, UserRole } = db.getModels();
  const { roleId } = request.auth.credentials;
  const { tagId } = request.params;

  if (roleId !== UserRole.ROLE_ADMIN) {
    return reply(Boom.forbidden(`Vous n'avez pas les droits pour exécuter cette action`));
  }

  const promise = sequelize
    .transaction(transaction => {
      const innerPromise = Tag.findOne({ where: { id: tagId }, transaction })
        .then(tag => {
          if (tag === null) {
            throw Boom.notFound(`Le mot-clef n'existe pas (id: ${tagId})`);
          }

          return tag.destroy({ transaction });
        })
        .then(() => {});

      return innerPromise;
    })
    .catch(err => {
      throw Boom.boomify(err);
    });

  return reply(promise);
}
