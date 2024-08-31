const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const axios = require('axios');
const { connectToDatabase } = require('./db');
const { DateTime } = require('luxon');


const app = express();
const server = http.createServer(app);
const io = new Server(server);

const interval = 100; 
const delayThreshold = 3; 
const temperatureThreshold = 200; 
const lowNetworkThreshold = 0.1; 
const deviceHealthGoodThreshold = 1; 

app.use(express.static('public')); 


const routesToSimulate = [
  { iotId: 'RTD001', name: 'Colombo Fort to Kandy', bidirectional: false },
  //{ iotId: 'RTD002', name: 'Colombo Fort to Badulla', bidirectional: true },
  { iotId: 'RTD003', name: 'Colombo Fort to Matara', bidirectional: true },
  { iotId: 'RTD004', name: 'Colombo Fort to Avissawella', bidirectional: false },
  { iotId: 'RTD005', name: 'Colombo Fort to Batticaloa', bidirectional: false },
  { iotId: 'RTD006', name: 'Colombo Fort to Trincomalee', bidirectional: true },
  { iotId: 'RTD007', name: 'Colombo Fort to Puttalama', bidirectional: false },
  { iotId: 'RTD008', name: 'Colombo Fort to Kankesanthurai', bidirectional: false },
  { iotId: 'RTD009', name: 'Colombo Fort to Matale', bidirectional: false }
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


const timeMultiplier = 4; 

const simulateTrainMovement = async (route, iotId, maxSpeed, minSpeed, totalDistance, journeyDuration, interval, reverse = false) => {
  let index = 0;
  const steps = 10;
  const totalPoints = route.length - 1;
  const routePoints = reverse ? route.slice().reverse() : route;
  const startTime = DateTime.now().setZone('Asia/Colombo');

  const moveTrain = async () => {
    if (index < totalPoints) {
      const start = routePoints[index];
      const end = routePoints[index + 1];
      const intermediatePoints = calculateIntermediatePoints(start, end, steps);

      for (let step = 0; step < intermediatePoints.length; step++) {
        const point = intermediatePoints[step];
        const distanceCovered = (index + step / steps) * (totalDistance / totalPoints);
        const elapsedMinutes = (distanceCovered / totalDistance) * journeyDuration * timeMultiplier;
        const timestamp = startTime.plus({ minutes: elapsedMinutes }).toISO();

        let speed = Math.random() * (maxSpeed - minSpeed) + minSpeed;
        const engineTemp = Math.random() * 100 + 20; 
        const networkStrength = Math.random() * 5; 

        // Handle station stops
        if (start.stopDuration > 0) {
          speed = 0; 
          for (let i = 0; i < (start.stopDuration * 1000 / interval) / timeMultiplier; i++) {
            const stopElapsed = (i * interval / 1000 / 60) * timeMultiplier; 

            const data = {
              iotId: iotId,
              latitude: start.lat,
              longitude: start.lon,
              speed: speed,
              engineTemp: engineTemp,
              engineStatus: 'stopped',
              timestamp: timestamp,
              networkStrength: networkStrength,
              deviceHealth: networkStrength > deviceHealthGoodThreshold ? 'Good' : 'Needs Attention',
              locationAccuracy: 'High'
            };

            if (stopElapsed >= delayThreshold / timeMultiplier) {
              console.log(`Delay Alert: Train has been stopped for more than ${delayThreshold / timeMultiplier} minutes at Latitude: ${start.lat}, Longitude: ${start.lon}`);
            }

            if (engineTemp > temperatureThreshold) {
              console.log(`Warning Alert: High engine temperature detected (${engineTemp}°C) at Latitude: ${start.lat}, Longitude: ${start.lon}`);
            }

            if (networkStrength < lowNetworkThreshold) {
              console.log(`Network Failure: Low network strength detected at Latitude: ${start.lat}, Longitude: ${start.lon}`);
            }

            io.emit('trainData', data);

            try {
              console.log(`Sending data to API: Latitude: ${point.lat}, Longitude: ${point.lon}, Speed: ${speed}`);
              await axios.post('http://localhost:3000/api/location', data)
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
            timestamp: timestamp,
            networkStrength: networkStrength,
            deviceHealth: networkStrength > deviceHealthGoodThreshold ? 'Good' : 'Needs Attention',
            locationAccuracy: 'High'
          };

          if (engineTemp > temperatureThreshold) {
            console.log(`Warning Alert: High engine temperature detected (${engineTemp}°C) at Latitude: ${point.lat}, Longitude: ${point.lon}`);
          }

          if (networkStrength < lowNetworkThreshold) {
            console.log(`Network Failure: Low network strength detected at Latitude: ${point.lat}, Longitude: ${point.lon}`);
          }

          io.emit('trainData', data);

          try {
            console.log(`Sending data to API: Latitude: ${point.lat}, Longitude: ${point.lon}, Speed: ${speed}`);
            await axios.post('http://localhost:3000/api/location', data)
          } catch (error) {
            console.error('Error posting data:', error.message);
          }

          if (Math.random() < 0.01) {
            console.log(`Emergency Alert: Emergency button pressed at Latitude: ${point.lat}, Longitude: ${point.lon}`);
          }

          await new Promise(resolve => setTimeout(resolve, interval));
        }
      }

      index++;
      setTimeout(moveTrain, interval);
    } else {
      console.log(`Train ${iotId} has reached its destination.`);
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
        console.log(`Route ${routeConfig.name} found. Starting simulation for ${routeConfig.iotId}...`);

        // Simulate train from start to end
        simulateTrainMovement(route.points, routeConfig.iotId, route.maxSpeed, route.minSpeed, route.totalDistance, route.journeyDuration, interval);

        if (routeConfig.bidirectional) {
          // Simulate train from end to start (reverse direction)
          simulateTrainMovement(route.points, routeConfig.iotId + '_REV', route.maxSpeed, route.minSpeed, route.totalDistance, route.journeyDuration, interval, true);
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

// Start the server
const PORT = process.env.PORT || 3002;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

