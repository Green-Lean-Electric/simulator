const service = require('./services');
const server = require('../../utils/src/server');
const configuration = require('../../utils/src/configuration');

const port = configuration
    .serversConfiguration
    .simulator
    .port;

const prosumerUrl = 'http://' + configuration.serversConfiguration.prosumer.hostname + ":" + configuration.serversConfiguration.prosumer.port;

const routes = {
    '/getWindSpeed': (_, __, res) => {
        res.setHeader('Access-Control-Allow-Origin', prosumerUrl);
        res.setHeader('Content-type', 'application/json');
        return service.getWindSpeed(
            new Date()
        );
    },
    '/getElectricityConsumption': (request, parameters, res) => {
        res.setHeader('Access-Control-Allow-Origin', prosumerUrl);
        res.setHeader('Content-type', 'application/json');
        return service.getElectricityConsumption(
            new Date(),
            parameters.prosumerId
        );
    },
    '/getCurrentElectricityPrice': (_, __, res) => {
        res.setHeader('Access-Control-Allow-Origin', prosumerUrl);
        res.setHeader('Content-type', 'application/json');
        return service.getCurrentElectricityPrice(
            new Date()
        );
    },
    '/getElectricityProduction': (_, __, res) => {
        res.setHeader('Access-Control-Allow-Origin', prosumerUrl);
        res.setHeader('Content-type', 'application/json');
        return service.getElectricityProduction(
            new Date()
        );
    },
};

const staticFiles = {};

server.createServer(staticFiles, routes, port);