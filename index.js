import express from "express";
import cors from "cors";
import "dotenv/config";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import { MongoClient, ObjectId, ServerApiVersion } from "mongodb";

const app = express();
const port = process.env.PORT || 5000;

app.use(express.json());
app.use(
  cors({
    origin: [
      "https://jobs-69b32.web.app",
      "https://jobs-69b32.firebaseapp.com",
      "http://localhost:5173",
    ],
    credentials: true,
  })
);
app.use(cookieParser());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.dqfkiqe.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );

    const verifyToken = (req, res, next) => {
      const { token } = req.cookies;

      if (!token) {
        return res.status(401).send({ message: "Unauthorized" });
      }
      jwt.verify(token, process.env.SECRET, function (err, decoded) {
        if (err) {
          return res.status(401).send({ message: "Unauthorized" });
        }
        req.user = decoded;
        next();
      });
    };

    // Collections
    const jobCollection = client.db("jobsDB").collection("jobs");
    const appliedCollection = client.db("jobsDB").collection("applied");

    // GET Jobs / by querying
    app.get("/api/v1/jobs", async (req, res) => {
      const category = req.query.cat;
      const searchQuery = req.query.q;
      let query = {};
      if (category) {
        query.category = category;
      }

      if (searchQuery) {
        // Regular expression for case-insensitive search
        query.title = { $regex: searchQuery, $options: "i" };
      }

      const result = await jobCollection
        .find(query)
        .sort({ date: -1 })
        .toArray();
      res.send(result);
    });

    // GET Popular Jobs (by applicants)
    app.get("/api/v1/popular-jobs/", async (req, res) => {
      const result = await jobCollection
        .find()
        .sort({ applicants: -1 })
        .limit(3)
        .toArray();
      res.send(result);
    });

    app.post("/api/v1/jobs", async (req, res) => {
      const body = req.body;
      const result = await jobCollection.insertOne(body);
      res.send(result);
    });

    // Apply Job
    app.post("/api/v1/apply-job", verifyToken, async (req, res) => {
      const body = req.body;

      const existingApplication = await appliedCollection.findOne({
        job_id: body.job_id,
        email: body.email,
      });

      if (existingApplication) {
        // If an existing application is found, return an error response
        res.status(400).send({
          success: false,
          message: "User has already applied for this job",
        });
      } else {
        // Increment the "applicants" count
        const result = await jobCollection.findOneAndUpdate(
          { _id: new ObjectId(body.job_id) },
          { $inc: { applicants: 1 } }
        );

        if (result) {
          // Insert the application
          const applicationResult = await appliedCollection.insertOne(body);
          res.send(applicationResult);
        } else {
          res.status(500).send({
            success: false,
            message: 'Failed to update "applicants" count',
          });
        }
      }
    });

    // GET Applied jobs
    app.get("/api/v1/applied-jobs/", verifyToken, async (req, res) => {
      const email = req.query.email;
      const category = req.query.category;
      if (req.user.email !== email) {
        return res.status(403).send({ message: "Access denied" });
      }
      const query = {};
      if (email) {
        query.email = email;
      }

      if (category) {
        query.category = category;
      }
      const result = await appliedCollection.find(query).toArray();
      res.send(result);
    });

    // GET Job by id
    app.get("/api/v1/job/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await jobCollection.findOne(filter);
      res.send(result);
    });

    // Update Job
    app.put("/api/v1/job/:id", async (req, res) => {
      const id = req.params.id;
      const body = req.body;
      const filter = { _id: new ObjectId(id) };
      const updated = {
        $set: {
          ...body,
        },
      };
      const result = await jobCollection.updateOne(filter, updated, {
        upsert: true,
      });
      res.send(result);
    });

    // Delete Job
    app.delete("/api/v1/job/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await jobCollection.deleteOne(filter);
      res.send(result);
    });

    // Get Jobs by email
    app.get("/api/v1/jobs/user/:email", async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const result = await jobCollection
        .find(filter)
        .sort({ date: -1 })
        .toArray();
      res.send(result);
    });

    app.post("/api/v1/auth/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.SECRET);
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: true,
          sameSite: "none",
        })
        .send({ success: true });
    });

    app.post("/api/v1/logout", verifyToken, async (req, res) => {
      res.clearCookie("token", { maxAge: 0 }).send({ success: true });
    });
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Running");
});

app.listen(port);
