'use strict';

module.exports = (sequelize, { STRING, FLOAT, INTEGER, DATE, BOOLEAN }) => {
  const PromotionalCode = sequelize.define(
    'PromotionalCode',
    {
      code: {
        type: STRING,
        allowNull: false,
        validate: {
          notEmpty: true,
          isAlphanumeric: true,
        },
      },
      amount: {
        type: FLOAT,
        allowNull: true,
        validate: {
          min: 0,
          isFloat: true,
        },
      },
      amountTax: {
        type: FLOAT,
        allowNull: true,
        validate: {
          min: 0,
          isFloat: true,
        },
      },
      amountPercentage: {
        type: FLOAT,
        allowNull: true,
        validate: {
          min: 0,
          isFloat: true,
        },
      },
      usageLimit: {
        type: INTEGER,
        allowNull: true,
      },
      expirationDate: {
        type: DATE,
        allowNull: true,
      },
      firstOrderOnly: {
        type: BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
    },
    {
      tableName: 'PromotionalCode',
      classMethods: {
        associate({ PromotionalCodeType, Order }) {
          this.belongsTo(PromotionalCodeType, {
            as: 'type',
            foreignKey: 'typeId',
          });

          this.hasMany(Order, { as: 'orders', foreignKey: 'promotionalCodeId' });
        },
      },
    }
  );

  return PromotionalCode;
};
