import express from "express";
import cors from "cors";
import Joi from "joi";
import { MongoClient, ObjectId } from "mongodb";
import dayjs from "dayjs";
import dotenv from "dotenv";
import { stripHtml } from "string-strip-html";
dotenv.config();

const mongoClient = new MongoClient(process.env.DATABASE_URL);
let db;

mongoClient.connect().then(() => {
  db = mongoClient.db();
});

try {
  await mongoClient.connect();
  db = mongoClient.db();
} catch (error) {
  console.error("mongoClient.connect() error!");
}

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

const schemaName = Joi.object({
  name: Joi.string().required(),
});

const schemaLimit = Joi.object({
  limit: Joi.number().positive().integer(),
});

setInterval(async () => {
  const participantsRemoved = await db
    .collection("participants")
    .find({
      lastStatus: { $lt: Date.now() - 10000 },
    })
    .toArray();
  participantsRemoved.map(async (p) => {
    const { _id, name } = p;
    await db.collection("messages").insertOne({
      from: stripHtml(name).result,
      to: "Todos",
      text: "sai da sala...",
      type: "status",
      time: dayjs().format("HH:mm:ss"),
    });
    await db.collection("participants").deleteOne({
      _id,
    });
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
  if (!name) return res.sendStatus(422);
  const participantUsed = await db.collection("participants").findOne({
    name,
  });
  if (participantUsed) return res.sendStatus(409);
  schemaName
    .validateAsync({
      name,
    })
    .catch(() => {
      return res.sendStatus(422);
    });
  try {
    await db.collection("participants").insertOne({
      name: stripHtml(name).result,
      lastStatus: Date.now(),
    });
    await db.collection("messages").insertOne({
      from: stripHtml(name).result,
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

app.get("/messages", async (req, res) => {
  let { limit } = req.query;
  if (Number(limit) === 0) {
    return res.sendStatus(422);
  }
  limit = limit ? Number(limit) : 0;
  const name = req.headers.user;
  if (limit !== 0) {
    schemaLimit.validateAsync({ limit }).catch(() => {
      return res.sendStatus(422);
    });
  }
  // .sort({ $natural: -1 })
  await db
    .collection("messages")
    .find({
      $or: [{ from: name }, { to: "Todos" }, { to: name }],
    })
    .sort({ $natural: limit === 0 ? 1 : -1 })
    .limit(limit)
    .toArray()
    .then((messages) => {
      return res.status(200).send(messages);
    });
});

app.post("/messages", async (req, res) => {
  const { to, text, type } = req.body;
  const name = req.headers.user;
  schema
    .validateAsync({
      name,
      to,
      text,
      type,
    })
    .catch(() => {
      return res.sendStatus(422);
    });
  const participantUsed = await db.collection("participants").findOne({
    name,
  });
  if (!participantUsed) return res.sendStatus(422);

  try {
    db.collection("messages").insertOne({
      from: stripHtml(name).result,
      to,
      text: stripHtml(text).result.trim(),
      type,
      time: dayjs().format("HH:mm:ss"),
    });
    return res.sendStatus(201);
  } catch {
    return res.sendStatus(422);
  }
});

app.delete("/messages/:ID_MESSAGE", async (req, res) => {
  const id = req.params.ID_MESSAGE;
  const name = req.headers.user;
  const messageRemoved = await db.collection("messages").findOne({
    _id: ObjectId(id),
  });
  if (!messageRemoved) {
    return res.sendStatus(404);
  } else if (messageRemoved.from !== name) {
    return res.sendStatus(401);
  } else {
    await db.collection("messages").deleteOne({
      _id: ObjectId(id),
    });
    return res.sendStatus(200);
  }
});

app.put("/messages/:ID_MESSAGE", async (req, res) => {
  const id = req.params.ID_MESSAGE;
  const name = req.headers.user;
  const { to, text, type } = req.body;
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
  const messageUpdated = await db.collection("messages").findOne({
    _id: ObjectId(id),
  });
  if (!messageUpdated) {
    return res.sendStatus(404);
  } else if (messageUpdated.from !== name) {
    return res.sendStatus(401);
  } else {
    await db
      .collection("participants")
      .updateOne(
        { _id: ObjectId(id) },
        { $set: { to, text, type, from: name } }
      );
    return res.sendStatus(200);
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
