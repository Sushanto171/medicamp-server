require("dotenv").config();
const express = require("express");
const app = express();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
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
    const paymentsCollection = client.db("MediCamp").collection("payments");
    const campsCollection = client.db("MediCamp").collection("camps");
    const participantsCollection = client
      .db("MediCamp")
      .collection("participants");

    // create confirm intent
    app.post("/create-confirm-intent", verifyToken, async (req, res) => {
      try {
        const { fees, name, email } = req.body;
        if (!fees) {
          return res.status(400).json({ message: "Fees amount is required" });
        }
        if (!name || !email) {
          return res
            .status(400)
            .json({ message: "Name and email are required" });
        }

        const amount = parseInt(fees) * 100;
        const intent = await stripe.paymentIntents.create({
          amount: amount,
          currency: "usd",
          receipt_email: email,
          metadata: {
            name: name,
            email: email,
            fees: fees.toString(),
          },
          payment_method_types: ["card"],
        });

        res.status(200).json({ clientSecret: intent.client_secret });
      } catch (error) {
        res
          .status(500)
          .json({ message: "internal server error", error: error.message });
      }
    });

    // verify admin
    const verifyAdmin = async (req, res, next) => {
      try {
        const userEmail = req.user;
        const result = await usersCollection.findOne({ email: userEmail });

        const isAdmin = result?.role === "admin";
        if (!isAdmin) {
          return res
            .status(403)
            .json({ message: "Forbidden: unauthorized access" });
        }
        next();
      } catch (error) {
        res.status(500).json({ message: "internal server error", error });
      }
    };

    // generate token
    app.post("/jwt", async (req, res) => {
      try {
        const secretKey = process.env.JWT_SECRET_KEY;
        const user = req.body;
        const token = jwt.sign(user, secretKey, { expiresIn: "1hr" });

        res
          .status(201)
          .json({ message: "Successfully JWT Token generated ", token });
      } catch (error) {
        res.status(500).json({ message: "internal server error" });
      }
    });

    // payments relate apis
    app.post("/payments/:id", verifyToken, async (req, res) => {
      try {
        const id = req.params.id;
        const paymentData = req.body;
        const result = await paymentsCollection.insertOne(paymentData);
        const updateStatus = await participantsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { paymentStatus: true } }
        );
        res.status(200).json({
          message: "Payment Successfully",
          data: { result, updateStatus },
        });
      } catch (error) {
        res
          .status(500)
          .json({ message: "internal server error", error: error.message });
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

    // get participant data
    app.get("/participants", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const result = await participantsCollection
          .aggregate([
            {
              $addFields: {
                campID: { $toObjectId: "$campID" },
              },
            },
            {
              $lookup: {
                from: "camps",
                localField: "campID",
                foreignField: "_id",
                as: "campsDetails",
              },
            },
            {
              $unwind: {
                path: "$campsDetails",
                preserveNullAndEmptyArrays: true,
              },
            },
            {
              $project: {
                _id: 1,
                participantName: 1,
                participantEmail: 1,
                participantPhoto: 1,
                paymentStatus: 1,
                confirmationStatus: 1,
                campID: "$campsDetails._id",
                campName: "$campsDetails.campName",
                campFees: "$campsDetails.campFees",
              },
            },
          ])
          .toArray();
        res.status(200).json({
          success: true,
          message: "Successfully fetched all participants data",
          data: result,
        });
      } catch (error) {
        console.log(error);
        res.status(500).json({ message: "internal server error", error });
      }
    });

    // get participant data by email
    app.get("/participant/:email", verifyToken, async (req, res) => {
      try {
        const email = req.params.email;
        const result = await participantsCollection
          .aggregate([
            {
              $match: { participantEmail: email },
            },
            {
              $addFields: { campID: { $toObjectId: "$campID" } },
            },
            {
              $lookup: {
                from: "camps",
                localField: "campID",
                foreignField: "_id",
                as: "campsDetails",
              },
            },
            {
              $unwind: {
                path: "$campsDetails",
                preserveNullAndEmptyArrays: true,
              },
            },
            {
              $project: {
                _id: 1,
                participantName: 1,
                participantEmail: 1,
                confirmationStatus: 1,
                paymentStatus: 1,
                campName: "$campsDetails.campName",
                campFees: "$campsDetails.campFees",
                campID: "$campsDetails._id",
              },
            },
          ])
          .toArray();

        res
          .status(200)
          .json({ message: "Participant data fetching success", data: result });
      } catch (error) {
        res.status(500).json({ message: "internal server error", error });
      }
    });

    // update confirmation status
    app.patch(
      "/confirmation-participant/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        try {
          const id = req.params.id;
          const changeData = req.body;
          const result = await participantsCollection.updateOne(
            { _id: new ObjectId(id) },
            { $set: { confirmationStatus: true } }
          );
          res
            .status(200)
            .json({ message: "Status change successfully", data: result });
        } catch (error) {
          res.status(500).json({ message: "internal server error", error });
        }
      }
    );

    //participant delete by id and update camp participantCount value(-1)
    app.delete(
      "/delete-participant/:id/:campID",
      verifyToken,
      async (req, res) => {
        try {
          const id = req.params.id;
          const campID = req.params.campID;
          // 1. delete participant
          const result = await participantsCollection.deleteOne({
            _id: new ObjectId(id),
          });
          //2. update camp participantCount field
          let update;
          if (result) {
            update = await campsCollection.updateOne(
              { _id: new ObjectId(campID) },
              { $inc: { participantCount: -1 } }
            );
          }
          res.status(200).json({
            message: "Successfully canceled Participant registration",
            data: { update, result },
          });
        } catch (error) {
          res.status(500).json({ message: "internal server error", error });
        }
      }
    );

    // camp post
    app.post("/camps", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const campData = req.body;
        const result = await campsCollection.insertOne(campData);
        res.status(201).json({
          success: true,
          message: "Successfully created camp ",
          data: result,
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
        if (search && search !== "null" && search !== "undefined") {
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
          if (sort === "Sort" || sort !== "undefined") {
            // console.log(sort);
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

    // update camp by id
    app.patch(
      "/update-camp/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        try {
          const id = req.params.id;
          const updateCamp = req.body;
          const result = await campsCollection.updateOne(
            { _id: new ObjectId(id) },
            { $set: updateCamp }
          );

          res
            .status(200)
            .json({ message: "Successfully updated camp", data: result });
        } catch (error) {
          res.status(500).json({ message: "Internal server error", error });
        }
      }
    );

    // delete camp by id
    app.delete(
      "/delete-camp/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        try {
          const id = req.params.id;
          const result = await campsCollection.deleteOne({
            _id: new ObjectId(id),
          });
          res.status(200).json({
            message: "Camp has been successfully deleted",
            data: result,
          });
        } catch (error) {
          res.status(500).json({ message: "Internal server error" });
        }
      }
    );

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
