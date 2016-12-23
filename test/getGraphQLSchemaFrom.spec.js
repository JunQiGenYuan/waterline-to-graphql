import expect from 'expect';
import { getGraphQLSchemaFrom } from '../src/index';
import * as WaterlineHelper from './helpers/WaterlineHelper';
import { GraphQLSchema, graphql } from 'graphql';

const stringifyEqual = (actrueResult, expectResult) => {
  expect(JSON.stringify(actrueResult, expectResult) === JSON.stringify(expectResult)).toBe(true, () => `expect \n ${JSON.stringify(actrueResult, 4, 4)} \n to be \n ${JSON.stringify(expectResult, 4, 4)}`);
};

describe('getGraphQLSchemaFrom', function () {
  var models;
  before((done) => {
    WaterlineHelper.getWaterlineModels((err, result) => {
      models = result;
      WaterlineHelper.initializeModelsWithData(models).then(() => {
        done();
      });
    });
  });

  it('Invalid input args', () => {
    expect(() => getGraphQLSchemaFrom(undefined)).toThrow();
  });

  it('check schema', () => {
    let schema = getGraphQLSchemaFrom(models);
    expect(schema instanceof GraphQLSchema).toBe(true);
  });



  var res = {
    data: {
      users: [
        {
          firstName: 'John',
          lastName: 'Johnsson',
          posts: [
            {
              text: 'first post',
              comments: [
                {
                  text: 'first comment'
                }
              ]
            }
          ]
        }
      ]
    }
  };
  var resNoData = {
    data: {
      users: []
    }
  };
  var resNoPost = {
    data: {
      users: [
        {
          firstName: 'John',
          lastName: 'Johnsson',
          posts: []
        }
      ]
    }
  };

  it('initialize data and run nested query', (done) => {
    let schema = getGraphQLSchemaFrom(models);
    var query = '{ users{firstName,lastName posts{text,comments{text}}} }';
    return graphql(schema, query).then(result => {
      console.log('then', result);
      if (result && result.errors) {
        throw errors;
      }
      stringifyEqual(result, res);
      done();
    }).catch(done);
  });

  it('test search query exist data', (done) => {
    let schema = getGraphQLSchemaFrom(models);
    var query = '{ users(where: {firstName: "John"}){firstName,lastName posts{text,comments{text}}} }';
    return graphql(schema, query).then(result => {
      console.log('then', result);
      if (result && result.errors) {
        throw errors;
      }
      stringifyEqual(result, res);
      done();
    }).catch(done);
  });

  it('test search query no data', (done) => {
    let schema = getGraphQLSchemaFrom(models);
    var query = '{ users(where: {firstName: "No one"}){firstName,lastName posts{text,comments{text}}} }';
    return graphql(schema, query).then(result => {
      console.log('then', result);
      if (result && result.errors) {
        throw errors;
      }
      stringifyEqual(result, resNoData);
      done();
    }).catch(done);
  });

  it('test search sub collection query', (done) => {
    let schema = getGraphQLSchemaFrom(models);
    var query = '{ users(where: {firstName: "John"}){firstName,lastName posts(where: {text: "first post"}){text,comments{text}}} }';
    return graphql(schema, query).then(result => {
      console.log('then', result);
      if (result && result.errors) {
        throw errors;
      }
      stringifyEqual(result, res);
      done();
    }).catch(done);
  });

  it('test search sub collection query no data found', (done) => {
    let schema = getGraphQLSchemaFrom(models);
    var query = '{ users(where: {firstName: "John"}){firstName,lastName posts(where: {text: "not exist post"}){text,comments{text}}} }';
    return graphql(schema, query).then(result => {
      console.log('then', result);
      if (result && result.errors) {
        throw errors;
      }
      stringifyEqual(result, resNoPost);
      done();
    }).catch(done);
  });

  it('test createUser', (done) => {
    let schema = getGraphQLSchemaFrom(models);
    let mutations = 'mutation test{ createUser(firstName:"hello", lastName:"Hellosson", email: "hello@hellosson.com"){ firstName, lastName}}'
    graphql(schema, mutations)
      .then((result) => {
        stringifyEqual(result, {
          data: {
            createUser: {
              firstName: 'hello',
              lastName: 'Hellosson'
            }
          }
        });
        done();
      }).catch(done);
  });
});
