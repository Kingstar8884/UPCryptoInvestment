const { MongoClient } = require('mongodb');
const mongoURL = process.env.MONGO_URI;
const client = new MongoClient(mongoURL);
const dbName = process.env.MONGO_DB;
let db, stark,tasks;


const connectToDatabase = async () => {

    try {
      await client.connect();

      db = client.db(dbName);
      
      stark = db.collection('All-Users');
      tasks = db.collection('All-Tasks');

      const bott = await  stark.findOne({ name: 'UPCRYPTO'});

      if (!bott){
        await stark.insertOne({
          name: 'UPCRYPTO',
          withdrawal: 'disabled',
        });

        console.log("Bot's data configured successfully!");
      }

      /*stark.updateMany({ }, {
        $set: {
          eligible: "yes"
        }
      });*/

/*
      tasks.insertMany([
          {
            taskId: "437834yuruyr",
            type: "Telegram",
            earn: 3,
            link: 'https://youtube.com/dhgdhdhj',
            completedBy: []
        },
        {
          taskId: "38934834er",
          type: "Youtube",
          earn: 2,
          link: 'https://youtube.com/dhgdhdhj',
          completedBy: []
        },
        {
          taskId: "reuifhe",
          type: "Youtube",
          earn: 1,
          link: 'https://youtube.com/dhgdhdhj',
          completedBy: []
        },
        {
          taskId: "346ryur",
          type: "Telegram",
          earn: 9,
          link: 'https://youtube.com/dhgdhdhj',
          completedBy: []
      },
      {
        taskId: "34783474hre",
        type: "Telegram",
        earn: 2.4,
        link: 'https://youtube.com/dhgdhdhj',
        completedBy: []
      },
      {
        taskId: "4378reu",
        type: "Youtube",
        earn: 30,
        link: 'https://youtube.com/dhgdhdhj',
        completedBy: []
      }
      ]);
*/

      console.log(`Connected to database`);

      //await stark.createIndex({ referral: 1 }, { unique: false });
      //console.log('Index on referral field checked/created');

    } catch (err) {

      console.log(`Error connecting to database`);
      
      console.log(err);
    }

  }


async function getUser(user) {
    try {
      const u = await stark.findOne({ tg_id: user });
      return u;
    } catch (err) {
      console.log(err);
      return null;
    }
  }
  
  async function addUser(user) {
    try {
      await stark.insertOne(user);
      return true;
    } catch (err) {
      console.log(err);
      return null;
    }
  }
  
async function updateUser(user, data) {
    try {
      const res = await stark.updateOne({ tg_id: user }, data);
      //console.log(res);
      return true;
    } catch (err) {
      console.log(err);
      return null;
    }
  }
  


  const allUser = async () => {
    try {
      const res = await stark.find({}).toArray();
      return res;
    } catch (err) {
      console.log(err);
      return null;
    }
  }





const topReferrals = async () => {
  try {
    const leaders = await stark
      .find(
        { referral: { $gt: 0 } },
        { projection: { tg_id: 1, referral: 1, _id: 0} }
      )
      .sort({ referral: -1 })
      .limit(100) 
      .toArray();

    return leaders;
  } catch (e) {
    console.log(e);
    return e;
  }
};




  const pendingTask = async (userId) => {
    try {
      const completed = await tasks.aggregate([
        {
            $match: {
              completedBy: { $nin: [userId] }
            }
        }
    ]).toArray();
    return completed;
     } catch (e) {
      return [];
    }
  }




const completedTask = async (userId) => {
  try {
    const completed = await tasks.aggregate([
      {
          $match: {
            completedBy: { $in: [userId] }
          }
      }
  ]).toArray();
  return completed;
  } catch (e) {
    return [];
  }
}


async function addTasks(task) {
  try {
    await tasks.insertOne(task);
    return true;
  } catch (err) {
    console.log(err);
    return null;
  }
}


async function findTask(id) {
  try {
    const task = await tasks.findOne({ taskId: id });
    return task;
  } catch (err) {
    console.log(err);
    return null;
  }
}


async function updateTask(taskid, data) {
  try {
    const res = await tasks.updateOne({ taskId: taskid }, data);
    //console.log(res);
    return true;
  } catch (err) {
    console.log(err);
    return null;
  }
}





const starkNilX = {
  aggregate: async (data) => {
    try {
      const res = await stark.aggregate(data).toArray();
    return res;
    } catch (e) {
      console.log(e);
      return null;
    }
  },

  aggregates: async (data) => {
    try {
      const res = await stark.aggregate(data).next();
    return res;
    } catch (e) {
      console.log(e);
      return null;
    }
  },

  totalUsers: async () => {
    try {
      return await stark.countDocuments();
    } catch (e) {
      console.log(e);
      return null;
    }
  },

  find: async (data) => {
    try {
      return await stark.find(data).toArray();
    } catch (e) {
      console.log(e);
      return null;
    }
  },

  getBot: async () => {
    try {
      return await stark.findOne({name: process.env.BOT_NAME});
    } catch (e) {
      console.log(e);
      return null;
    }
  },

  updateBot: async(data) => {
    try {
      const res = await stark.updateOne({ name: process.env.BOT_NAME }, data);
      return true;
    } catch (err) {
      console.log(err);
      return null;
    }
  }
}


module.exports = {
  connectToDatabase,
  addUser,
  getUser,
  updateUser,
  allUser,
  topReferrals,
  completedTask,
  addTasks,
  pendingTask,
  findTask,
  updateTask,
  starkNilX
};
