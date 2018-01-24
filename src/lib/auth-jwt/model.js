'use strict';

module.exports = function blTokenExport(sequelize, DataTypes) {
  const BlacklistToken = sequelize.define(
    'BlacklistToken',
    {
      expire: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      token: {
        type: DataTypes.TEXT,
        allowNull: false,
        validate: {
          notEmpty: true,
        },
      },
    }
  );

  return BlacklistToken;
};
