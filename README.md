# Simulator
Basic functionality

The simulator should provide a RESTful API or a GraphQL to which the other systems can later  connect in order to obtain data about: 

the weather (wind speed specifically)
electricity consumption
the current electricity price (based on demand). 
Since receiving proper and timely readings about consumption and wind speed play a critical role in the overall system, you should also design an automated test that verifies the sanity of these variables (think about how and what to test).

An example of how to model a household’s consumption of electricity could be to simply sample a Gaussian distribution.

The Prosumer’s production of electricity is dependent on the wind, which also should be modelled as a stochastic (random) variable. Wind however does not typically change instantaneously, but instead gradually. One example on how to model this is to first sample a Gaussian distribution in order to get the mean value of the wind speed for a given day of the year. Then use that mean value in another Gaussian distribution to sample the wind speeds during that day.

The current electricity price can then be derived using the electricity consumption (demand) and wind speed (supply of cheaper power) using for example a simple linear function.

It is left up to you to choose a reasonable way of modelling the simulation variables. However, don’t spend too much time on creating a mathematical model, since this is not the focus of this course. Spend your time mainly on creating the API.

There are several ways to test use your simulator API without first building the other clients (Prosumer and Manager), for example to use applications like “Postman” or to just make HTTP requests using Javascript (See for example jQuery.get-function and jQuery.post).

 

Advanced functionality

Here are some suggestions in order to obtain a higher grade:

Electricity consumption is to some extent (in Luleå highly) dependent on weather since heating a house consumes a lot of energy. Your simulator could include this by simulating outdoor temperature or even connect to open API’s on the web in order to ask for the current temperature (Note that wind speed should be modelled “by hand” for educational purposes, and should not be taken from such an API)
Model downtime or breakdowns of the wind turbines
Have your simulator include locational data such as GPS coordinates in order to make  the wind speed in two locations in proximity to each other have similar wind speeds
Your simulator could provide historical data
The simulator could, in extension to the REST API, provide streaming simulation data over a socket or similar
