'use strict';

module.exports = (sequelize, { BOOLEAN, STRING, DATE, VIRTUAL }) => {
  const User = sequelize.define(
    'User',
    {
      email: {
        type: STRING(120),
        allowNull: true,
        unique: true,
        validate: {
          isEmail: true,
          notEmpty: true,
          len: [1, 120],
        },
      },
      password: {
        type: STRING(60),
        allowNull: true,
        validate: {
          len: 60,
        },
      },
      lastname: {
        type: STRING(100),
        allowNull: false,
        validate: {
          notEmpty: true,
          len: [1, 100],
        },
      },
      firstname: {
        type: STRING(100),
        allowNull: false,
        validate: {
          notEmpty: true,
          len: [1, 100],
        },
      },
      username: {
        type: STRING(100),
        allowNull: true,
        unique: true,
        validate: {
          notEmpty: true,
          len: [1, 100],
        },
      },
      deleted: {
        type: BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      // Code the user will give in order to become the sponsor of another user.
      sponsorshipCode: {
        type: STRING(20),
        allowNull: true,
        unique: true,
        validate: {
          notEmpty: true,
        },
      },
      // Code of the user's sponsor.
      sponsorCode: {
        type: STRING(20),
        allowNull: true,
        validate: {
          notEmpty: true,
        },
      },
      // used for password recovery
      recoveryToken: {
        type: STRING,
        allowNull: true,
      },
      // token expiration used for password recovery
      tokenExpiration: {
        type: DATE,
        allowNull: true,
      },
    },
    {
      tableName: 'User',
      classMethods: {
        associate(db) {
          this.belongsTo(db.UserRole, { as: 'role', foreignKey: 'roleId' });
          this.hasMany(db.UserBan, { as: 'bans', foreignKey: 'userId', onDelete: 'cascade' });

          this.hasMany(db.Telephone, { as: 'phones', foreignKey: 'userId', onDelete: 'cascade' });
          this.hasMany(db.Address, { as: 'addresses', foreignKey: 'userId', onDelete: 'cascade' });
          this.hasMany(db.SponsorshipDiscount, {
            as: 'sponsorshipDiscounts',
            foreignKey: 'userId',
            onDelete: 'cascade',
          });
          this.hasMany(db.Order, { as: 'orders', foreignKey: 'userId', onDelete: 'cascade' });
        },
      },
      getterMethods: {
        publicData() {
          const data = {
            id: this.id,
            email: this.email,
            firstname: this.firstname,
            lastname: this.lastname,
            sponsorshipCode: this.sponsorshipCode,
            sponsorCode: this.sponsorCode,
          };

          if (this.roleId) {
            data.roleId = this.roleId;
          }

          return data;
        },
      },
    }
  );

  return User;
};
