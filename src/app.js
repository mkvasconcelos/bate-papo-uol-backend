import express from "express";
import cors from "cors";
import Joi from "joi";
import dayjs from "dayjs";
import { MongoClient } from "mongodb";

const mongoClient = new MongoClient("mongodb://localhost:27017");
let db;

mongoClient.connect().then(() => {
  db = mongoClient.db("bate-papo-uol");
});

const schema = Joi.object({
  name: Joi.string(),
});

const app = express();
const PORT = 5001;
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
