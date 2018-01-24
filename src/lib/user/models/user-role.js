'use strict';

module.exports = (sequelize, DataTypes) => {
  const UserRole = sequelize.define(
    'UserRole',
    {
      label: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
          notEmpty: true,
        },
      },
    },
    {
      tableName: 'UserRole',
    }
  );

  // Defines constants.
  UserRole.ROLE_USER = 1;
  UserRole.ROLE_ADMIN = 2;
  UserRole.ROLE_CHEF = 3;

  return UserRole;
};
