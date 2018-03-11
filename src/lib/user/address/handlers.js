'use strict';

const Boom = require('boom');

const { isAddressInZones, buildAddressString } = require('~/utils/address');
const Map = require('~/utils/map');

exports.getAdresses = getAdresses;
exports.createAddress = createAddress;
exports.updateAddress = updateAddress;
exports.deleteAddress = deleteAddress;
exports.validateAddress = validateAddress;

function getAdresses(request, reply) {
  const userId = request.params.userId;
  const db = request.getDb();
  const { id, roleId } = request.auth.credentials;
  const { Address, UserRole } = db.getModels();

  // We check if the user asking for the addresses is the owner or an admin.
  if (userId !== id && roleId !== UserRole.ROLE_ADMIN) {
    return reply(Boom.forbidden(`Vous n'avez pas le droit d'accéder à cette ressource !`));
  }

  const promise = Address.findAll({ where: { userId } }).catch(err => {
    throw Boom.boomify(err);
  });

  return reply(promise);
}

function createAddress(request, reply) {
  const userId = request.params.userId;
  const db = request.getDb();
  const sequelize = db.sequelize;
  const { Address, User, UserRole, DeliveryZone } = db.getModels();
  const { id, roleId } = request.auth.credentials;
  const addressData = request.payload;

  // We check if the user creating the address is the owner or an admin.
  if (userId !== id && roleId !== UserRole.ROLE_ADMIN) {
    return reply(
      Boom.forbidden(`Vous n'avez pas le droit de créer une ressource pour cet utilisateur !`)
    );
  }

  const promise = sequelize
    .transaction(transaction => {
      const insidePromise = User.findOne({ where: { id: userId }, transaction })
        .then(userInDb => {
          if (!userInDb) {
            throw Boom.notFound('Utilisateur non existant !');
          }

          return DeliveryZone.findAll();
        })
        .then(deliveryZones => {
          if (!isAddressInZones(addressData.lat, addressData.lng, deliveryZones)) {
            throw Boom.badData(
              `L'adresse doit être située dans une des zones de livraison déservies.`
            );
          }

          addressData.userId = userId;
          return Address.create(addressData, { transaction });
        });

      return insidePromise;
    })
    .catch(err => {
      throw Boom.boomify(err);
    });

  return reply(promise);
}

function updateAddress(request, reply) {
  const userId = request.params.userId;
  const addrId = request.params.addressId;

  const db = request.getDb();
  const sequelize = db.sequelize;
  const { Address, User, UserRole, DeliveryZone } = db.getModels();
  const { id, roleId } = request.auth.credentials;
  const addressData = request.payload;
  let dbAddress = null;

  // We check if the user updating the address is the owner or an admin.
  if (userId !== id && roleId !== UserRole.ROLE_ADMIN) {
    return reply(Boom.forbidden(`Vous n'avez pas le droit de modifier cette ressource !`));
  }

  const promise = sequelize
    .transaction(transaction => {
      const innerPromise = Address.findOne({
        where: { id: addrId },
        include: [{ model: User, as: 'user' }],
      })
        .then(address => {
          if (!address) {
            throw Boom.notFound(`L'adresse demandée n'existe pas ! (id : ${addrId})`);
          }

          if (address.user.id !== id && roleId !== UserRole.ROLE_ADMIN) {
            throw Boom.forbidden(`Vous n'avez pas les droits pour modifier cette adresse !`);
          }

          dbAddress = address;

          return DeliveryZone.findAll();
        })
        .then(deliveryZones => {
          if (!isAddressInZones(addressData.lat, addressData.lng, deliveryZones)) {
            throw Boom.badData(
              `L'adresse doit être située dans une des zones de livraison déservies.`
            );
          }

          return dbAddress.update(addressData, { transaction });
        });

      return innerPromise;
    })
    .then(() => Address.findOne({ where: { id: addrId } }))
    .catch(err => {
      throw Boom.boomify(err);
    });

  return reply(promise);
}

function deleteAddress(request, reply) {
  const db = request.getDb();
  const sequelize = db.sequelize;
  const aId = request.params.addressId;
  const uId = request.params.userId;
  const { id, roleId } = request.auth.credentials;
  const { User, Address, UserRole } = db.getModels();
  let addresses;
  let address;

  if (id !== uId && roleId !== UserRole.ROLE_ADMIN) {
    return reply(Boom.forbidden(`Vous n'êtes pas autorisé à effectuer cette action`));
  }

  const promise = sequelize
    .transaction(transaction => {
      const innerPromise = User.findOne({
        where: { id: uId },
        include: [{ model: Address, as: 'addresses' }],
        order: [[{ model: Address, as: 'addresses' }, 'createdAt', 'ASC']],
        transaction,
      })
        .then(user => {
          if (!user) {
            throw Boom.notFound(`L'utilisateur demandé n'existe pas ! (id : ${uId})`);
          }

          const returnedUser = user.get({ plain: true });
          addresses = returnedUser.addresses;
          address = addresses.find(a => a.id === aId);
          const adressIndex = addresses.findIndex(a => a.id === aId);

          if (address === undefined) {
            throw Boom.notFound(`L'adresse demandée n'existe pas ! (id : ${aId})`);
          }
          addresses.splice(adressIndex, 1);
          return Address.destroy({ where: { id: aId } }, transaction);
        })
        .then(deleteNb => {
          if (address.isMain === true) {
            Address.update({ isMain: true }, { where: { id: addresses[0].id } }, transaction);
          }
          return deleteNb;
        });

      return innerPromise;
    })
    .catch(err => {
      throw Boom.boomify(err);
    });

  return reply(promise);
}

function validateAddress(request, reply) {
  const db = request.getDb();
  const { DeliveryZone } = db.getModels();
  const { lat, lng } = request.payload;

  const promise = DeliveryZone.findAll()
    .then(zones => {
      if (isAddressInZones(lat, lng, zones) === false) {
        throw Boom.badData(`L'adresse n'est pas desservie`);
      }
    })
    .then(() => {
      const mapClient = new Map();
      return mapClient.getAddressLatLng(buildAddressString(request.payload));
    })
    .then(({ geocodeLat, geocodeLng }) => {
      if (geocodeLat !== lat && geocodeLng !== lng) {
        throw Boom.badData(`Les coordonnées d'adresse ne correspondent pas à l'adresse soumise`);
      }
    })
    .catch(err => {
      throw Boom.boomify(err);
    });

  reply(promise);
}
