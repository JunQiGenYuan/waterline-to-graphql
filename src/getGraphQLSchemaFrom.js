import _ from 'lodash';
import {
  GraphQLBoolean, GraphQLFloat, GraphQLInt, GraphQLList, GraphQLNonNull, GraphQLObjectType, GraphQLSchema, GraphQLString,
  GraphQLInterfaceType, GraphQLInputObjectType
}
from 'graphql';

function waterlineTypesToGraphQLType(attribute) {
  switch(attribute.type) {
    case 'string':
      return GraphQLString;
    case 'integer':
      return GraphQLInt;
    case 'boolean':
      return GraphQLBoolean;
    case 'float':
      return GraphQLFloat;
    default:
      return GraphQLString;
  }
}

function getFindArgsForWaterlineModel(modelID, GraphQLSchemaManager) {
  return {
    where: {
      name: 'criteria',
      type: GraphQLSchemaManager.findArgsTypes[modelID]
    },
    sort: {
      name: 'sort',
      type: GraphQLString
    },
    skip: {
      name: 'skip',
      type: GraphQLInt
    },
    limit: {
      name: 'limit',
      type: GraphQLInt
    }
  };
}

function createGraphQLTypeForWaterlineModel(model, modelID, Node, GraphQLSchemaManager) {
  var attributes = model._attributes;
  return new GraphQLObjectType({
    name: modelID,
    description: model.description,
    interfaces: [Node],
    fields: () => {
      var convertedFields = {};
      _.mapKeys(attributes, function(attribute, key) {
        if(attribute.type) {
          var field = {
            type: waterlineTypesToGraphQLType(attribute),
            description: attribute.description
          };
          convertedFields[key] = field;
        }
      });
      var idField = {
        type: new GraphQLNonNull(GraphQLString)
      };
      var typeField = {
        type: new GraphQLNonNull(GraphQLString)
      };
      convertedFields.id = idField;
      convertedFields.type = typeField;

      var associations = model.associations;
      associations.forEach((association) => {
        if(association.model) {
          convertedFields[association.alias] = {
            type: GraphQLSchemaManager.types[association.model],
            description: association.description,
            resolve: (obj/*, args */ ) => {
              return GraphQLSchemaManager.queries[association.model][association.model].resolve(obj, {
                where: {
                  id: obj[association.alias].id || obj[association.alias]
                }
              });
            }
          };
        } else if(association.collection) {
          convertedFields[association.collection + 's'] = {
            type: new GraphQLList(GraphQLSchemaManager.types[association.collection]),
            description: association.description,
            args: getFindArgsForWaterlineModel(association.collection, GraphQLSchemaManager),
            resolve: (obj, args ) => {
              var associationCriteria = {};
              associationCriteria[association.via] = obj.id;
              // override association's value in where criterial
              var criteria = Object.assign({}, args, {
                where: Object.assign({}, args.where, associationCriteria)
              });
              return GraphQLSchemaManager.queries[association.collection][association.collection + 's'].resolve(obj, criteria);
            }
          };
        }
      });
      return convertedFields;
    }
  });
}

function createFindArgsTypeForWaterlineModel(model, modelID, Node, GraphQLSchemaManager) {
  var attributes = model._attributes;
  return new GraphQLInputObjectType({
    name: `${modelID}Args`,
    description: model.description,
    interfaces: [Node],
    fields: () => {
      var convertedFields = {};
      _.mapKeys(attributes, function(attribute, key) {
        if(attribute.type) {
          var field = {
            type: waterlineTypesToGraphQLType(attribute),
            description: attribute.description
          };
          convertedFields[key] = field;
        }
      });
      var idField = {
        type: GraphQLString
      };
      var typeField = {
        type: GraphQLString
      };
      convertedFields.id = idField;
      convertedFields.type = typeField;

      var associations = model.associations;
      // TODO: how to search that records contains someof collection matched
      associations.forEach((association) => {
        var field = {
          type: GraphQLString,
          description: association.description
        };
        convertedFields[association.alias] = field;
      });
      // associations.forEach((association) => {
      //   if(association.model) {
      //     convertedFields[association.alias] = {
      //       type: GraphQLSchemaManager.types[association.model],
      //       description: association.description,
      //       resolve: (obj, /* args */ ) => {
      //         return GraphQLSchemaManager.queries[association.model][association.model].resolve(obj, {
      //           where: {
      //             id: obj[association.alias].id || obj[association.alias]
      //           }
      //         });
      //       }
      //     };
      //   } else if(association.collection) {
      //     convertedFields[association.collection + 's'] = {
      //       type: new GraphQLList(GraphQLSchemaManager.types[association.collection]),
      //       description: association.description,
      //       args: getFindArgsForWaterlineModel(association.collection, GraphQLSchemaManager),
      //       resolve: (obj, /* args */ ) => {
      //         var associationCriteria = {};
      //         associationCriteria[association.via] = obj.id;
      //         // override association's value in where criterial
      //         var criteria = Object.assign({}, args, {
      //           where: Object.assign({}, args.where, associationCriteria)
      //         });
      //         return GraphQLSchemaManager.queries[association.collection][association.collection + 's'].resolve(obj, criteria);
      //       }
      //     };
      //   }
      // });
      return convertedFields;
    }
  });
}

function createGraphQLQueries(waterlineModel, graphqlType, modelID, GraphQLSchemaManager) {
  var queries = {};
  // query to get by id
  queries[modelID] = {
    type: graphqlType,
    args: {
      id: {
        name: 'id',
        type: new GraphQLNonNull(GraphQLString)
      }
    },
    resolve: (obj, {where, id}) => {
      return waterlineModel.findOne({
        id: id || (where && where.id)
      }).then(function(result) {
        return result;
      });
    }
  };
  // query to find based on search criteria
  queries[modelID + 's'] = {
    type: new GraphQLList(graphqlType),
    args: getFindArgsForWaterlineModel(modelID, GraphQLSchemaManager),
    resolve: (obj, criteria) => {
      return waterlineModel.find(criteria).then(function(results) {
        return results;
      });
    }
  };

  return queries;
}

function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

function createGraphQLMutations(waterlineModel, graphqlType, modelID, GraphQLSchemaManager) {
  var mutations = {};
  var attributes = waterlineModel._attributes;
  var convertedFields = {};
  _.mapKeys(attributes, function(attribute, key) {
    if(attribute.type) {
      var field = {
        type: waterlineTypesToGraphQLType(attribute),
        description: attribute.description
      };
      convertedFields[key] = field;
    }
  });
  /*var associations = waterlineModel.associations;
  associations.forEach((association) => {
    if(association.model) {
      convertedFields[association.alias] = {
        type: new GraphQLInputObjectType(
           GraphQLSchemaManager.types[association.model]),
        name: association.alias
      };
    } else if(association.collection) {
      convertedFields[association.collection + 's'] = {
        type: new GraphQLInputObjectType(
           GraphQLSchemaManager.types[association.collection]),
        name: association.alias
      };
    }
  });*/

 /* var associations = waterlineModel.associations;
  associations.forEach((association) => {
    if(association.model) {
      convertedFields[association.alias] = {
        type: new GraphQLInputObjectType(
           GraphQLSchemaManager.types[association.model]),
        name: 'create' + modelID + association.alias,
        resolve: GraphQLSchemaManager.waterlineModels[association.model].create
      };
    } else if(association.collection) {
      convertedFields[association.collection + 's'] = {
        type: new GraphQLInputObjectType(
           GraphQLSchemaManager.types[association.collection]),
        name: 'create' + modelID + association.alias,
        resolve: GraphQLSchemaManager.waterlineModels[association.collection].create
      };
    }
  });*/

  const wrapResolve = resolve => (obj, args) => resolve(args);

  mutations['create' + capitalizeFirstLetter(modelID)] = {
    type: graphqlType,
    args: convertedFields,
    resolve: wrapResolve(waterlineModel.create),
    name: 'create' + modelID
  };

  mutations['update' + capitalizeFirstLetter(modelID)] = {
    type: graphqlType,
    args: convertedFields,
    resolve: wrapResolve(waterlineModel.update),
    name: 'update' + modelID
  };

  mutations['delete' + capitalizeFirstLetter(modelID)] = {
    type: graphqlType,
    args: convertedFields,
    resolve: wrapResolve(waterlineModel.delete),
    name: 'delete' + modelID
  };

  return mutations;
}

export default function getGraphQLSchemaFrom(models) {
  if (!models) {
    throw new Error('Invalid input args models is' + models);
  }

  var GraphQLSchemaManager = {
    types: {},
    findArgsTypes: {},
    queries: {},
    connectionTypes: {},
    mutations: {},
    waterlineModels: models
  };

  const Node = new GraphQLInterfaceType({
    name: 'Node',
    description: 'An object with an ID',
    fields: () => ({
      id: {
        type: new GraphQLNonNull(GraphQLString),
        description: 'The global unique ID of an object'
      },
      type: {
        type: new GraphQLNonNull(GraphQLString),
        description: 'The type of the object'
      }
    }),
    resolveType: (obj) => {
      return obj.type;
    }
  });

  let nodeField = {
    name: 'Node',
    type: Node,
    description: 'A node interface field',
    args: {
      id: {
        type: new GraphQLNonNull(GraphQLString),
        description: 'Id of node interface'
      }
    },
    resolve: (obj, {
      id
    }) => {
      var keys = _.keys(GraphQLSchemaManager);
      var allFinds = keys.map(function(key) {
        var obj = GraphQLSchemaManager[key];
        return obj.model.find({
          id: id
        });
      });
      return Promise.all(allFinds).then(function(values) {
        var foundIndex = -1;
        var foundObjs = values.find(function(value, index) {
          if(value.length == 1) {
            foundIndex = index;
            return true;
          }
        });
        foundObjs[0].type = GraphQLSchemaManager[keys[foundIndex]].type;
        return foundObjs[0];
      });
    }
  };



  _.each(models, function eachInstantiatedModel(thisModel, modelID) {
    GraphQLSchemaManager.types[modelID] = createGraphQLTypeForWaterlineModel(thisModel, modelID, Node,
      GraphQLSchemaManager);
    GraphQLSchemaManager.findArgsTypes[modelID] = createFindArgsTypeForWaterlineModel(thisModel, modelID, Node, GraphQLSchemaManager);
    GraphQLSchemaManager.queries[modelID] = createGraphQLQueries(thisModel, GraphQLSchemaManager.types[modelID],
      modelID, GraphQLSchemaManager);
  });


  _.each(models, function eachInstantiatedModel(thisModel, modelID) {
    GraphQLSchemaManager.mutations[modelID] = createGraphQLMutations(thisModel, GraphQLSchemaManager.types[modelID],
      modelID, GraphQLSchemaManager);
  });


  var queryType = new GraphQLObjectType({
    name: 'Query',
    fields: () => {
      return _.reduce(GraphQLSchemaManager.queries, function(total, obj, key) {
        return _.merge(total, obj);
      }, {
        node: nodeField
      });
    }
  });

  var mutationFields = _.reduce(GraphQLSchemaManager.mutations, function(total, obj, key) {
    return _.merge(total, obj);
  });

  var mutationType = new GraphQLObjectType({
    name: 'Mutation',
    fields: mutationFields
  });

  var schema = new GraphQLSchema({
    query: queryType,
    mutation: mutationType
  });

  return schema;
}
