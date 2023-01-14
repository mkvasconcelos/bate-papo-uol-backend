import express from "express";
import cors from "cors";
import Joi from "joi";
import { MongoClient, ObjectId } from "mongodb";
import dayjs from "dayjs";
import dotenv from "dotenv";
dotenv.config();

const mongoClient = new MongoClient(process.env.DATABASE_URL);
let db;

mongoClient.connect().then(() => {
  db = mongoClient.db();
});

const app = express();
const PORT = 5000;
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const schema = Joi.object({
  name: Joi.string().required(),
  to: Joi.string().required(),
  text: Joi.string().required(),
  type: Joi.string().valid("private_message", "message").required(),
});

setInterval(() => {
  db.collection("participants").deleteMany({
    lastStatus: { $lt: Date.now() - 10000 },
  });
}, 15000);

app.get("/participants", (_, res) => {
  db.collection("participants")
    .find()
    .toArray()
    .then((users) => {
      return res.status(200).send(users);
    });
});

app.post("/participants", async (req, res) => {
  const { name } = req.body;
  const participantUsed = await db.collection("participants").findOne({
    name,
  });
  if (participantUsed || !name) return res.sendStatus(409);
  schema.validate({
    name,
  });
  try {
    db.collection("participants").insertOne({
      name,
      lastStatus: Date.now(),
    });
    db.collection("messages").insertOne({
      from: name,
      to: "Todos",
      text: "entra na sala...",
      type: "status",
      time: dayjs().format("HH:mm:ss"),
    });
    return res.sendStatus(201);
  } catch (err) {
    return res.sendStatus(422);
  }
});

app.get("/messages", (req, res) => {
  let { limit } = req.query;
  limit = limit ? parseInt(limit) : 0;
  const name = req.headers.user;
  console.log(limit, name);
  db.collection("messages")
    .find({
      $or: [{ from: name }, { to: "Todos" }, { to: name }],
    })
    .limit(limit)
    .toArray()
    .then((messages) => {
      return res.status(200).send(messages);
    });
});

app.post("/messages", async (req, res) => {
  const { to, text, type } = req.body;
  const name = req.headers.user;
  const participantUsed = await db.collection("participants").findOne({
    name,
  });
  if (!participantUsed) return res.sendStatus(422);
  schema.validate({
    name,
    to,
    text,
    type,
  });
  try {
    db.collection("messages").insertOne({
      from: name,
      to,
      text,
      type,
      time: dayjs().format("HH:mm:ss"),
    });
    return res.sendStatus(201);
  } catch {
    return res.sendStatus(422);
  }
});

app.post("/status", async (req, res) => {
  const name = req.headers.user;
  const lastStatus = Date.now();
  const participantUsed = await db.collection("participants").findOne({
    name,
  });
  if (!participantUsed) return res.sendStatus(404);
  try {
    await db
      .collection("participants")
      .updateOne(
        { _id: ObjectId(participantUsed._id) },
        { $set: { lastStatus } }
      );
    return res.sendStatus(200);
  } catch {
    return res.sendStatus(500);
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
