const axios = require('axios');
const { connectToDatabase } = require('./db');
const { DateTime } = require('luxon');

const interval = 100; 
const delayThreshold = 3; 
const temperatureThreshold = 200; 
const lowNetworkThreshold = 0.1; 
const deviceHealthGoodThreshold = 1; 

const routesToSimulate = [
  { iotId: 'RTD001', name: 'Colombo Fort to Kankesanthurai', bidirectional: false }
];


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
        const elapsedMinutes = (distanceCovered / totalDistance) * journeyDuration;
        const timestamp = startTime.plus({ minutes: elapsedMinutes }).toISO();
        
        let speed = Math.random() * (maxSpeed - minSpeed) + minSpeed;
        const engineTemp = Math.random() * 100 + 20; 
        const networkStrength = Math.random() * 5; 

        
        if (start.stopDuration > 0) {
          speed = 0; 
          for (let i = 0; i < start.stopDuration * 1000 / interval; i++) {
            const stopElapsed = i * interval / 1000 / 60; 

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

            if (stopElapsed >= delayThreshold) {
              console.log(`Delay Alert: Train has been stopped for more than ${delayThreshold} minutes at Latitude: ${start.lat}, Longitude: ${start.lon}`);
            }

            if (engineTemp > temperatureThreshold) {
              console.log(`Warning Alert: High engine temperature detected (${engineTemp}°C) at Latitude: ${start.lat}, Longitude: ${start.lon}`);
            }

            if (networkStrength < lowNetworkThreshold) {
              console.log(`Network Failure: Low network strength detected at Latitude: ${start.lat}, Longitude: ${start.lon}`);
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

          try {
            console.log(`Sending data to API: Latitude: ${point.lat}, Longitude: ${point.lon}, Speed: ${speed}`);
            await axios.post('http://localhost:3000/api/train-data', data);
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
      console.log('Train has reached its destination.');
    }
  };

  moveTrain();
};


const fetchRoutesAndSimulateTrains = async () => {
  try {
    const db = await connectToDatabase();
    const routesCollection = db.collection('train_routes');

    for (const routeConfig of routesToSimulate) {
      const route = await routesCollection.findOne({ trainRoute: routeConfig.name });

      if (route && route.points) {
        console.log(`Route ${routeConfig.name} found. Starting simulation...`);

        
        simulateTrainMovement(route.points, routeConfig.iotId, route.maxSpeed, route.minSpeed, route.totalDistance, route.journeyDuration, interval);

        if (routeConfig.bidirectional) {
          
          simulateTrainMovement(route.points, routeConfig.iotId, route.maxSpeed, route.minSpeed, route.totalDistance, route.journeyDuration, interval, true);
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
