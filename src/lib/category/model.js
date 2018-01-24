'use strict';

module.exports = (sequelize, { STRING, TEXT }) => {
  const Category = sequelize.define(
    'Category',
    {
      label: {
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
    },
    {
      tableName: 'Category',
      classMethods: {
        associate({ Product }) {
          this.hasMany(Product, { as: 'products', foreignKey: 'categoryId' });
        },
      },
    }
  );

  return Category;
};
