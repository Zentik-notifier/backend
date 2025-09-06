import { GraphQLScalarType, Kind } from 'graphql';

export const GraphQLJSON = new GraphQLScalarType({
  name: 'JSON',
  description: 'JSON custom scalar type',

  serialize(value) {
    return value;
  },

  parseValue(value) {
    return value;
  },

  parseLiteral(ast) {
    switch (ast.kind) {
      case Kind.STRING:
        return ast.value;
      case Kind.INT:
        return parseInt(ast.value, 10);
      case Kind.FLOAT:
        return parseFloat(ast.value);
      case Kind.BOOLEAN:
        return ast.value;
      case Kind.OBJECT:
        return ast.fields.reduce((obj, field) => {
          obj[field.name.value] = field.value;
          return obj;
        }, {});
      case Kind.LIST:
        return ast.values.map((n) => n);
      case Kind.NULL:
        return null;
      default:
        return null;
    }
  },
});
