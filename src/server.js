const service = require('./services');
const server = require('../../utils/src/server');
const configuration = require('../../utils/src/configuration');

const port = configuration
    .serversConfiguration
    .simulator
    .port;

const allowedOrigins = [
    'http://' + configuration.serversConfiguration.prosumer.hostname + ":" + configuration.serversConfiguration.prosumer.port,
    'http://' + configuration.serversConfiguration.manager .hostname + ":" + configuration.serversConfiguration.manager .port
];

const routes = {
    '/getWindSpeed': (req, __, res) => {
        setAccessControl(req, res);
        res.setHeader('Content-type', 'application/json');
        return service.getWindSpeed(
            new Date()
        );
    },
    '/getElectricityConsumption': (request, parameters, res) => {
        setAccessControl(request, res);
        res.setHeader('Content-type', 'application/json');
        return service.getElectricityConsumption(
            new Date(),
            parameters.prosumerId
        );
    },
    '/getCurrentElectricityPrice': (req, __, res) => {
        setAccessControl(req, res);
        res.setHeader('Content-type', 'application/json');
        return service.getCurrentElectricityPrice(
            new Date()
        );
    },
    '/getElectricityProduction': (req, __, res) => {
        setAccessControl(req, res);
        res.setHeader('Content-type', 'application/json');
        return service.getElectricityProduction(
            new Date()
        );
    },
    '/computePowerPlantElectricityProduction': (req, parameters, res) => {
        setAccessControl(req, res);
        res.setHeader('Content-type', 'application/json');
        if (req.method.toLowerCase() === 'options') {
            res.setHeader('Access-Control-Allow-Headers', 'content-type');
            return {};
        }
        return service.computePowerPlantElectricityProduction(parameters);
    },
};

function setAccessControl(req, res) {
    const origin = req.headers.origin;
    if(allowedOrigins.indexOf(origin) > -1){
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
}

const staticFiles = {};

server.createServer(staticFiles, routes, port);