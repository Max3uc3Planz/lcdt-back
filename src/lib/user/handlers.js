'use strict';

const config = require('~/config');
const Bcrypt = require('bcrypt');
const Boom = require('boom');
const httpRequest = require('request');
const { resolve } = require('path');

const internals = {};

Promise.promisifyAll(Bcrypt);
Promise.promisifyAll(httpRequest);

exports.login = login;
exports.logout = logout;
exports.signupUser = signupUser;
exports.getUser = getUser;
exports.getAllUsers = getAllUsers;
exports.recoverPwd = recoverPwd;
exports.deleteUser = deleteUser;
exports.createUserPwd = createUserPwd;
exports.updateUser = updateUser;
exports.deleteUserAddress = deleteUserAddress;

function login(request, reply) {
  const db = request.getDb();
  const sequelize = db.sequelize;
  const { User, UserBan, UserRole, Telephone } = db.getModels();
  const userData = request.payload;

  // We only check credentials against non-deleted users.
  const userWhereCl = {
    deleted: false,
  };

  let returnedUser = null;

  // Depending on which type of login, we do not have the same info.
  if (userData.email) {
    userWhereCl.email = userData.email;
    userWhereCl.roleId = UserRole.ROLE_USER;
  } else {
    userWhereCl.username = userData.username;
    userWhereCl.roleId = {
      $in: [UserRole.ROLE_ADMIN, UserRole.ROLE_CHEF],
    };
  }

  const promise = sequelize
    .transaction(transaction => {
      const innerPromise = User.findOne({
        attributes: {
          exclude: ['deleted', 'sponsorshipCode', 'sponsorCode', 'createdAt', 'updatedAt'],
        },
        where: userWhereCl,
        include: [
          { model: UserRole, as: 'role', attributes: ['id'] },
          { model: UserBan, as: 'bans' },
          { model: Telephone, as: 'phones', attributes: [] },
        ],
        transaction,
      })
        .then(userInDb => {
          if (!userInDb) {
            throw Boom.notFound(`Mot de passe ou nom d'utilisateur incorrect`);
          }
          returnedUser = userInDb;

          if (isBanned(returnedUser)) {
            throw Boom.unauthorized(`L'utilisateur est banni.`);
          }

          return Bcrypt.compareAsync(userData.password, returnedUser.password);
        })
        .then(isSameUser => {
          if (isSameUser) {
            returnedUser = returnedUser.get({ plain: true });

            if (returnedUser.roleId === UserRole.ROLE_USER) {
              // In order not to trigger Joi validation error in the future.
              delete returnedUser.username;
            } else {
              // In order not to trigger Joi validation error in the future.
              delete returnedUser.email;
            }

            delete returnedUser.password;

            return JSON.stringify(returnedUser);
          }

          throw Boom.notFound(`Mot de passe ou nom d'utilisateur incorrect`);
        });

      return innerPromise;
    })
    .catch(err => {
      throw Boom.boomify(err);
    });

  return reply(promise);
}

function logout(request, reply) {
  const token = request.auth.token;
  const { exp } = request.auth.credentials;
  const db = request.getDb();
  const BLTokenModel = db.getModel('BlacklistToken');
  const currentTimestamp = new Date().getTime();
  let promise = Promise.resolve();

  if (currentTimestamp < exp) {
    promise = promise.then(() => BLTokenModel.create({ expire: exp, token })).catch(err => {
      throw Boom.boomify(err);
    });
  }

  reply(promise).unstate('token');
}

function signupUser(request, reply) {
  const db = request.getDb();
  const sequelize = db.sequelize;
  const { User, UserRole, Telephone, SponsorshipDiscount } = db.getModels();
  const userData = request.payload;
  const userPhone = userData.phone;
  let newUser = null;
  let sponsor = null;

  const promise = sequelize
    .transaction(transaction => {
      const insidePromise = User.findOne({ where: { email: userData.email }, transaction })
        .then(userInDb => {
          if (userInDb) {
            throw Boom.conflict('Un compte existant utilise déjà cette adresse mail');
          }

          if (userData.sponsorCode !== undefined) {
            return User.findOne({ where: { sponsorshipCode: userData.sponsorCode }, transaction });
          }

          return null;
        })
        .then(spons => {
          if (spons === null) {
            throw Boom.badData(`Le code de parrainage n'est pas valide`);
          }
          sponsor = spons;

          return Bcrypt.hashAsync(userData.password, config.get('/security/bcryptRound'));
        })
        .then(hash => {
          userData.password = hash;
          userData.roleId = UserRole.ROLE_USER;

          // We remove the phone from the user because it's not one of its properties.
          delete userData.phone;

          return User.create(userData, { transaction });
        })
        .then(user => {
          newUser = user;
          return Telephone.create({ phone: userPhone, isMain: true }, { transaction });
        })
        .then(phone => newUser.addPhone(phone, { transaction }))
        // sponsorship code generation
        .then(() => getSecuredRandomData(8))
        .then(hash => {
          const user = newUser.toJSON();
          const firstnamePortion = user.firstname.charAt(0).toUpperCase();
          const lastnamePortion = user.lastname.substr(0, 3).toUpperCase();
          const sponsorshipCode = `${firstnamePortion}${lastnamePortion}${hash}`;
          return newUser.update({ sponsorshipCode }, { transaction });
        })
        .then(() => {
          if (newUser.sponsorCode === undefined || sponsor === null) {
            return null;
          }

          return SponsorshipDiscount.bulkCreate(
            [
              { code: newUser.sponsorCode, consumed: false, userId: newUser.id },
              { code: newUser.sponsorshipCode, consumed: false, userId: sponsor.id },
            ],
            { transaction }
          );
        })
        .then(() => newUser.publicData);

      return insidePromise;
    })
    .catch(err => {
      throw Boom.boomify(err);
    });

  reply(promise);
}

function getUser(request, reply) {
  const uId = request.params.id;
  const db = request.getDb();
  const { User, UserBan, UserRole, Telephone, Address, Order } = db.getModels();
  const { id, roleId } = request.auth.credentials;

  if (uId !== id && roleId !== UserRole.ROLE_ADMIN) {
    return reply(Boom.forbidden(`Vous n'avez pas le droit d'accéder à cette ressource !`));
  }

  const promise = User.findOne({
    attributes: { exclude: ['createdAt', 'updatedAt', 'password', 'deleted'] },
    where: { id: uId },
    include: [
      { model: UserBan, as: 'bans' },
      { model: Address, as: 'addresses', attributes: { exclude: ['createdAt', 'updatedAt'] } },
      { model: Telephone, as: 'phones' },
      { model: Order, as: 'orders', order: [['createdAt', 'DESC']] },
    ],
  })
    .then(user => {
      if (!user) {
        throw Boom.notFound(`L'utilisateur demandé n'existe pas ! (id : ${uId})`);
      }

      const stripedUser = user.toJSON();

      if (user.roleId === UserRole.ROLE_USER) {
        // In order not to trigger Joi validation error in the future.
        delete stripedUser.username;
      } else {
        // In order not to trigger Joi validation error in the future.
        delete stripedUser.email;
      }

      return stripedUser;
    })
    .catch(err => {
      throw Boom.boomify(err);
    });

  return reply(promise);
}

function getAllUsers(request, reply) {
  const db = request.getDb();
  const { roleId } = request.auth.credentials;
  const { User, UserBan, UserRole } = db.getModels();

  if (roleId !== UserRole.ROLE_ADMIN) {
    return reply(Boom.forbidden(`Vous n'avez pas le droit de lister ces ressources !`));
  }

  const promise = User.findAll({
    where: { deleted: false },
    include: [{ model: UserRole, as: 'role' }, { model: UserBan, as: 'bans' }],
  }).catch(err => {
    throw Boom.boomify(err);
  });

  return reply(promise);
}

function recoverPwd(request, reply) {
  const db = request.getDb();
  const sequelize = db.sequelize;
  const { User, UserRole } = db.getModels();
  const { email, frontendUrl } = request.payload;
  let user = null;

  const promise = sequelize
    .transaction(transaction => {
      const innerPromise = User.findOne({ where: { email } })
        .then(userInDb => {
          if (!userInDb || userInDb.roleId === UserRole.ROLE_ADMIN) {
            throw Boom.notFound(`L'utilisateur n'existe pas`);
          }
          user = userInDb;

          return getSecuredHash(20, email);
        })
        .then(hash => {
          const expires = new Date();
          expires.setHours(expires.getHours() + 24);
          user.recoveryToken = hash;
          user.tokenExpiration = expires;

          return user.save({ transaction });
        })
        .then(updatedUser => {
          // send email
          const templatePath = resolve(__dirname, 'templates', 'password-recovery.html');
          const passwordLink = `${frontendUrl}/create-password/${updatedUser.recoveryToken}`;

          return templater.getCompiledHtml(templatePath, {
            firstname: user.get('firstname'),
            lastname: user.get('lastname'),
            passwordLink,
          });
        })
        .then(compiledHtml => {
          const params = {
            from: config.get('/mailer/transporter/auth/user'),
            to: user.email,
            subject: 'Récupération de mot de passe',
            html: compiledHtml,
            attachments: {
              filename: 'logo.png',
              path: resolve(config.get('/publicImgFolder'), 'logo.png'),
              cid: 'logoCantine@mailLogo',
            },
          };

          return request.mailer.sendMail(params);
        })
        .then(info => {
          if (info.accepted.length === 0) {
            throw Boom.create(424, "Impossible d'envoyer un mail de récupération de mot de passe");
          }
        });

      return innerPromise;
    })
    .catch(e => {
      throw Boom.boomify(err);
    });

  reply(promise);
}

function deleteUser(request, reply) {
  const db = request.getDb();
  const { sequelize } = db;
  const uId = request.params.id;
  const { roleId, id } = request.auth.credentials;
  const { User, UserRole, Order } = db.getModels();

  if (roleId !== UserRole.ROLE_ADMIN || id === uId) {
    return reply(Boom.forbidden(`Vous n'êtes pas autorisé à effectuer cette action`));
  }

  const promise = sequelize
    .transaction(transaction => {
      const innerPromise = User.findOne({
        where: uId,
        include: [{ model: Order, as: 'orders' }],
        transaction,
      }).then(user => {
        if (!user) {
          throw Boom.notFound(`L'utilisateur demandé n'existe pas ! (id : ${uId})`);
        }

        if (user.roleId === UserRole.USER && user.orders.length > 0) {
          user.deleted = true;
          return user.update({ transaction });
        }

        return User.destroy({ where: { id: uId }, transaction });
      });

      return innerPromise;
    })
    .catch(err => {
      throw Boom.boomify(err);
    });

  return reply(promise);
}

function createUserPwd(request, reply) {
  const db = request.getDb();
  const sequelize = db.sequelize;
  const { User } = db.getModels();
  const payload = request.payload;
  let user = null;

  const promise = sequelize
    .transaction(transaction => {
      if (request.auth.isAuthenticated) {
        throw Boom.forbidden(`Impossible de créer un mot de passe en étant connecté`);
      }

      const innerPromise = User.findOne({ where: { recoveryToken: payload.token }, transaction })
        .then(userInDb => {
          const currentDate = new Date();
          if (!userInDb) {
            throw Boom.unauthorized(`Token non valide`);
          } else if (userInDb.tokenExpiration < currentDate) {
            throw Boom.unauthorized(`Token périmé.`);
          } else if (payload.password !== payload.passwordRepeat) {
            throw Boom.badData(`Incohérence de mot de passe`);
          }
          user = userInDb;

          return Bcrypt.hashAsync(payload.password, config.get('/security/bcryptRound'));
        })
        .then(hash => {
          user.password = hash;
          user.recoveryToken = null;
          user.tokenExpiration = null;

          return user.save({ transaction });
        })
        // to prevent from returning the user with the new password
        .then(() => {});

      return innerPromise;
    })
    .catch(err => {
      throw Boom.boomify(err);
    });

  reply(promise);
}

function updateUser(request, reply) {
  const db = request.getDb();
  const sequelize = db.sequelize;
  const { User } = db.getModels();
  const { userId } = request.params;
  const { id } = request.auth.credentials;
  const payload = request.payload;
  let user = null;

  if (id !== userId || id !== payload.id) {
    return reply(Boom.forbidden(`Vous n'êtes pas autorisé à effectuer cette opération`));
  }

  const promise = sequelize
    .transaction(transaction => {
      const innerPromise = User.findOne({ where: { id }, transaction })
        .then(userDb => {
          user = userDb;
          return User.findOne({ where: { email: payload.email }, payload });
        })
        .then(userWithNewEmail => {
          if (userWithNewEmail !== null && userWithNewEmail.id !== id) {
            throw Boom.badData(`L'email est déjà utilisé`);
          }

          return User.update(payload, { where: { id }, transaction });
        })
        .then(() => internals.validatePasswordUpdate(payload, user, User, transaction));

      return innerPromise;
    })
    .then(() => User.findOne({ where: { id } }))
    .then(updatedUser => updatedUser.publicData)
    .catch(err => {
      throw Boom.boomify(err);
    });

  return reply(promise);
}

function deleteUserAddress(request, reply) {
  const db = request.getDb();
  const sequelize = db.sequelize;
  const aId = request.params.addressId;
  const uId = request.params.userId;
  const { id } = request.auth.credentials;
  const { User, Address } = db.getModels();
  let addresses;
  let address;

  if (id !== uId) {
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

internals.validatePasswordUpdate = (
  { id, oldPassword, newPassword, newPasswordRepeat },
  user,
  UserModel,
  transaction
) => {
  if (oldPassword === undefined) {
    return Promise.resolve(null);
  }

  if (newPassword !== newPasswordRepeat) {
    return Promise.reject(
      Boom.badData(`Le nouveau mot de passe et sa confirmation ne sont pas identiques`)
    );
  }

  return Bcrypt.compareAsync(oldPassword, user.password)
    .then(isSameUser => {
      if (isSameUser === false) {
        throw Boom.badData(`L'ancien mot de passe est invalide.`);
      }

      return Bcrypt.hashAsync(newPassword, config.get('/security/bcryptRound'));
    })
    .then(hash => UserModel.update({ password: hash }, { where: { id }, transaction }));
};
