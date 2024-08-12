
const { MongoClient } = require('mongodb');

const uri = 'mongodb+srv://nisalperera619:z2zJI8sRjgrOvyJG@cluster0.2saihnd.mongodb.net/dbtrain';
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

const connectToDatabase = async () => {
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    return client.db('dbtrain'); 
  } catch (error) {
    console.error('Error connecting to MongoDB:', error.message);
    throw error;
  }
};

module.exports = { connectToDatabase, client };
