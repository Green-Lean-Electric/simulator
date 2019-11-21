const gaussianFunction = (expectedValue, standardValue, x) => (
    1.0 / (standardValue * Math.sqrt(2 * Math.PI))
    * Math.exp(
        -Math.pow(x - expectedValue, 2)
        / (2 * Math.pow(standardValue, 2))
    )
);

const DATABASE_NAME = 'greenleanelectrics';

exports.getWindSpeed = function (date) {
    function floor(x) {
        const maxDecimals = 0;
        const coefficient = Math.pow(10, maxDecimals);
        return Math.floor(x * coefficient) / coefficient;
    }


    const windPointsNumber = 1000;
    const maxWindSpeed = 2000;

    const yearStart = new Date(date.getFullYear(), 0).getTime();
    const yearEnd = new Date(date.getFullYear(), 11, 31).getTime();
    const hoursInYear = (yearEnd - yearStart) / 1000 / 60 / 60;

    const dateSinceStartOfYear = (date.getTime() - yearStart) / 1000 / 60 / 60;

    const step = hoursInYear / 8;
    let windSpeed = [...Array(windPointsNumber).keys()]
        .map(point => point * step)
        .map(point => maxWindSpeed
            * (1 + Math.cos(dateSinceStartOfYear))
            * gaussianFunction(0, 8000, dateSinceStartOfYear - point * Math.cos(dateSinceStartOfYear)))
        .reduce((accumulator, currentValue) => accumulator + currentValue);

    const windSpeedAsJson = {
        windSpeed: floor(windSpeed),
        date: date
    };

    require('./mongo.js').insertOne(undefined, DATABASE_NAME, 'windSpeed', windSpeedAsJson);

    return windSpeedAsJson;
};

exports.getWholeElectricityConsumption = function (date) {

    const dailyConsumptionPerPerson = 27;

    const morningConsumption = 21;
    const afternoonConsumption = dailyConsumptionPerPerson - morningConsumption;

    const databaseName = DATABASE_NAME;
    const collectionName = 'prosumers';
    return require('./mongo.js').count(undefined, databaseName, collectionName).then((count) => {
        return getElectricityConsumption(date, morningConsumption, afternoonConsumption, count);
    });

};

function getElectricityConsumption(date, morningConsumption, afternoonConsumption, people){ //TODO : Check, je pense que cela get la consommation a la seconde près dans la date pas celle du jours, quest ce qu'on veut nous ?

    const hours = date.getHours();
    const minutes = date.getMinutes();
    const seconds = date.getSeconds();

    const currentTimestamp = hours * 3600 + minutes * 60 + seconds;

    const morningTopTimestamp = 11 * 3600;
    const afternoonTopHourTimestamp = 19 * 3600 + 30 * 60;

    let electricityConsumption = {
        "electricityConsumption":
            (
                gaussianFunction(
                    morningTopTimestamp,
                    21600,
                    currentTimestamp
                ) * morningConsumption
                + gaussianFunction(
                    afternoonTopHourTimestamp,
                    5400,
                    currentTimestamp
                ) * afternoonConsumption
            ) * people
    };

    require('./mongo.js').insertOne(undefined, DATABASE_NAME, 'consumption', electricityConsumption);

    return electricityConsumption;
}

exports.getCurrentElectricityPrice = async function (date) {
    const windSpeedCoeff = -1;
    const consumptionCoeff = 500;

    const maxPrice = 2;
    const minPrice = 1;

    const electricityConsumption = (await exports.getWholeElectricityConsumption(date)).electricityConsumption;
    const windSpeed = exports.getWindSpeed(new Date()).windSpeed;

    const price = Math.max(
        Math.min(
            consumptionCoeff * electricityConsumption + windSpeedCoeff * Math.log(windSpeed),
            maxPrice
        ),
        minPrice
    );

    const priceAsJson = {
        currentElectricityPrice: price,
        date: date
    };

    require('./mongo.js').insertOne(undefined, DATABASE_NAME, 'currentPrice', priceAsJson);

    return priceAsJson;
};

// DataBase
exports.insertProsumer = function (email, password) {
    const databaseName = DATABASE_NAME;
    const collectionName = 'prosumers';
    const prosumer = {email, password};

    return require('./mongo.js')
        .insertOne(undefined, databaseName, collectionName, prosumer);
};

exports.connectProsumer = function (email, password) {
    const databaseName = DATABASE_NAME;
    const collectionName = 'prosumers';

    const prosumer = {
        email,
        password
    };
    const token = generateToken();
    const updateOperation = {$set: {token}};

    return require('./mongo.js')
        .updateOne(undefined, databaseName, collectionName, prosumer, updateOperation)
        .then(() => {
            console.log(`User connected with token '${token}'`);
            return token;
        });
};

exports.disconnectProsumer = function (token) {
    const databaseName = DATABASE_NAME;
    const collectionName = 'prosumers';
    const prosumer = {
        token
    };
    const updateOperation = {$set: {token: null}};

    return require('./mongo.js')
        .updateOne(undefined, databaseName, collectionName, prosumer, updateOperation)
        .then(() => {
            console.log(`User connected with token '${token}' has been disconnected`);
            return token;
        });
};

function generateToken () {
    const crypto = require("crypto");
    return crypto.randomBytes(16).toString("hex");
}

exports.getProsumerElectricityConsumption = function (token, date){
    const databaseName = 'greenleanelectrics';
    const collectionName = 'prosumers';

    var dailyConsumptionPerPerson = 27;
    var morningConsumption = 21;
    var afternoonConsumption = dailyConsumptionPerPerson - morningConsumption;

    const prosumertoken = {
        token
    };

    return require('./mongo.js')
        .find(undefined, databaseName, collectionName, prosumertoken)
        .then((resultats) => {
            var changing_value = resultats[0].email.length ;

            if (resultats[0].email.length % 2 === 0)
                changing_value = -changing_value;

            dailyConsumptionPerPerson += changing_value/8;
            morningConsumption += changing_value/10;

            return getElectricityConsumption(date, morningConsumption, afternoonConsumption, 1);
        });

};