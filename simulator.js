// simulator.js
const axios = require('axios');
const { connectToDatabase, client } = require('./db');

const interval = 100; // 100 milliseconds
const delayThreshold = 5; // 5 minutes for delay alert
const temperatureThreshold = 200; // Temperature threshold for warning alert (e.g., 100°C)

const routesToSimulate = [
  { iotId: 'RTD001', name: 'Colombo Fort to Kankesanthurai', bidirectional: false }
];

// Function to calculate intermediate points
const calculateIntermediatePoints = (start, end, steps) => {
  const latStep = (end.lat - start.lat) / steps;
  const lonStep = (end.lon - start.lon) / steps;
  const points = [];
  for (let i = 0; i <= steps; i++) {
    points.push({
      lat: start.lat + i * latStep,
      lon: start.lon + i * lonStep
    });
  }
  return points;
};

// Function to simulate train movement
const simulateTrainMovement = async (route, iotId, maxSpeed, minSpeed, journeyDuration, interval, reverse = false) => {
  let index = 0;
  const steps = 10;
  const totalPoints = route.length - 1;
  const routePoints = reverse ? route.slice().reverse() : route;
  const startTime = new Date();

  const moveTrain = async () => {
    if (index < totalPoints) {
      const start = routePoints[index];
      const end = routePoints[index + 1];
      const intermediatePoints = calculateIntermediatePoints(start, end, steps);

      for (let step = 0; step < intermediatePoints.length; step++) {
        const point = intermediatePoints[step];
        const elapsedTime = (new Date() - startTime) / 1000 / 60; // Elapsed time in minutes
        const remainingTime = journeyDuration - elapsedTime;

        let speed = Math.random() * (maxSpeed - minSpeed) + minSpeed;
        const engineTemp = Math.random() * 100 + 20; // Simulate engine temperature

        // Handle station stops
        if (start.stopDuration > 0) {
          speed = 0; // Stop at the station
          for (let i = 0; i < start.stopDuration * 1000 / interval; i++) {
            const stopElapsed = i * interval / 1000 / 60; // Elapsed stop time in minutes

            const data = {
              iotId: iotId,
              latitude: start.lat, // Keep latitude the same during stop
              longitude: start.lon, // Keep longitude the same during stop
              speed: speed,
              engineTemp: engineTemp,
              engineStatus: 'stopped',
              timestamp: new Date().toISOString(),
              networkStrength: Math.random() * 5 // Simulate network strength
            };

            if (stopElapsed >= delayThreshold) {
              console.log(`Delay Alert: Train has been stopped for more than ${delayThreshold} minutes at Latitude: ${start.lat}, Longitude: ${start.lon}`);
            }

            if (engineTemp > temperatureThreshold) {
              console.log(`Warning Alert: High engine temperature detected (${engineTemp}°C) at Latitude: ${start.lat}, Longitude: ${start.lon}`);
            }

            try {
              await axios.post('http://localhost:3000/api/train-data', data);
            } catch (error) {
              console.error('Error posting data:', error.message);
            }

            await new Promise(resolve => setTimeout(resolve, interval));
          }
        } else {
          // Simulate moving train
          const data = {
            iotId: iotId,
            latitude: point.lat,
            longitude: point.lon,
            speed: speed,
            engineTemp: engineTemp,
            engineStatus: 'running',
            timestamp: new Date().toISOString(),
            networkStrength: Math.random() * 5 // Simulate network strength
          };

          if (engineTemp > temperatureThreshold) {
            console.log(`Warning Alert: High engine temperature detected (${engineTemp}°C) at Latitude: ${point.lat}, Longitude: ${point.lon}`);
          }

          try {
            console.log(`Sending data to API: Latitude: ${point.lat}, Longitude: ${point.lon}, Speed: ${speed}`);
            await axios.post('http://localhost:3000/api/train-data', data);
          } catch (error) {
            console.error('Error posting data:', error.message);
          }

          // Wait for the interval before sending the next data point
          await new Promise(resolve => setTimeout(resolve, interval));
        }
      }

      index++;
      setTimeout(moveTrain, interval); // Use interval here to maintain speed consistency
    } else {
      console.log('Train has reached its destination.');
    }
  };

  moveTrain();
};

// Fetch routes and simulate trains
const fetchRoutesAndSimulateTrains = async () => {
  try {
    const db = await connectToDatabase();
    const routesCollection = db.collection('train_routes');

    for (const routeConfig of routesToSimulate) {
      const route = await routesCollection.findOne({ trainRoute: routeConfig.name });

      if (route && route.points) {
        console.log(`Route ${routeConfig.name} found. Starting simulation...`);

        // Simulate train from Colombo to destination
        simulateTrainMovement(route.points, routeConfig.iotId, route.maxSpeed, route.minSpeed, route.journeyDuration, interval);

        if (routeConfig.bidirectional) {
          // Simulate train from destination back to Colombo
          simulateTrainMovement(route.points, routeConfig.iotId, route.maxSpeed, route.minSpeed, route.journeyDuration, interval, true);
        }

      } else {
        console.log(`Route ${routeConfig.name} not found or no points available`);
      }
    }
  } catch (error) {
    console.error('Error during data fetching or simulation:', error.message);
  } finally {
    console.log('MongoDB connection will remain open for simulation duration.');
  }
};

fetchRoutesAndSimulateTrains();
