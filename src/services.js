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

exports.getPowerPlantElectricityProduction = function (token) {
    const databaseName = DATABASE_NAME;
    const collectionName = 'managers';
    return database.find(databaseName, collectionName, {token})
        .then(results => {
            if (results.length === 1) {
                return results[0];
            }
            throw `No known manager with this token: ${token}`;
        })
        .then(findPowerPlantOfManager)
        .then(powerPlant => ({
            newProduction: powerPlant.currentProduction
        }));
};

exports.updateData = function () {
    const date = new Date();
    return Promise.all([
        database.find(DATABASE_NAME, 'prosumers'),
        database.find(DATABASE_NAME, 'powerPlants'),
    ]).then(([prosumers, powerPlants]) => ({
        prosumers: prosumers.map(
            prosumer => {
                const windSpeed = computeWindSpeed(date);
                const consumption = computeProsumerConsumption(date, prosumer.email);
                const production = computeProduction(date);
                return [
                    prosumer,
                    windSpeed,
                    consumption,
                    production
                ];
            }
        ),
        powerPlants: powerPlants.map(powerPlant => {
            powerPlant.currentProduction = computePowerPlantProduction(powerPlant);
            powerPlant.date = date;
            return powerPlant;
        }),
        computedPrice: computeCurrentElectricityPrice(),
        date: date.getTime()
    })).then(storeData);
};

function computeWindSpeed(date) {
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

    return floor(windSpeed);
}

function computeProsumerConsumption(date, prosumerId) {
    const dailyConsumptionPerPerson = 2700; //Watt

    let morningConsumption = 2100;
    let afternoonConsumption = dailyConsumptionPerPerson - morningConsumption;

    let changing_value = prosumerId.length;

    if (prosumerId.length % 2 === 0) {
        changing_value = -changing_value;
    }

    afternoonConsumption += afternoonConsumption * changing_value / 100;
    morningConsumption += morningConsumption * changing_value / 100;

    const hours = date.getHours();
    const minutes = date.getMinutes();
    const seconds = date.getSeconds();

    const currentTimestamp = hours * 3600 + minutes * 60 + seconds;

    const morningTopTimestamp = 11 * 3600;
    const afternoonTopHourTimestamp = 19 * 3600 + 30 * 60;

    return (
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
    ) * 100;
}

function computeProduction(date) {
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

    return floor(50 * windSpeed);
}

function computeCurrentElectricityPrice() {
    // FIXME
    return 1.5;
}

function computePowerPlantProduction(powerPlant) {
    const currentStep = Date.now() - (powerPlant.productionModificationTime || Date.now());
    return utils.computeLinearFunction(
        powerPlant.oldProduction || 0,
        powerPlant.futureProduction || 0,
        30,
        currentStep / 1000
    );
}

function storeData(data) {
    let currentMarketElectricity = data.powerPlants.map(
        powerPlant => powerPlant.status === 2
            ? powerPlant.currentProduction
            : powerPlant.bufferFilling
    ).reduce((a, b) => a + b, 0);
    for (const [prosumer, windSpeed, consumption, production] of data.prosumers) {
        updateSimulator(prosumer, windSpeed, consumption, production, data.date);
        currentMarketElectricity += updateProsumer(prosumer, consumption, production, windSpeed, currentMarketElectricity);
    }

    const stoppedPowerPlants = data.powerPlants.filter(powerPlant => powerPlant.status !== 2).length;
    for (const powerPlant of data.powerPlants) {
        if (currentMarketElectricity < 0 && powerPlant.status !== 2) {
            powerPlant.bufferFilling += currentMarketElectricity / stoppedPowerPlants;
        }
        updatePowerPlant(powerPlant);
    }

    updateMarket(currentMarketElectricity, data.computedPrice, data.date);

    return data;
}

function updateSimulator(prosumer, windSpeed, consumption, production, date) {
    database.insertOne(DATABASE_NAME, 'simulator', {
        prosumer: prosumer.email,
        windSpeed,
        consumption,
        production,
        date
    });
}

function updateProsumer(prosumer, consumption, production, windSpeed, currentMarketElectricity) {
    prosumer.consumption = consumption;
    prosumer.production = production;
    prosumer.windSpeed = windSpeed;

    prosumer.blackOut = false;
    prosumer.boughtElectricity = 0;
    prosumer.electricySentToTheMarket = 0;

    const productionConsumptionDifference = production - consumption;
    if (productionConsumptionDifference > 0) {
        prosumer.bufferFilling = Math.min(
            prosumer.bufferSize,
            prosumer.bufferFilling + productionConsumptionDifference * prosumer.productionRatioBuffer
        );
        prosumer.electricySentToTheMarket = productionConsumptionDifference * prosumer.productionRatioMarket;
    } else {
        if (currentMarketElectricity > -productionConsumptionDifference * prosumer.consumptionRatioMarket) {
            prosumer.boughtElectricity = -productionConsumptionDifference * prosumer.consumptionRatioMarket;
            prosumer.bufferFilling += productionConsumptionDifference * prosumer.consumptionRatioBuffer;
        } else {
            prosumer.blackOut = true;
        }
    }

    const operation = {
        '$set': prosumer
    };

    database.updateOne(DATABASE_NAME, 'prosumers', {
        email: prosumer.email
    }, operation);

    return prosumer.electricySentToTheMarket - prosumer.boughtElectricity;
}

function updatePowerPlant(powerPlant) {
    const operation = {
        '$set': powerPlant
    };
    database.updateOne(DATABASE_NAME, 'powerPlants', {
        _id: powerPlant._id
    }, operation);
}

function updateMarket(electricity, computedPrice, date) {
    database.findLast(DATABASE_NAME, 'market', {}, 'date')
        .then(lastMarket => {
            const actualPrice = lastMarket
                ? lastMarket.actualPrice
                : computedPrice;
            database.insertOne(DATABASE_NAME, 'market', {
                electricity,
                computedPrice,
                actualPrice,
                date
            })
        });
}

function findPowerPlantOfManager(manager) {
    return database.find(DATABASE_NAME, 'powerPlants', {maanger: manager.email})
        .then(powerPlants => powerPlants[0]);
}

exports.initializeSimulator = function () {
    function insertNewPowerPlant() {
        return database.insertOne(DATABASE_NAME, 'powerPlants', {
            status: 2,

            bufferSize: 79200,
            bufferFilling: 0,

            oldProduction: 0,
            futureProduction: 0,
            currentProduction: 0,
            productionRatioBuffer: 0.7,
            productionRatioMarket: 0.3,
            lastModification: Date.now(),
            managers: []
        });
    }

    return database.find(DATABASE_NAME, 'powerPlants')
        .then(results => {
            if (results.length === 0) {
                return insertNewPowerPlant();
            }
            return new Promise(resolve => resolve());
        });
};