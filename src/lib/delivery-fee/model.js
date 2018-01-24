'use strict';

module.exports = (sequelize, { STRING, FLOAT }) => {
  const DeliveryType = sequelize.define(
    'DeliveryType',
    {
      label: {
        type: STRING,
        allowNull: false,
        validate: {
          notEmpty: true,
        },
      },
      additionalCost: {
        type: FLOAT,
        allowNull: false,
        defaultValue: 0,
        validate: {
          min: 0,
          isFloat: true,
        },
      },
      additionalCostTax: {
        type: FLOAT,
        allowNull: false,
        defaultValue: 0,
        validate: {
          min: 0,
          isFloat: true,
        },
      },
    },
    {
      tableName: 'DeliveryType',
      classMethods: {
        associate({ TimeSlot }) {
          this.hasMany(TimeSlot, {
            as: 'slots',
            foreignKey: 'deliveryTypeId',
            onDelete: 'cascade',
          });
        },
      },
    }
  );

  // Defines constants.
  DeliveryType.EXPRESS = 1;
  DeliveryType.EARLY = 2;

  return DeliveryType;
};
