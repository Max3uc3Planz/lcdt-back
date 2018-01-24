'use strict';

module.exports = (sequelize, { STRING }) => {
  const Tag = sequelize.define(
    'Tag',
    {
      label: {
        type: STRING,
        allowNull: false,
        validate: {
          notEmpty: true,
        },
      },
      iconUrl: {
        type: STRING,
        allowNull: true,
      },
    },
    {
      tableName: 'Tag',
      classMethods: {
        associate({ Product }) {
          this.belongsToMany(Product, {
            as: 'products',
            through: 'ProductsTags',
            foreignKey: 'tagId',
          });
        },
      },
    }
  );

  return Tag;
};
