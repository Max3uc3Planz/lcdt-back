'use strict';

const Boom = require('boom');

exports.getPhones = getPhones;
exports.createPhone = createPhone;
exports.updatePhone = updatePhone;
exports.deletePhone = deletePhone;

function getPhones(request, reply) {
  const userId = request.params.userId;
  const db = request.getDb();
  const { id, roleId } = request.auth.credentials;
  const { Telephone, UserRole, User } = db.getModels();

  // We check if the user asking for the phones is the owner or an admin.
  if (userId !== id && roleId !== UserRole.ROLE_ADMIN) {
    return reply(Boom.forbidden(`Vous n'avez pas le droit d'accéder à cette ressource !`));
  }

  const promise = User.findOne({
    where: {
      id: userId,
    },
  })
    .then(userInDb => {
      if (!userInDb) {
        throw Boom.notFound('Utilisateur non existant !');
      }

      return Telephone.findAll({
        where: {
          userId,
        },
      });
    })
    .catch(err => {
      throw Boom.boomify(err);
    });

  return reply(promise);
}

function createPhone(request, reply) {
  const userId = request.params.userId;
  const db = request.getDb();
  const sequelize = db.sequelize;
  const { Telephone, User, UserRole } = db.getModels();
  const { id, roleId } = request.auth.credentials;
  const phoneData = request.payload;

  // We check if the user creating the phone is the owner or an admin.
  if (userId !== id && roleId !== UserRole.ROLE_ADMIN) {
    return reply(
      Boom.forbidden(`Vous n'avez pas le droit de créer une ressource pour cet utilisateur !`)
    );
  }

  const promise = sequelize
    .transaction(transaction => {
      const insidePromise = User.findOne({
        where: {
          id: userId,
        },
        transaction,
      })
        .then(userInDb => {
          if (!userInDb) {
            throw Boom.notFound('Utilisateur non existant !');
          }
        })
        .then(() =>
          Telephone.create(
            {
              phone: phoneData.phone,
              isMain: false,
              userId,
            },
            {
              transaction,
            }
          )
        );

      return insidePromise;
    })
    .catch(err => {
      throw Boom.boomify(err);
    });

  return reply(promise);
}

function updatePhone(request, reply) {
  const userId = request.params.userId;
  const phoneId = request.params.phoneId;

  const db = request.getDb();
  const sequelize = db.sequelize;
  const { Telephone, User, UserRole } = db.getModels();
  const { id, roleId } = request.auth.credentials;
  const phoneData = request.payload;

  // We check if the user updating the phone is the owner or an admin.
  if (userId !== id && roleId !== UserRole.ROLE_ADMIN) {
    return reply(Boom.forbidden(`Vous n'avez pas le droit de modifier cette ressource !`));
  }

  const promise = sequelize
    .transaction(transaction => {
      const innerPromise = Telephone.findOne({
        where: {
          id: phoneId,
          userId,
        },
        include: [
          {
            model: User,
            as: 'user',
          },
        ],
      }).then(phone => {
        if (!phone) {
          throw Boom.notFound(`Le téléphone demandé n'existe pas ! (id : ${phoneId})`);
        }

        if (phone.user.id !== id && roleId !== UserRole.ROLE_ADMIN) {
          throw Boom.forbidden(`Vous n'avez pas les droits pour modifier ce téléphone !`);
        }

        /* If the isMain attribute is set, we have to unset
             the other phone with the isMain attribute on. */
        if (phoneData.isMain === true && phone.isMain === false) {
          const oldPhonePromise = Telephone.findOne({
            where: {
              userId,
              isMain: true,
            },
          })
            .then(oldMainPhone => {
              if (!oldMainPhone) {
                return null;
              }

              return oldMainPhone.update(
                {
                  isMain: false,
                },
                {
                  transaction,
                }
              );
            })
            .then(() =>
              phone.update(phoneData, {
                transaction,
              })
            );

          return oldPhonePromise;
        }

        return phone.update(phoneData, {
          transaction,
        });
      });

      return innerPromise;
    })
    .then(() =>
      Telephone.findOne({
        where: {
          id: phoneId,
        },
      })
    )
    .catch(err => {
      throw Boom.boomify(err);
    });

  return reply(promise);
}

function deletePhone(request, reply) {
  const userId = request.params.userId;
  const phoneId = request.params.phoneId;
  let phones;
  let phone;
  const db = request.getDb();
  const sequelize = db.sequelize;
  const { Telephone, User, UserRole } = db.getModels();
  const { id, roleId } = request.auth.credentials;

  // We check if the user deleting the phone is the owner or an admin.
  if (userId !== id && roleId !== UserRole.ROLE_ADMIN) {
    return reply(Boom.forbidden(`Vous n'avez pas le droit de supprimer cette ressource !`));
  }

  const promise = sequelize
    .transaction(transaction => {
      const innerPromise = User.findOne({
        where: {
          id,
        },
        include: [
          {
            model: Telephone,
            as: 'phones',
          },
        ],
        order: [
          [
            {
              model: Telephone,
              as: 'phones',
            },
            'createdAt',
            'DESC',
          ],
        ],
        transaction,
      })
        .then(user => {
          if (!user) {
            throw Boom.notFound(`L'utilisateur demandé n'existe pas ! (id : ${id})`);
          }

          const returnedUser = user.get({
            plain: true,
          });
          phones = returnedUser.phones;
          phone = phones.find(p => p.id === phoneId);
          const phoneIndex = phones.findIndex(p => p.id === phoneId);

          if (phone === undefined) {
            throw Boom.notFound(`Le n° de téléphone demandé n'existe pas ! (id : ${phoneId})`);
          }
          phones.splice(phoneIndex, 1);
          return Telephone.destroy(
            {
              where: {
                id: phoneId,
              },
            },
            transaction
          );
        })
        .then(deleteNb => {
          if (phone.isMain === true) {
            Telephone.update(
              {
                isMain: true,
              },
              {
                where: {
                  id: phones[0].id,
                },
              },
              transaction
            );
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
