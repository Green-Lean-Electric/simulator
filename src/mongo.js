const DEFAULT_URL = 'mongodb://localhost';

function connect(url) {
    const mongoClient = require('mongodb').MongoClient;
    const fullUrl = (url
            ? url
            : DEFAULT_URL
    );

    return mongoClient.connect(fullUrl).catch(error => console.log(error));
}

function operate(url, databaseName, collectionName, operation) {
    return connect(url)
        .then(client => {
                return {
                    client: client,
                    database: client.db(databaseName)
                };
            }
        ).then(({client: client, database: database}) => {
                return {
                    client: client,
                    result: operation(database.collection(collectionName))
                };
            }
        ).then(({client: client, result: result}) => {
            client.close();
            return result;
        });
}

exports.insertOne = function (url, databaseName, collectionName, object) {
    return operate(url, databaseName, collectionName, collection => collection.insertOne(object)).then(result => result.ops);
};

exports.find = function (url, databaseName, collectionName, predicate) {
    return operate(url, databaseName, collectionName, collection => collection.find(predicate).toArray());
};

exports.count = function (url, databaseName, collectionName) {
    return operate(url, databaseName, collectionName, collection => collection.count());
};

exports.updateOne = function (url, databaseName, collectionName, object, updateOperations) {
    return operate(url, databaseName, collectionName, collection => collection.updateOne(object, updateOperations).then(result => result.result.nModified));
};