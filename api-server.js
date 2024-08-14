const express = require('express');
const app = express();
const port = 3000;

app.use(express.json());

// Array to store incoming data
let trainData = [];

// POST route to receive data from simulator
app.post('/api/train-data', (req, res) => {
  console.log('Received data:', req.body);
  trainData.push(req.body);
  res.status(200).send('Data received');
});

// GET route to display all received data
app.get('/api/train-data', (req, res) => {
  res.json(trainData);
});

app.listen(port, () => {
  console.log(`API server running at http://localhost:${port}`);
});
