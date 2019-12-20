# Simulator Project

The Simulator project is in charge of all the calculations for the Green Lean Electrics Project (```https://github.com/Green-Lean-Electric```), such as the electricity production, consumption, price or the wind speed. It’s an application which infinitely runs and computes each second the new values for the power plants, the prosumers and the market.

## Online Usage

You can use our project on our serveur with the following links :

Manager ```http://145.239.75.80:8082/```

Prosumer ```http://145.239.75.80:8081/``` 
 
## Installation

Download and install Node.js version 12 or higher. Lower versions may not work due to advanced JavaScript features. 

Download and install on localhost MongoDB version 4 or higher. Default port should be 27017.

Clone all projects repositories (Simulator, Prosumer, Manager & Utils)

Inside each project run 

```bash
npm install
```
This should install Node.js dependencies we have used throughout our application.


## Local Usage

You can now start the three main projects. From the root folder, launch the following commands:


```bash
node simulator/src/server.js
node manager/src/server.js
node prosumer/src/server.js
```

The servers should now be up and running and you should be able to access to your web interfaces at "localhost:8081" (prosumer interface) and "localhost:8082" (manager interface).

Please note that if you test our application on a Windows computer, the registration mails can't be send. We recommend you to test it on a Unix computer. 

However, if you only have a Windows computer, you need a few more steps to activate an account (manager & prosumer) after its registration:

- open your localhost MongoDB "greenleanelectrics" database.
- look for the prosumer (collection "prosumer") or the manager (collection "manager") you want to activate.
- delete the "registrationToken" field.

## Other Projects Linked to this one

Manager ```https://github.com/Green-Lean-Electric/manager```

Prosumer ```https://github.com/Green-Lean-Electric/prosumer```

Utils ```https://github.com/Green-Lean-Electric/utils```

