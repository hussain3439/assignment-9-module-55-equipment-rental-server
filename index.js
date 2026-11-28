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
const bookingsCollection = database.collection("bookings");

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
app.get("/equipments/owner/:email", async (req, res) => {
  const email = req.params.email;
  const query = { ownerEmail: email };
  const result = await equipmentsCollection
    .find(query)
    .sort({ dateEquipment: -1 })
    .toArray();
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
  let sortOption = { dateEquipment: -1 };

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
app.get("/featured-equipments", async (req, res) => {
  const result = await equipmentsCollection
    .find()
    .sort({ dateEquipment: -1 })
    .limit(6)
    .toArray();
  res.send(result);
});
app.get("/category-equipments", async (req, res) => {
  const result = await equipmentsCollection.distinct("category");
  res.send(result);
});
app.get("/equipments/:id", async (req, res) => {
  const id = req.params.id;
  const query = { _id: new ObjectId(id) };
  const result = await equipmentsCollection.findOne(query);
  console.log(result);
  res.send(result);
});

// bookings related apis:
// app.post("/bookings", async (req, res) => {
//   const bookingData = req.body;
//   const result = await bookingsCollection.insertOne({
//     ...bookingData,
//     bookingStatus: "pending",
//     paymentStatus: "unpaid",
//     createdAt: new Date(),
//   });
//   console.log(result, "the booking data is");
//   res.send(result);
// });

app.post("/bookings", async (req, res) => {
  const {
    equipmentId,
    customerId,
    customerName,
    customerEmail,
    startDate,
    endDate,
    quantity,
    contactPhone,
    deliveryAddress,
    specialInstructions,
  } = req.body;

  // Check required fields
  if (
    !equipmentId ||
    !customerId ||
    !startDate ||
    !endDate ||
    !quantity ||
    !contactPhone ||
    !deliveryAddress
  ) {
    return res.status(400).send({
      success: false,
      message: "Please provide all required information",
    });
  }

  // Find equipment
  const equipment = await equipmentsCollection.findOne({
    _id: new ObjectId(equipmentId),
  });

  if (!equipment) {
    return res.status(404).send({
      success: false,
      message: "Equipment not found",
    });
  }

  // Validate quantity
  const requestedQuantity = Number(quantity);

  if (
    !Number.isInteger(requestedQuantity) ||
    requestedQuantity < 1 ||
    requestedQuantity > equipment.quantity
  ) {
    return res.status(400).send({
      success: false,
      message: "Invalid equipment quantity",
    });
  }

  // Validate dates
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    end <= start
  ) {
    return res.status(400).send({
      success: false,
      message: "Please select valid dates",
    });
  }

  // Calculate rental days
  const rentalDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);

  // Calculate rental units
  const periodDays =
    equipment.rentalType === "daily"
      ? 1
      : equipment.rentalType === "weekly"
        ? 7
        : 30;

  const rentalUnits = Math.ceil(rentalDays / periodDays);

  // Calculate total amount
  const totalAmount = equipment.price * rentalUnits * requestedQuantity;

  // Prepare booking data
  const bookingData = {
    equipmentId: equipment._id.toString(),
    equipmentName: equipment.name,
    ownerId: equipment.ownerId,

    customerId,
    customerName,
    customerEmail,

    startDate,
    endDate,
    rentalDays,
    rentalUnits,
    quantity: requestedQuantity,

    price: equipment.price,
    rentalType: equipment.rentalType,
    totalAmount,

    contactPhone,
    deliveryAddress,
    specialInstructions: specialInstructions || "",

    bookingStatus: "pending",
    paymentStatus: "unpaid",
    createdAt: new Date(),
  };

  // Save booking
  const result = await bookingsCollection.insertOne(bookingData);

  res.status(201).send({
    success: true,
    message: "Booking created successfully",
    bookingId: result.insertedId,
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
