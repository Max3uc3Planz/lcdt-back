'use strict';

module.exports = (sequelize, { INTEGER, DATE, BOOLEAN }) => {
  const DayStock = sequelize.define(
    'DayStock',
    {
      stock: {
        type: INTEGER,
        allowNull: false,
        defaultValue: 0,
        validate: {
          isInt: true,
          min: 0,
        },
      },
      date: {
        type: DATE,
        allowNull: false,
        validate: {
          isDate: true,
        },
      },
      active: {
        type: BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
    },
    {
      tableName: 'DayStock',
      classMethods: {
        associate({ Product }) {
          this.belongsTo(Product, { as: 'product', foreignKey: 'productId' });
        },
      },
    }
  );

  return DayStock;
};
