'use strict';

module.exports = (sequelize, { STRING }) => {
  const OrderStatus = sequelize.define(
    'OrderStatus',
    {
      label: {
        type: STRING,
        allowNull: false,
        validate: {
          notEmpty: true,
        },
      },
    },
    {
      tableName: 'OrderStatus',
      classMethods: {
        associate({ Order }) {
          this.hasMany(Order, { as: 'orders', foreignKey: 'statusId' });
        },
      },
    }
  );

  // Defines constants.
  OrderStatus.PENDING = 1;
  OrderStatus.PROCESSING = 2;
  OrderStatus.PACKING = 3;
  OrderStatus.DELIVERY = 4;
  OrderStatus.FINISHED = 5;
  OrderStatus.CANCELED = 6;

  return OrderStatus;
};
