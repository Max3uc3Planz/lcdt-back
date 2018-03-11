'use strict';

const Boom = require('boom');
const Joi = require('joi');
const moment = require('moment');
const Q = require('q');

const config = require('~/config');
const validate = require('./validate');

const { getDateBoundaries } = require('~/utils/date');
const mediaUtils = require('~/utils/media');

module.exports = {
  getProducts,
  getAvailableProducts,
  getProduct,
  getProductDetail,
  addProduct,
  updateProduct,
  deleteProduct,
  getProductsStocks,
  getProductStocks,
  updateProductsStocks,
  updateProductStocks,
  serveProductImg,
};

function getProducts(request, reply) {
  const db = request.getDb();
  const { Product, Tag, Category, UserRole } = db.getModels();
  const { roleId } = request.auth.credentials;

  if (roleId !== UserRole.ROLE_ADMIN) {
    return reply(Boom.forbidden(`Vous n'avez pas le droit d'accéder à cette ressource !`));
  }

  const promise = Product.findAll({
    attributes: ['id', 'title', 'priceTax', 'currentStock'],
    include: [
      { model: Tag, as: 'tags', attributes: ['id', 'label', 'iconUrl'] },
      { model: Category, as: 'category', attributes: ['id', 'label'] },
    ],
  }).catch(err => {
    throw Boom.boomify(err);
  });

  return reply(promise);
}

function getAvailableProducts(request, reply) {
  const db = request.getDb();
  const { Product, Tag, Category, DayStock } = db.getModels();

  const { minDate, maxDate } = getDateBoundaries();

  const promise = Product.findAll({
    attributes: { exclude: ['price'] },
    include: [
      { model: Tag, as: 'tags' },
      { model: Category, as: 'category', required: true },
      {
        model: DayStock,
        as: 'stocks',
        where: {
          date: {
            $between: [minDate, maxDate],
          },
          active: true,
        },
      },
    ],
  }).catch(err => {
    throw Boom.boomify(err);
  });

  reply(promise);
}

function getProduct(request, reply) {
  const db = request.getDb();
  const { productId } = request.params;
  const { Product, Tag, DayStock, Category } = db.getModels();

  const { minDate, maxDate } = getDateBoundaries();

  const promise = Product.findOne({
    where: { id: productId },
    include: [
      { model: Tag, as: 'tags' },
      { model: Category, as: 'category' },
      {
        model: DayStock,
        as: 'stocks',
        where: {
          date: {
            $between: [minDate, maxDate],
          },
          active: true,
        },
      },
    ],
  })
    .then(product => {
      if (product === null) {
        throw Boom.notFound(`Le produit est indisponible`);
      }

      return product;
    })
    .catch(err => {
      throw Boom.boomify(err);
    });

  reply(promise);
}

function getProductDetail(request, reply) {
  const db = request.getDb();
  const { roleId } = request.auth.credentials;
  const { Product, UserRole, Tag, Category, Option } = db.getModels();

  const { productId } = request.params;

  if (roleId !== UserRole.ROLE_ADMIN) {
    return reply(Boom.forbidden(`Vous n'avez pas le droit d'accéder au détail de ce produit !`));
  }

  const promise = Product.findOne({
    where: { id: productId },
    include: [
      { model: Tag, as: 'tags' },
      { model: Category, as: 'category' },
      { model: Option, as: 'options' },
    ],
  })
    .then(product => {
      if (!product) {
        throw Boom.notFound(`Le produit demandé n'existe pas. Id : ${productId}`);
      }

      return product;
    })
    .catch(err => {
      throw Boom.boomify(err);
    });

  return reply(promise);
}

function addProduct(request, reply) {
  const db = request.getDb();
  const { sequelize } = db;
  const { roleId } = request.auth.credentials;
  const { Product, UserRole, Category, Tag, Option } = db.getModels();
  let newProduct = null;

  if (roleId !== UserRole.ROLE_ADMIN) {
    return reply(Boom.forbidden(`Vous n'avez pas le droit d'ajouter un produit !`));
  }

  let productData = null;

  try {
    productData = JSON.parse(request.payload.productData);
  } catch (e) {
    return reply(Boom.badRequest(`Données de produit erronées envoyées.`));
  }

  const picUpload = request.payload.file;
  const validationResult = Joi.validate(productData, validate.newProduct);

  // Joi validation of the payload because we sent the data as form-data and not JSON.
  if (validationResult.error !== null) {
    return reply(Boom.badData(validationResult.error));
  }

  productData = validationResult.value;
  // remove it so it doesn't throw error when creating project if the category does not exist
  const { categoryId, tags, options } = productData;
  delete productData.categoryId;
  delete productData.tags;
  delete productData.options;

  const tagsIds = Array.isArray(tags) ? tags.map(opt => opt.id) : [];
  const optionsIds = Array.isArray(options) ? options : [];

  const promise = sequelize
    .transaction(transaction => {
      const innerPromise = Product.create(productData, { transaction })
        .then(product => {
          if (!picUpload) {
            throw Boom.badData(`L'image du produit est obligatoire !`);
          }
          newProduct = product;

          return mediaUtils.createImage(picUpload, `products/${product.id}`).then(imgPath => {
            productData.pictureUrl = imgPath;
            productData.id = product.id;
            return imgPath;
          });
        })
        .then(pImg => {
          if (!pImg) {
            throw Boom.notFound(`Impossible d'enregistrer la photo du produit`);
          }

          return Product.update(
            { pictureUrl: productData.pictureUrl },
            { where: { id: productData.id }, transaction }
          );
        })
        .then(() => Category.findOne({ where: { id: categoryId }, transaction }))
        .then(cat => {
          if (cat === null && typeof categoryId !== 'undefined') {
            throw Boom.notFound(`La catégorie n'existe pas (id: ${productData.categoryId}`);
          }

          return newProduct.setCategory(cat, { transaction });
        })
        .then(() => Q.all(tagsIds.map(tagId => Tag.findOne({ where: { id: tagId }, transaction }))))
        .then(tagsDb => {
          if (tagsDb.some(tag => tag === null)) {
            throw Boom.notFound(`Un des tags n'existe pas`);
          }

          if (typeof tags !== 'undefined' && tags.length > 0) {
            return newProduct.setTags(tagsIds, { transaction });
          }

          return null;
        })
        .then(() =>
          Q.all(
            optionsIds.map(optionId => Option.findOne({ where: { id: optionId }, transaction }))
          )
        )
        .then(optionsDb => {
          if (optionsDb.some(opt => opt === null)) {
            throw Boom.notFound(`Une des options n'existe pas`);
          }

          if (typeof options !== 'undefined' && options.length > 0) {
            return newProduct.setOptions(optionsIds, { transaction });
          }

          return null;
        })
        .then(() =>
          Product.findOne({
            where: { id: productData.id },
            include: [{ model: Tag, as: 'tags' }, { model: Option, as: 'options' }],
            transaction,
          })
        )
        .catch(err => {
          // We remove the image uploaded because the product was not added.
          if (productData.pictureUrl) {
            return mediaUtils
              .deleteImage(productData.pictureUrl)
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

function updateProduct(request, reply) {
  const db = request.getDb();
  const { sequelize } = db;
  const { roleId } = request.auth.credentials;
  const { Product, UserRole, Category, Tag, Option } = db.getModels();

  if (roleId !== UserRole.ROLE_ADMIN) {
    return reply(Boom.forbidden(`Vous n'avez pas le droit de modifier un produit !`));
  }

  let productData = null;
  let productDb = null;
  let oldImagePath = null;

  try {
    productData = JSON.parse(request.payload.productData);
  } catch (e) {
    return reply(Boom.badRequest(`Données de produit erronées envoyées.`));
  }

  const { productId } = request.params;
  const picUpload = request.payload.file;
  const validationResult = Joi.validate(productData, validate.product);

  // Joi validation of the payload because we sent the data as form-data and not JSON.
  if (validationResult.error !== null) {
    return reply(Boom.badData(validationResult.error));
  }

  productData = validationResult.value;
  // remove it so it doesn't throw error when creating project if the category does not exist
  const { categoryId, tags, options } = productData;
  delete productData.categoryId;
  delete productData.tags;
  delete productData.options;

  const tagsIds = Array.isArray(tags) ? tags.map(opt => opt.id) : [];
  const optionsIds = Array.isArray(options) ? options : [];

  const promise = sequelize
    .transaction(transaction => {
      const innerPromise = Product.findOne({ where: { id: productId }, transaction })
        .then(product => {
          if (!product) {
            throw Boom.notFound(`Le produit n'existe pas. Id : ${productId}`);
          }

          productDb = product;

          if (picUpload) {
            return mediaUtils.createImage(picUpload, `products/${productId}`).then(imgPath => {
              productData.pictureUrl = imgPath;
              return imgPath;
            });
          }

          return null;
        })
        .then(pImg => {
          if (picUpload && !pImg) {
            throw Boom.notFound(`Impossible d'enregistrer la photo du produit`);
          }

          // We keep the old image path in order to remove it if the update was successfull.
          oldImagePath = productDb.pictureUrl;

          return productDb.update(productData, { transaction });
        })
        .then(() => Category.findOne({ where: { id: categoryId }, transaction }))
        .then(cat => {
          if (cat === null && typeof categoryId !== 'undefined') {
            throw Boom.notFound(`La catégorie n'existe pas (id: ${categoryId})`);
          }

          return productDb.setCategory(cat, { transaction });
        })
        .then(() => Q.all(tagsIds.map(tagId => Tag.findOne({ where: { id: tagId }, transaction }))))
        .then(tagsDb => {
          if (tagsDb.some(tag => tag === null)) {
            throw Boom.notFound(`Un des tags n'existe pas`);
          }

          if (typeof tags !== 'undefined' && tags.length > 0) {
            return productDb.setTags(tagsIds, { transaction });
          }

          return null;
        })
        .then(() =>
          Q.all(
            optionsIds.map(optionId => Option.findOne({ where: { id: optionId }, transaction }))
          )
        )
        .then(optionsDb => {
          if (optionsDb.some(opt => opt === null)) {
            throw Boom.notFound(`Une des options n'existe pas`);
          }

          if (typeof options !== 'undefined') {
            return productDb.setOptions(optionsIds, { transaction });
          }

          return null;
        })
        .catch(err => {
          if (productData.pictureUrl) {
            // We remove the image uploaded because the product was not updated.
            return mediaUtils
              .deleteImage(productData.pictureUrl)
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
        .then(() =>
          Product.findOne({
            where: { id: productDb.id },
            include: [
              { model: Tag, as: 'tags', through: { attributes: [] } },
              { model: Option, as: 'options', through: { attributes: [] } },
            ],
            transaction,
          })
        );

      return innerPromise;
    })
    .catch(err => {
      throw Boom.boomify(err);
    });

  return reply(promise);
}

function deleteProduct(request, reply) {
  const db = request.getDb();
  const { roleId } = request.auth.credentials;
  const { Product, UserRole } = db.getModels();

  const productId = request.params.productId;
  let productImg = null;

  if (roleId !== UserRole.ROLE_ADMIN) {
    return reply(Boom.forbidden(`Vous n'avez pas le droit de supprimer ce produit !`));
  }

  const promise = Product.findOne({ where: { id: productId } })
    .then(product => {
      if (!product) {
        throw Boom.notFound(`Le produit n'existe pas. Id : ${productId}`);
      }

      productImg = product.get('pictureUrl');

      return product.destroy();
    })
    .then(() => mediaUtils.deleteImage(productImg))
    .catch(err => {
      throw Boom.boomify(err);
    });

  return reply(promise);
}

function serveProductImg(request) {
  const { productId, fileName } = request.params;

  return `${config.get('/publicImgFolder')}/products/${productId}/${fileName}`;
}

function getProductsStocks(request, reply) {
  const db = request.getDb();
  const { page, category, name } = request.query;
  const { roleId } = request.auth.credentials;
  const { Product, UserRole, DayStock, Category } = db.getModels();
  const limit = 25;

  if (roleId !== UserRole.ROLE_ADMIN && roleId !== UserRole.ROLE_CHEF) {
    return reply(Boom.forbidden(`Vous n'avez pas le droit de consulter les stocks produit !`));
  }

  const now = moment().tz('Europe/Paris').set({ hour: 0, minute: 0, second: 0 }).toDate();
  const nowPlus7d = moment(now).set({ hour: 23, minute: 59, second: 59 }).add(7, 'days').toDate();

  const result = {};
  const where = {};
  const whereCat = {};

  if (typeof category !== 'undefined') {
    whereCat.id = category;
  }

  if (typeof name !== 'undefined') {
    where.title = {
      $iLike: `%${name.toLowerCase()}%`,
    };
  }

  const promise = Product.findAll({
    attributes: ['id', 'title', 'pictureUrl', 'currentStock'],
    include: [
      {
        model: DayStock,
        as: 'stocks',
        separate: true,
        where: { date: { $between: [now, nowPlus7d] } },
      },
      { model: Category, as: 'category', where: whereCat },
    ],
    where,
    limit,
    offset: (page - 1) * limit,
  })
    .then(products => {
      const results = [];

      products.forEach(productDb => {
        const product = productDb.toJSON();

        if (product.stocks.length < 7) {
          const currentDate = moment().tz('Europe/Paris');

          for (let i = 0; i < 7; i += 1) {
            let stock = product.stocks.find(s => s.date === currentDate.toDate());

            if (!stock) {
              stock = {
                stock: 0,
                active: false,
                date: currentDate.toDate(),
              };

              product.stocks.push(stock);
            }

            currentDate.add(1, 'days');
          }
        }

        results.push(product);
      });

      return results;
    })
    .then(products => {
      result.rows = products;

      return Product.count({
        distinct: true,
        col: 'Product.id',
        include: [{ model: Category, as: 'category', where: whereCat }],
        where,
      });
    })
    .then(count => {
      result.count = count;

      return result;
    })
    .catch(err => {
      Boom.boomify(err);
    });

  return reply(promise);
}

function getProductStocks(request, reply) {
  const db = request.getDb();
  const productId = request.params.productId;
  const { roleId } = request.auth.credentials;
  const { Product, UserRole, DayStock, Category } = db.getModels();

  if (roleId !== UserRole.ROLE_ADMIN && roleId !== UserRole.ROLE_CHEF) {
    return reply(Boom.forbidden(`Vous n'avez pas le droit de consulter les stocks produit !`));
  }

  const now = moment().tz('Europe/Paris').set({ hour: 0, minute: 0, second: 0 }).toDate();
  const nowPlus7d = moment(now).set({ hour: 23, minute: 59, second: 59 }).add(7, 'days').toDate();

  const promise = Product.findOne({
    where: { id: productId },
    attributes: ['id', 'title', 'pictureUrl', 'currentStock'],
    include: [
      {
        model: DayStock,
        as: 'stocks',
        where: { date: { $between: [now, nowPlus7d] } },
      },
      { model: Category, as: 'category' },
    ],
  })
    .then(product => {
      if (!product) {
        throw Boom.notFound(`Le produit demandé n'existe pas. Id : ${productId}`);
      }

      if (product.stocks.length < 7) {
        const currentDate = moment().tz('Europe/Paris').add(1, 'days');

        for (let i = 0; i < 7; i += 1) {
          let stock = product.stocks.find(s => s.date === currentDate.toDate());

          if (!stock) {
            stock = {
              stock: 0,
              active: false,
              date: currentDate.toDate(),
            };
            product.stocks = stock;
          }

          currentDate.add(1, 'days');
        }
      }
      return product;
    })
    .catch(err => {
      throw Boom.boomify(err);
    });

  return reply(promise);
}

function updateProductsStocks(request, reply) {
  const db = request.getDb();
  const { roleId } = request.auth.credentials;
  const productsData = request.payload;
  const { Product, UserRole, DayStock } = db.getModels();

  if (roleId !== UserRole.ROLE_ADMIN) {
    return reply(Boom.forbidden(`Vous n'avez pas le droit de modifier les stocks produits !`));
  }

  const promises = productsData.map(product => {
    // We loop the different products sent for update.
    const loopPromise = Product.findOne({ where: { id: product.id } }).then(productDb => {
      if (!productDb) {
        throw Boom.notFound(`Le produit demandé n'existe pas. Id : ${product.id}.`);
      }

      // We loop on each stock of product.
      const stockPromises = product.stocks.map(stock => {
        let promiseStock = null;

        if (stock.id) {
          promiseStock = DayStock.findOne({
            where: { id: stock.id, productId: product.id },
          }).then(stockDb => {
            if (!stockDb) {
              throw Boom.notFound(
                `Le stock que vous essayez de modifier n'existe pas. Id : ${stock.id}.`
              );
            }

            return true;
          });
        } else {
          // Auto resolve promise.
          promiseStock = Q(true);
        }

        return promiseStock.then(() => {
          const dateMin = moment(stock.date)
            .set({ hour: 0, minute: 0, second: 0 })
            .tz('Europe/Paris')
            .toDate();
          const dateMax = moment(stock.date)
            .set({ hour: 23, minute: 59, second: 59 })
            .tz('Europe/Paris')
            .toDate();
          const where = { date: { $between: [dateMin, dateMax] }, productId: product.id };

          if (stock.id) {
            where.id = {
              $ne: stock.id,
            };
          }

          // We check if there is another DayStock with the same date for the current product.
          return DayStock.findOne({
            where,
          }).then(otherStockDb => {
            if (otherStockDb) {
              throw Boom.conflict(
                `A stock already exists for the day mentioned. Date : ${stock.date}.`
              );
            }

            const fields = ['active', 'stock'];

            if (stock.id) {
              fields.push('id');
              fields.push('date');
              fields.push('productId');
              stock.productId = product.id;
            }

            return DayStock.upsert(stock, { fields });
          });
        });
      });

      return Q.all(stockPromises);
    });

    return loopPromise;
  });

  const promise = Q.all(promises).catch(err => {
    throw Boom.boomify(err);
  });

  return reply(promise);
}

function updateProductStocks(request, reply) {
  const db = request.getDb();
  const { roleId } = request.auth.credentials;
  const productId = request.params.productId;
  const stocksData = request.payload;
  const { Product, UserRole, DayStock } = db.getModels();

  if (roleId !== UserRole.ROLE_ADMIN) {
    return reply(Boom.forbidden(`Vous n'avez pas le droit de modifier les stocks du produit !`));
  }

  const promises = Product.findOne({ where: { id: productId } }).then(productDb => {
    if (!productDb) {
      throw Boom.notFound(`Le produit demandé n'existe pas. Id : ${productId}.`);
    }

    const stockPromises = stocksData.map(stock => {
      let promiseStock = null;

      if (stock.id) {
        promiseStock = DayStock.findOne({
          where: { id: stock.id, productId },
        }).then(stockDb => {
          if (!stockDb) {
            throw Boom.notFound(
              `Le stock que vous essayez de modifier n'existe pas. Id : ${stock.id}.`
            );
          }
        });
      } else {
        // Auto resolve promise.
        promiseStock = Q(true);
      }

      return promiseStock.then(() => {
        const dateMin = moment(stock.date)
          .set({ hour: 0, minute: 0, second: 0 })
          .tz('Europe/Paris')
          .toDate();
        const dateMax = moment(stock.date)
          .set({ hour: 23, minute: 59, second: 59 })
          .tz('Europe/Paris')
          .toDate();
        const where = { date: { $between: [dateMin, dateMax] }, productId };

        if (stock.id) {
          where.id = {
            $ne: stock.id,
          };
        }

        // We check if there is another DayStock with the same date for the current product.
        return DayStock.findOne({
          where,
        }).then(otherStockDb => {
          if (otherStockDb) {
            throw Boom.conflict(
              `A stock already exists for the day mentioned. Date : ${stock.date}.`
            );
          }

          const fields = ['active', 'stock'];

          if (stock.id) {
            fields.push('id');
            fields.push('date');
            fields.push('productId');
            stock.productId = productId;
          }

          return DayStock.upsert(stock, { fields });
        });
      });
    });
    return Q.all(stockPromises);
  });

  const promise = Q.all(promises).catch(err => {
    throw Boom.boomify(err);
  });

  return reply(promise);
}
