'use strict';

const Boom = require('boom');

module.exports = {
  getDeliveryTypes,
  getDeliveryType,
  updateDeliveryType,
};

function getDeliveryTypes(request, reply) {
  const db = request.getDb();
  const { DeliveryType } = db.getModels();

  const promise = DeliveryType.findAll().catch(err => {
    throw Boom.boomify(err);
  });

  return reply(promise);
}

function getDeliveryType(request, reply) {
  const db = request.getDb();
  const { DeliveryType } = db.getModels();
  const { id } = request.params;

  const promise = DeliveryType.findOne({ where: { id } }).catch(err => {
    throw Boom.boomify(err);
  });

  reply(promise);
}

function updateDeliveryType(request, reply) {
  const db = request.getDb();
  const { sequelize } = db;
  const { DeliveryType, UserRole } = db.getModels();
  const { dtId } = request.params;
  const { roleId } = request.auth.credentials;
  const { payload } = request;

  if (roleId !== UserRole.ROLE_ADMIN) {
    return reply(Boom.forbidden(`Vous n'avez pas le droit de réaliser cette opération`));
  }

  if (dtId !== payload.id) {
    return reply(
      Boom.badRequest(`L'identifiant en paramètre et l'identifiant du body ne correspondent pas`)
    );
  }

  const promise = sequelize
    .transaction(transaction =>
      DeliveryType.findOne({ where: { id: dtId }, transaction }).then(deliveryType => {
        if (deliveryType === null) {
          throw Boom.notFound(`Le type de livraison n'existe pas (id: ${dtId})`);
        }

        return deliveryType.update(payload, { transaction });
      })
    )
    .catch(err => {
      throw Boom.boomify(err);
    });

  return reply(promise);
}
