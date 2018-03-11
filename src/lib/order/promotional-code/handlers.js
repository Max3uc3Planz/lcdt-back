'use strict';

const { validatePromotionalCode } = require('./functions');
const Boom = require('boom');
const moment = require('moment');

module.exports = {
  validatePromoCode,
  getAllPromoCode,
  createPromoCode,
  getAllPromoCodeType,
};

function validatePromoCode(request, reply) {
  const db = request.getDb();
  const { code } = request.params;
  const { id } = request.auth.credentials;

  const promise = validatePromotionalCode(db, code, id);

  reply(promise);
}

function getAllPromoCodeType(request, reply) {
  const db = request.getDb();
  const { PromotionalCodeType, UserRole } = db.getModels();
  const { roleId } = request.auth.credentials;

  if (roleId !== UserRole.ROLE_ADMIN) {
    return reply(Boom.forbidden(`Vous ne pouvez réaliser cette opération`));
  }

  const promise = PromotionalCodeType.findAll().catch(err => {
    throw Boom.boomify(err);
  });

  return reply(promise);
}

function getAllPromoCode(request, reply) {
  const db = request.getDb();
  const { PromotionalCode, PromotionalCodeType, UserRole } = db.getModels();
  const { roleId } = request.auth.credentials;

  if (roleId !== UserRole.ROLE_ADMIN) {
    return reply(Boom.forbidden(`Vous ne pouvez réaliser cette opération`));
  }

  const promise = PromotionalCode.findAll({
    include: [{ model: PromotionalCodeType, as: 'type' }],
    order: [['expirationDate']],
  }).catch(err => {
    throw Boom.boomify(err);
  });

  return reply(promise);
}

function createPromoCode(request, reply) {
  const db = request.getDb();
  const { sequelize } = db;
  const { PromotionalCode, PromotionalCodeType, UserRole } = db.getModels();
  const { roleId } = request.auth.credentials;
  const { payload } = request;

  if (roleId !== UserRole.ROLE_ADMIN) {
    return reply(Boom.forbidden(`Vous ne pouvez réaliser cette opération`));
  }

  const promise = sequelize.transaction(transaction => {
    const innerPromise = PromotionalCode.findOne({ where: { code: payload.code }, transaction })
      .then(promoCode => {
        if (promoCode !== null) {
          throw Boom.conflict(`Le code promo existe déjà !`);
        }
        return PromotionalCodeType.findOne({ where: { id: payload.typeId }, transaction });
      })
      .then(promoCodeType => {
        if (promoCodeType === null) {
          throw Boom.notFound(`Le type de code promo n'existe pas id: ${payload.typeId}`);
        }
        return PromotionalCode.create(payload, { transaction });
      })
      .catch(err => {
        throw Boom.boomify(err);
      });

    return innerPromise;
  });

  return reply(promise);
}
