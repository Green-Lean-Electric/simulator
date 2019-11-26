const service = require('./services.js');
const server = require('../../utils/src/server.js');

const port = require('../../utils/src/configuration.js')
    .serversConfiguration
    .simulator
    .port;

const routes = {
    '/getWindSpeed': () => service.getWindSpeed(
        new Date()
    ),
    '/getElectricityConsumption': request => service.getElectricityConsumption(
        new Date(),
        server.getParam(request, 'prosumerId'),
    ),
    '/getCurrentElectricityPrice': () => service.getCurrentElectricityPrice(
        new Date()
    ),
};

const staticFiles = {};

server.createServer(__dirname, staticFiles, routes, port);