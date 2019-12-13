const database = require('../../utils/src/mongo');
const utils = require('../../utils/src/server');

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

    database.insertOne(DATABASE_NAME, 'windSpeed', windSpeedAsJson);

    return windSpeedAsJson;
};

exports.getElectricityConsumption = function (date, prosumerId) {
    const dailyConsumptionPerPerson = 2700; //Watt

    let morningConsumption = 2100;
    let afternoonConsumption = dailyConsumptionPerPerson - morningConsumption;

    let changing_value = prosumerId.length;

    if (prosumerId.length % 2 === 0) {
        changing_value = -changing_value;
    }

    afternoonConsumption += afternoonConsumption * changing_value / 100;
    morningConsumption += morningConsumption * changing_value / 100;

    return computeElectricityConsumption(date, morningConsumption, afternoonConsumption);
};

function computeElectricityConsumption(date, morningConsumption, afternoonConsumption) {
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
            )
    };

    database.insertOne(DATABASE_NAME, 'consumption', electricityConsumption);

    return electricityConsumption;
}

exports.getCurrentElectricityPrice = async function (date) {
    const windSpeedCoeff = -1;
    const consumptionCoeff = 500;

    const maxPrice = 2;
    const minPrice = 1;

    const electricityConsumption = (await exports.getElectricityConsumption(date, "TODO")).electricityConsumption;
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

    database.insertOne(DATABASE_NAME, 'currentPrice', priceAsJson);

    return priceAsJson;
};


exports.getElectricityProduction = function (date) {
    return 2000 * exports.getWindSpeed(date).windSpeed / 100; //à 100km/h produit 20kw
};

exports.getPowerPlantElectricityProduction = function (token) {
    const databaseName = DATABASE_NAME;
    const collectionName = 'managers';
    return database.find(databaseName, collectionName, {token})
        .then(results => {
            if (results.length === 1) {
                return results[0];
            }
            throw `No known manager with this token: ${token}`;
        }).then(manager => {
            const currentStep = Date.now() - (manager.productionModificationTime || Date.now());
            return {
                newProduction: utils.computeLinearFunction(
                    manager.powerPlantProduction || 0,
                    manager.newProduction || 0,
                    30,
                    currentStep / 1000
                )
            }
        });
};