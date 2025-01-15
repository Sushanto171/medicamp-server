require("dotenv").config();
const express = require("express");
const app = express();
const { MongoClient, ServerApiVersion } = require("mongodb");
const cors = require("cors");
const port = process.env.PROT || 5000;

const uri = process.env.DB_USER;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
// middleware
app.use(express.json());
app.use(cors());

const run = async () => {
  try {
    // create db collection
    const usersCollection = client.db("MediCamp").collection("users");

    // users related api
    app.post("/users/:email", async (req, res) => {
      try {
        const email = req.params.email;
        const userData = req.body;

        // check user
        const isExist = await usersCollection.findOne({ email });
        if (isExist) {
          res.status(200).json({ message: "User already exist in db" });
          return;
        }
        // create user on db
        const result = await usersCollection.insertOne(userData);
        res.status(201).json({
          success: true,
          message: "Success fully user registered",
          data: result,
        });
      } catch (error) {
        res.status(500).send({ message: "internal server error" });
      }
    });

    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
};
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("MediCamp running ....");
});

app.listen(port, () => {
  console.log(`MediCamp running on port: ${port}`);
});
