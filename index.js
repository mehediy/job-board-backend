import express from "express";
import cors from "cors";
import "dotenv/config";
import { MongoClient, ObjectId, ServerApiVersion } from "mongodb";

const app = express();
const port = process.env.PORT || 5000;

app.use(express.json());
app.use(cors());

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
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );

    // Collections
    const jobCollection = client.db("jobsDB").collection("jobs");

    // GET Jobs by category
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

      const result = await jobCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/api/v1/jobs", async (req, res) => {
      const body = req.body;
      const result = await jobCollection.insertOne(body);
      res.send(result);
    });

    // GET Job by id
    app.get("/api/v1/job/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await jobCollection.findOne(filter);
      res.send(result);
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
