'use strict';

module.exports = (sequelize, { STRING, FLOAT, INTEGER, TEXT }) => {
  const OrderItem = sequelize.define(
    'OrderItem',
    {
      name: {
        type: STRING,
        allowNull: false,
        validate: {
          notEmpty: true,
        },
      },
      shortDescription: {
        type: TEXT,
        allowNull: true,
      },
      quantity: {
        type: INTEGER,
        allowNull: false,
        validate: {
          isInt: true,
          min: 1,
        },
      },
      total: {
        type: FLOAT,
        allowNull: false,
        validate: {
          isFloat: true,
          min: 0,
        },
      },
      totalTax: {
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
    },
    {
      tableName: 'OrderItem',
      classMethods: {
        associate({ Order, Product }) {
          this.belongsTo(Order, { as: 'order', foreignKey: 'orderId' });
          this.hasOne(Product, { as: 'product', foreignKey: 'productId' });
        },
      },
    }
  );

  return OrderItem;
};
