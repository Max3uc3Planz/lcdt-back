'use strict';

module.exports = (sequelize, { STRING }) => {
  const PromotionalCodeType = sequelize.define(
    'PromotionalCodeType',
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
      tableName: 'PromotionalCodeType',
    }
  );

  // Defines contants
  PromotionalCodeType.PER_USER = 1;
  PromotionalCodeType.GLOBAL = 2;

  return PromotionalCodeType;
};
