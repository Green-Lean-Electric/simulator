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
            const currentProduction = utils.computeLinearFunction(
                powerPlant.oldProduction || 0,
                powerPlant.futureProduction || 0,
                30,
                (date - powerPlant.productionModificationTime) / 1000
            );
            const oldProduction = currentProduction === powerPlant.futureProduction
                ? powerPlant.futureProduction
                : powerPlant.oldProduction;

            // If the old production is 0, the plant was stopped so it's now starting.
            // If the current production is 0, then the plant is stopped.
            // Otherwise it's running.
            const status = powerPlant.currentProduction === 0
                ? 0
                : powerPlant.oldProduction === 0 && powerPlant.futureProduction > 0
                    ? 1
                    : 2;

            powerPlant.bufferFilling = Math.min(
                powerPlant.bufferSize,
                currentProduction * powerPlant.productionRatioBuffer + powerPlant.bufferFilling
            );

            powerPlant.currentProduction = currentProduction;
            powerPlant.oldProduction = oldProduction;
            powerPlant.status = status;
            powerPlant.date = date;
            return powerPlant;
        }),
        market: {
            computedPrice: computeCurrentElectricityPrice(),
            demand: computeMarketDemand(prosumers)
        },
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

function computeMarketDemand(prosumers) {
    return prosumers.map(
        prosumer => computeDemandOfProsumer(prosumer, prosumer.consumption, prosumer.production)
    ).reduce((a, b) => a + b, 0);
}

function computeDemandOfProsumer(prosumer, consumption, production) {
    if (production >= consumption) {
        return 0;
    } else {
        if ((consumption - production) * prosumer.consumptionRatioBuffer <= prosumer.bufferFilling) {
            return (consumption - production) * prosumer.consumptionRatioMarket;
        } else {
            return consumption - production - prosumer.bufferFilling;
        }
    }
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

    updateMarket(currentMarketElectricity, data.market, data.date);

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
        if (currentMarketElectricity > -productionConsumptionDifference * prosumer.consumptionRatioMarket
            && prosumer.bufferFilling > -productionConsumptionDifference * prosumer.consumptionRatioBuffer) {
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

function updateMarket(electricity, market, date) {
    database.findLast(DATABASE_NAME, 'market', {}, 'date')
        .then(lastMarket => {
            const actualPrice = lastMarket
                ? lastMarket.actualPrice
                : market.computedPrice;
            database.insertOne(DATABASE_NAME, 'market', {
                electricity,
                computedPrice: market.computedPrice,
                demand: market.demand,
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