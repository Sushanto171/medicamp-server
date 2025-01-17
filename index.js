require("dotenv").config();
const express = require("express");
const app = express();
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
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

const verifyToken = (req, res, next) => {
  try {
    const data = req.headers?.authorization;
    const [Bearer, token] = data?.split(" ");
    if (!token) {
      res
        .status(401)
        .send({ message: "Unauthorized: Invalid or expired token" });
      return;
    }
    // verify token
    jwt.verify(token, process.env.JWT_SECRET_KEY, (error, decode) => {
      if (error) {
        res
          .status(401)
          .send({ message: "Unauthorized: Invalid or expired token" });
        return;
      }
      req.user = decode.email;
      next();
    });
  } catch (error) {
    res.status(500).json({ message: "internal server error", error });
  }
};

const run = async () => {
  try {
    // create db collection
    const usersCollection = client.db("MediCamp").collection("users");
    const campsCollection = client.db("MediCamp").collection("camps");
    const participantsCollection = client
      .db("MediCamp")
      .collection("participants");

    // generate token
    app.post("/jwt", async (req, res) => {
      try {
        const secretKey = process.env.JWT_SECRET_KEY;
        const user = req.body;
        const token = jwt.sign(user, secretKey, { expiresIn: "30min" });

        res
          .status(201)
          .json({ message: "Successfully JWT Token generated ", token });
      } catch (error) {
        res.status(500).json({ message: "internal server error" });
      }
    });

    //participant related apis
    app.post("/participants/:id", verifyToken, async (req, res) => {
      try {
        const participantData = req.body;

        const id = req.params.id;
        const result = await participantsCollection.insertOne(participantData);
        // update camp participant filed
        const camp = await campsCollection.findOne({ _id: new ObjectId(id) });
        let modify;
        if (camp) {
          const update = { $inc: { participantCount: 1 } };
          modify = await campsCollection.updateOne(
            { _id: new ObjectId(id) },
            update
          );
        }
        res.status(200).json({
          success: true,
          message: "Successfully participated in the camp",
          data: result,
          isModify: modify,
        });
      } catch (error) {
        res.status(500).json({ message: "internal server error", error });
      }
    });

    // get camp by id
    app.get("/camp/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const result = await campsCollection.findOne({ _id: new ObjectId(id) });
        res.status(200).json({
          success: true,
          message: "Camp fetching success",
          data: result,
        });
      } catch (error) {
        res.status(500).send({ message: "Internal server error", error });
      }
    });

    // camps related apis
    app.get("/camps", async (req, res) => {
      try {
        const { home, sort, search } = req.query;
        let query = {};
        // search
        if (search && search !== "null") {
          query = {
            $or: [
              { campName: { $regex: search.trim(), $options: "i" } },
              {
                healthcareProfessional: {
                  $regex: search.trim(),
                  $options: "i",
                },
              },
              { location: { $regex: search.trim(), $options: "i" } },
              { date: { $regex: search.trim(), $options: "i" } },
            ],
          };
        }

        let result;
        // if home then aggregate
        if (home === "true") {
          result = await campsCollection
            .aggregate([{ $sort: { participantCount: -1 } }, { $limit: 6 }])
            .toArray();
        } else {
          // conditionally set sortValue
          let sortValue = {};
          if (sort !== "Sort") {
            const key =
              sort === "Camp Fees"
                ? "campFees"
                : sort === "Most Registered"
                ? "participantCount"
                : "campName";
            sortValue[key] = sort === "A-Z Order" ? 1 : -1;
          }
          result = await campsCollection.find(query).sort(sortValue).toArray();
        }

        res.status(200).json({
          success: true,
          message: "Camps data fetching success",
          data: result,
        });
      } catch (error) {
        console.log(error);
        res.status(500).json({ message: "internal sever error" });
      }
    });

    // users related api
    app.get("/admin/:email", verifyToken, async (req, res) => {
      try {
        const userEmail = req.user;
        const email = req.params.email;

        if (userEmail !== email) {
          return res
            .status(403)
            .json({ message: "Forbidden: unauthorized access" });
        }
        const result = await usersCollection.findOne({ email });
        const isAdmin = result?.role === "admin" ? true : false;
        res.status(200).json({ message: "User verify success", data: isAdmin });
      } catch (error) {
        res.status(500).json({ message: "internal server error", error });
      }
    });

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

    // get users
    app.get("/users", async (req, res) => {
      try {
        const result = await usersCollection.find({}).toArray();
        res.status(200).json({
          success: true,
          message: "All users data fetching success",
          data: result,
        });
      } catch (error) {
        res.status(500).json({ message: "internal server error" });
      }
    });

    // get user by id
    app.get("/user/:email", verifyToken, async (req, res) => {
      try {
        const userEmail = req.user;
        const email = req.params.email;
        if (userEmail !== email) {
          return res
            .status(403)
            .json({ message: "Forbidden: unauthorized access" });
        }

        const result = await usersCollection.findOne({ email });
        res
          .status(200)
          .json({ message: "fetching success", success: true, data: result });
      } catch (error) {
        console.log(error);
        res.status(500).json({ message: "internal server error", error });
      }
    });

    // update user by id
    app.patch("/user/:email", verifyToken, async (req, res) => {
      try {
        const email = req.params.email;
        const userData = req.body;
        const update = { $set: userData };
        const result = await usersCollection.updateOne({ email }, update);
        res
          .status(200)
          .json({ message: "updated success", success: true, data: result });
      } catch (error) {
        res.status(500).json({ message: "internal server error", error });
      }
    });

    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
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
