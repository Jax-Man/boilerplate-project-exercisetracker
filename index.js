require('dotenv').config();
let bodyParser = require('body-parser');
const express = require('express');
const cors = require('cors');
const app = express();
const { MongoClient } = require("mongodb");

app.use(cors());
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});
// set up mongo db
const uri = process.env.MONGO_URI
const client = new MongoClient(uri);
const db = client.db('exercise_tracker');

//create pipeline for view
async function userExerciseView() {
  try {
db.command({
  create: 'user_exercises',
  viewOn: 'exercises',
  pipeline: [
    {
      '$project': {
        'description': 1, 
        'duration': 1, 
        'date': 1, 
        'user_id': {
          '$toObjectId': '$user_id'
        }
      }
    }, {
      '$lookup': {
        'from': 'users', 
        'localField': 'user_id', 
        'foreignField': '_id', 
        'as': 'userDocs'
      }
    }, {
      '$unwind': {
        'path': '$userDocs', 
        'includeArrayIndex': '0', 
        'preserveNullAndEmptyArrays': false
      }
    }, {
      '$project': {
        'username': '$userDocs.username', 
        'description': 1, 
        'duration': 1, 
        'date': 1, 
        'user_id': {
          '$toString': '$user_id'
        }
      }
    }
  ]
})
  } catch (err) {
    console.log(err);
  }
};
userExerciseView();
//create user
app.route('/api/users').post(function(req, res) {
  const { username } = req.body;
  async function createUser() {
    try {
      const user = await db.collection('users').insertOne({ username });
      console.log(username);
      if (user) {
      var foundUser = await db.collection('users').findOne({ username });
      console.log(foundUser);
      }
    } catch (err) {
      return res.json({ error: 'failed to add user. please try again'})
    } finally {
      res.json(foundUser);
    }
  };
  createUser();
  //get request for all users
}).get(function(req, res) {
  async function findAllUsers() {
    try {
      //get all users from the database
      var allUsers = await db.collection('users').find({}).toArray();
      console.log(allUsers);
    } catch (err) { 
      //if error return error and message
      console.log(err);
      res.json({
        error: err, 
        message: 'query failed. teehee~'
      })
    } finally {
      //give array of users as response
      res.json(allUsers);
    };
  }
  findAllUsers();
});
// Submit exercise
app.route('/api/users/:_id?/exercises').post(function(req, res) {
  const _id = req.params._id;
  var { description, duration, date } = req.body;
  // format for data insertion
  //duration to number
  duration = parseFloat(duration);
 
  //date to a Date object
  date = date ? new Date(date) : new Date();
  //if data fields are sent empty
  if(!description || !duration) { 
    if (isNaN(duration)) {
      res.json({ error: 'Duration was not in minutes. Did you mess up?'});
    } else {
      res.json({ error: 'silly head all * fields are required'});
    };
  };
  async function createExerciseLog() {
    try {

      //insert exercise
      const insertedExercise = await db.collection('exercises').insertOne({
        description,
        duration,
        date,
        user_id: _id
      });
      console.log(insertedExercise);
      //find inserted excercise in the joined table
      //Make joined aggregate in mongo db its easier
      // respond with result here and not in finally
      const userExercise = await db.collection('user_exercises').findOne({ description, user_id: _id });
      console.log(userExercise);
      res.json({
        _id, 
        username: userExercise.username, 
        description, 
        duration, 
        date: date.toDateString() 
      });
    } catch (err) {
      res.json({error: err, message: "oops teehee~, something went wrong"});
    };
  };
  createExerciseLog();
})

//get logs
app.route('/api/users/:_id/logs').get(function(req, res) {
  
  let fromDate = Date.parse(req.query.from);
  let toDate = Date.parse(req.query.to);
  const limit = parseFloat(req.query.limit);
  console.log(fromDate, toDate, req.query.limit);
  async function getExerciseArray() {
    try {
      let query = {};
      let exerciseArray;
      if (isNaN(fromDate) && isNaN(toDate)) {
        query = { user_id: req.params._id};
        console.log('a');
      } else if (isNaN(fromDate) || isNaN(toDate)) {
        if (isNaN(fromDate)) {
          toDate = new Date(toDate);
          query = { date: { $lt: toDate }, user_id: req.params._id };
        } else {
          fromDate = new Date(fromDate);
          query = { date: { $gt: fromDate }, user_id: req.params._id };
        }
      } else {
        fromDate = new Date(fromDate);
        toDate = new Date(toDate);
        query = { date: { $lt: toDate, $gt: fromDate }, user_id: req.params._id };
        console.log('b');
      }
      if (isNaN(limit)) {
        exerciseArray = await db.collection('user_exercises').find(query).sort({ date: -1 }).toArray();
      } else {
        exerciseArray = await db.collection('user_exercises').find(query).sort({ date: -1 }).limit(limit).toArray();
      }
      const formattedArray = exerciseArray.map(el => {
      let { date, description, duration } = el;
      date = el.date.toDateString();
      return { description, duration, date };
    });
    console.log(exerciseArray)
    res.json({
      username: exerciseArray[0].username, 
      count: exerciseArray.length, 
      _id: exerciseArray[0].user_id, 
      log: formattedArray});
    } catch (err) {
      console.log(err);
      res.json({error: err, message: 'I fucked up somewhere :('})
    }
  }
  getExerciseArray();
});



const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
