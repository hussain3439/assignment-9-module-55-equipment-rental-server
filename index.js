import express from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
import "dotenv/config";

const PORT = process.env.PORT || 5000;

const app = express();

app.use(cors());
app.use(express.json());

const client =
  new MongoClient(`mongodb://${process.env.DB_USER}:${process.env.DB_PASSWORD}@ac-khznulz-shard-00-00.prdzdmt.mongodb.net:27017,ac-khznulz-shard-00-01.prdzdmt.mongodb.net:27017,ac-khznulz-shard-00-02.prdzdmt.mongodb.net:27017/?ssl=true&replicaSet=atlas-12cy19-shard-0&authSource=admin
`);

export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
    return client;
  } catch (err) {
    console.dir(err);
  }
}
const connectClient = await connectToMongoDB();
const database = connectClient.db("equipmentDB");

const usersCollection = database.collection("user");
const equipmentsCollection = database.collection("equipments");

app.get("/", async (req, res) => {
  res.send({ msg: "The equipment is fine!" });
});

// users related apis:
app.get("/users", async (req, res) => {
  const result = await usersCollection.find({}).toArray();
  res.send(result);
  // console.log(result, "The all users is...");
});

// equipments related apis:
app.post("/equipments", async (req, res) => {
  const data = {
    ...req.body,
    dateEquipment: new Date().toISOString(),
  };
  const result = await equipmentsCollection.insertOne(data);
  res.send(result);
  //   console.log(result, "the post equipment is...");
});
app.get("/equipments/:email", async (req, res) => {
  const email = req.params.email;
  const query = { ownerEmail: email };
  const result = await equipmentsCollection.find(query).toArray();
  res.send(result);
  // console.log(result, 'specefiq owner all equepments')
});
app.get("/equipments", async (req, res) => {
  const query = {};

  if (req.query) {
    if (req.query.name) {
      query.name = req.query.name;
    }
    if (req.query.rentalType) {
      query.rentalType = req.query.rentalType;
    }
    if (req.query.category && req.query.category !== "All Categories") {
      query.category = req.query.category;
    }
    if (req.query.minPrice || req.query.maxPrice) {
      query.price = {};

      if (req.query.minPrice) {
        query.price.$gte = Number(req.query.minPrice);
      }

      if (req.query.maxPrice) {
        query.price.$lte = Number(req.query.maxPrice);
      }
    }
    if (req.query.availability === "available") {
      query.quantity = { $gt: 0 };
    }

    if (req.query.availability === "unavailable") {
      query.quantity = { $lte: 0 };
    }
    if (req.query.search) {
      query.$or = [
        { name: { $regex: req.query.search, $options: "i" } },
        { location: { $regex: req.query.search, $options: "i" } },
      ];
    }
  }
  let sortOption = {};

  if (req.query.sort === "price-asc") {
    sortOption = { price: 1 };
  } else if (req.query.sort === "price-desc") {
    sortOption = { price: -1 };
  } else if (req.query.sort === "recent") {
    sortOption = { _id: -1 };
  }

  const result = await equipmentsCollection
    .find(query)
    .sort(sortOption)
    .toArray();
  res.send(result);
  // console.log(result, 'all equepments')
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
