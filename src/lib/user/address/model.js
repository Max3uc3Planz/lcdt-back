'use strict';

module.exports = (sequelize, { STRING, FLOAT, BOOLEAN }) => {
  const Address = sequelize.define(
    'Address',
    {
      label: {
        type: STRING(50),
        allowNull: false,
        validate: {
          notEmpty: true,
          len: [1, 50],
        },
      },
      address1: {
        type: STRING(100),
        allowNull: false,
        validate: {
          notEmpty: true,
          len: [1, 100],
        },
      },
      city: {
        type: STRING(50),
        allowNull: false,
        validate: {
          notEmpty: true,
          len: [1, 50],
        },
      },
      zipcode: {
        type: STRING(10),
        allowNull: false,
        validate: {
          notEmpty: true,
          len: [1, 10],
        },
      },
      lat: {
        type: FLOAT,
        allowNull: false,
        validate: {
          isFloat: true,
          min: -90,
          max: 90,
        },
      },
      lng: {
        type: FLOAT,
        allowNull: false,
        validate: {
          isFloat: true,
          min: -180,
          max: 180,
        },
      },
      isMain: {
        type: BOOLEAN,
        allowNull: false,
        defaultValue: false,
        validate: {
          notEmpty: true,
        },
      },
      placeId: {
        type: STRING,
        allowNull: false,
        validate: {
          notEmpty: true,
        },
      },
    },
    {
      tableName: 'Address',
      classMethods: {
        associate(db) {
          this.belongsTo(db.User, { as: 'user', foreignKey: 'userId' });
        },
      },
    }
  );

  return Address;
};
