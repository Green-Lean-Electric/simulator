const http = require('http');
const url = require('url');

const port = 8080;

const routes = {
    //Simulator 
    '/getWindSpeed': (service) => service.getWindSpeed(
        new Date()
    ),
    '/getElectricityConsumption': (service) => service.getWholeElectricityConsumption(
        new Date()
    ),
    '/getCurrentElectricityPrice': (service) => service.getCurrentElectricityPrice(
        new Date()
    ),
    //Prosumer
    '/prosumerSignUp': (service, request) => service.insertProsumer(
        getParam(request, 'email'),
        getParam(request, 'password')
    ),
    '/prosumerLogin': (service,request) => service.connectProsumer(
        getParam(request, 'email'),
        getParam(request, 'pwd')
    ),
    '/prosumerLogout': (service,request) => service.disconnectProsumer(
        getParam(request, 'token')
    ),
    '/getProsumerElectricityConsumption': (service,request) => service.getProsumerElectricityConsumption(
        getParam(request, 'token'),
        new Date(getParam(request, 'date'))
    ),
};

const server = http.createServer(function (req, res) {
    const reqUrl = url.parse(req.url);
    const service = require('./services.js');

    if (req.method === 'GET' || req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE') {
        console.log('Request Type:' + req.method + ' Endpoint: ' + reqUrl.pathname);

        const route = routes[reqUrl.pathname];
        if (route) {
            computeReply(route, service, req)
                .then(reply => writeReply(reply, res))
                .catch(/* TODO: add an error message */);
        } else {
            // TODO: add an error message
        }
    }
});

function computeReply(route, service, request) {
    const reply = route(service, request);
    return new Promise(resolve => resolve(reply));
}

function writeReply(response, res) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(response));
}

function getParam(request, paramName) {
    var query = url.parse(request.url).query;
    if (!query) return null;

    var params = query.split('&');
    for (var i = 0; i < params.length; i++) {
        var data = params[i].split('=');
        if (data[0] === paramName)
            return data[1];
    }
    return null;
}

server.listen(port);