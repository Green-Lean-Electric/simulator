function insertProsumer() {
    const email = 'myMail';
    const password = 'myPassword';
    require('../services')
        .insertProsumer(email, password)
        .then(() => require('../mongo.js').find(undefined, 'greenleanelectrics', 'prosumers')
            .then(result => {
                if (result[0].email === email && result[0].password === password) {
                    console.log("Insert Prosumer: OK")
                } else {
                    throw {
                        expected: {
                            email,
                            password
                        },
                        found: result[0]
                    }
                }
            })
        );
}

function connectProsumer() {
    const email = 'myMail';
    const password = 'myPassword';
    const services = require('../services');

    services.insertProsumer(email, password)
        .then(() => services.connectProsumer(email, password)
            .then(() => console.log("Connect Prosumer: OK"))
        );
}

function disconnectProsumer() {
    const databaseName = 'greenleanelectrics';
    const collectionName = 'prosumers';

    const email = 'myMail';
    const password = 'myPassword';
    const token = '123456789';

    const mongo = require('../mongo.js');
    const services = require('../services');

    mongo.insertOne(undefined, databaseName, collectionName, {email, password, token})
        .then(() => services.disconnectProsumer(token)
            .then(() => console.log("Disconnect Prosumer: OK"))
        );
}

connectProsumer();
disconnectProsumer();