
const axios = require('axios');
const { connectToDatabase, client } = require('./db');

const interval = 100; 

const routesToSimulate = [
  { name: 'Colombo Fort to Kandy', bidirectional: true },
  { name: 'Colombo Fort to Matale', bidirectional: false },
  { name: 'Colombo Fort to Avissawella', bidirectional: false },
  { name: 'Colombo Fort to Trincomalee', bidirectional: false },
  { name: 'Colombo Fort to Batticaloa', bidirectional: false },
  { name: 'Colombo Fort to Puttalama', bidirectional: false },
  { name: 'Colombo Fort to Matara', bidirectional: true },
  { name: 'Colombo Fort to Kankesanthurai', bidirectional: false }
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

const simulateTrainMovement = (route, interval, reverse = false) => {
  let index = 0;
  const steps = 10;
  const totalPoints = route.length - 1;
  const routePoints = reverse ? route.slice().reverse() : route;

  const moveTrain = async () => {
    if (index < totalPoints) {
      const start = routePoints[index];
      const end = routePoints[index + 1];
      const intermediatePoints = calculateIntermediatePoints(start, end, steps);
      
      for (let step = 0; step < intermediatePoints.length; step++) {
        const point = intermediatePoints[step];
        const data = {
          latitude: point.lat,
          longitude: point.lon,
          timestamp: new Date().toISOString()
        };
        console.log(`Train on route: Latitude: ${point.lat}, Longitude: ${point.lon}`);
        
        await new Promise(resolve => setTimeout(resolve, interval));
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

        
        simulateTrainMovement(route.points, interval);

        if (routeConfig.bidirectional) {
          
          simulateTrainMovement(route.points, interval, true);
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
