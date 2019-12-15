const service = require('./services');

const updateTime = 1000; // One update each second

service.initializeSimulator()
    .then(() => {
        setInterval(
            service.updateData,
            updateTime
        );
    });