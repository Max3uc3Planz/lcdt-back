'use strict';

module.exports = (sequelize, { STRING, TEXT, FLOAT, INTEGER }) => {
  const Product = sequelize.define(
    'Product',
    {
      title: {
        type: STRING,
        allowNull: false,
        validate: {
          notEmpty: true,
        },
      },
      description: {
        type: TEXT,
        allowNull: true,
      },
      shortDescription: {
        type: TEXT,
        allowNull: true,
      },
      price: {
        type: FLOAT,
        allowNull: false,
        validate: {
          isFloat: true,
          min: 0,
        },
      },
      priceTax: {
        type: FLOAT,
        allowNull: false,
        validate: {
          isFloat: true,
          min: 0,
        },
      },
      pictureUrl: {
        type: STRING,
        allowNull: true,
      },
      ingredients: {
        type: TEXT,
        allowNull: true,
      },
      preparation: {
        type: TEXT,
        allowNull: true,
      },
      personsNb: {
        type: INTEGER,
        allowNull: false,
        defaultValue: 1,
        validate: {
          min: 1,
          isInt: true,
        },
      },
      currentStock: {
        type: INTEGER,
        allowNull: false,
        defaultValue: 0,
        validate: {
          min: 0,
          isInt: true,
        },
      },
    },
    {
      tableName: 'Product',
      classMethods: {
        associate({ Tag, DayStock, Category, Option }) {
          this.belongsToMany(Option, {
            as: 'options',
            through: 'ProductsOptions',
            foreignKey: 'productId',
          });
          this.belongsToMany(Tag, { as: 'tags', through: 'ProductsTags', foreignKey: 'productId' });
          this.hasMany(DayStock, { as: 'stocks', foreignKey: 'productId' });
          this.belongsTo(Category, { as: 'category', foreignKey: 'categoryId' });
        },
      },
    }
  );

  return Product;
};
