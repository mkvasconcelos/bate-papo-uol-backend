import express from "express";
import cors from "cors";
import Joi from "joi";
import { MongoClient } from "mongodb";
import dayjs from "dayjs";
import dotenv from "dotenv";
dotenv.config();

// const mongoClient = new MongoClient("mongodb://localhost:27017");
const mongoClient = new MongoClient(process.env.DATABASE_URL);
let db;

mongoClient.connect().then(() => {
  db = mongoClient.db();
});

const schema = Joi.object({
  name: Joi.string().required(),
  to: Joi.string().required(),
  text: Joi.string().required(),
  type: Joi.string().valid("private_message", "message").required(),
});

const app = express();
const PORT = 5001;
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
  if (participantUsed) return res.sendStatus(409);
  try {
    await schema.validateAsync({
      name,
    });
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

app.post("/messages", async (req, res) => {
  const { to, text, type } = req.body;
  const name = req.headers.user;
  const participantUsed = await db.collection("participants").findOne({
    name,
  });
  if (!participantUsed) return res.sendStatus(422);
  try {
    await schema.validateAsync({
      name,
      to,
      text,
      type,
    });
    db.collection("messages").insertOne({
      from: name,
      to,
      text,
      type,
      time: dayjs().format("HH:mm:ss"),
    });
    return res.sendStatus(200);
  } catch {
    return res.sendStatus(422);
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
