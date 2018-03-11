'use strict';

const Boom = require('boom');
const Joi = require('joi');

module.exports = {
  getCategoriesAvailable,
  getCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
};

function getCategoriesAvailable(request, reply) {
  const db = request.getDb();
  const { Category, Product } = db.getModels();

  const promise = Category.findAll({
    include: [{ model: Product, as: 'products', required: true, attributes: [] }],
  }).catch(err => {
    throw Boom.boomify(err);
  });

  reply(promise);
}

function getCategories(request, reply) {
  const db = request.getDb();
  const { Category, UserRole } = db.getModels();
  const { roleId } = request.auth.credentials;

  if (roleId !== UserRole.ROLE_ADMIN) {
    return reply(Boom.forbidden(`Vous n'avez pas les droits pour exécuter cette action`));
  }

  const promise = Category.findAll().catch(err => {
    throw Boom.boomify(err);
  });

  return reply(promise);
}

function createCategory(request, reply) {
  const db = request.getDb();
  const { sequelize } = db;
  const { Category, UserRole } = db.getModels();
  const { roleId } = request.auth.credentials;
  const payload = request.payload;
  const { products } = request.payload;

  if (roleId !== UserRole.ROLE_ADMIN) {
    return reply(Boom.forbidden(`Vous n'avez pas les droits pour effectuer cette opération`));
  }

  const promise = sequelize
    .transaction(transaction => {
      const innerPromise = Category.create(payload, { transaction })
        // the update generated does nothing if products === null or id that does not exist
        .then(newCat => newCat.setProducts(products, { transaction }));

      return innerPromise;
    })
    .catch(err => {
      throw Boom.boomify(err);
    });

  return reply(promise);
}

function updateCategory(request, reply) {
  const db = request.getDb();
  const { sequelize } = db;
  const { Category, UserRole } = db.getModels();
  const { roleId } = request.auth.credentials;
  const { catId } = request.params;
  const payload = request.payload;
  const { products } = request.payload;
  let updateCat = null;

  if (roleId !== UserRole.ROLE_ADMIN) {
    return reply(Boom.forbidden(`Vous n'avez pas les droits pour effectuer cette opération`));
  }

  if (payload.id !== catId) {
    return reply(Boom.badRequest(`Paramètre id et payload id ne correspondent pas`));
  }

  const promise = sequelize
    .transaction(transaction => {
      const innerPromise = Category.findOne({ where: { id: payload.id }, transaction })
        .then(cat => {
          if (cat === null) {
            throw Boom.notFound(`La catégorie n'existe pas (id: ${payload.id})`);
          }
          updateCat = cat;

          return Category.update(payload, { where: { id: payload.id }, transaction });
        })
        .then(() => updateCat.setProducts(products, { transaction }))
        .then(() => Category.findOne({ where: { id: payload.id }, transaction }));

      return innerPromise;
    })
    .catch(err => {
      throw Boom.boomify(err);
    });

  return reply(promise);
}

function getCategory(request, reply) {
  const db = request.getDb();
  const { Category, UserRole, Product } = db.getModels();
  const { roleId } = request.auth.credentials;
  const { catId } = request.params;

  if (roleId !== UserRole.ROLE_ADMIN) {
    return reply(Boom.forbidden(`Vous n'avez pas les droits pour exécuter cette action`));
  }

  const promise = Category.findOne({
    where: { id: catId },
    include: [{ model: Product, as: 'products', attributes: ['id'] }],
  })
    .then(cat => {
      if (cat === null) {
        throw Boom.notFound(`La catégorie n'existe pas (id: ${catId})`);
      }

      // returns array of ids and not array of objects for seamless update
      const strippedCat = cat.get({ plain: true });
      strippedCat.products = strippedCat.products.map(p => p.id);

      return strippedCat;
    })
    .catch(err => {
      throw Boom.boomify(err);
    });

  return reply(promise);
}

function deleteCategory(request, reply) {
  const db = request.getDb();
  const { sequelize } = db;
  const { Category, UserRole } = db.getModels();
  const { roleId } = request.auth.credentials;
  const { catId } = request.params;

  if (roleId !== UserRole.ROLE_ADMIN) {
    return reply(Boom.forbidden(`Vous n'avez pas les droits pour exécuter cette action`));
  }

  const promise = sequelize
    .transaction(transaction => {
      const innerPromise = Category.findOne({ where: { id: catId }, transaction })
        .then(cat => {
          if (cat === null) {
            throw Boom.notFound(`La catégorie n'existe pas (id: ${catId})`);
          }

          return cat.destroy({ transaction });
        })
        .then(() => {});

      return innerPromise;
    })
    .catch(err => {
      throw Boom.boomify(err);
    });

  return reply(promise);
}
