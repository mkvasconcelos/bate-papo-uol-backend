import express from "express";
import cors from "cors";
import Joi from "joi";

// const Joi = require("joi");

const schema = Joi.object({
  name: Joi.string().alphanum().min(3).max(30).required(),
});

const app = express();
const PORT = 5001;
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.post("/participants", async (req, res) => {
  const { name } = req.body;
  try {
    await schema.validateAsync({
      name,
    });
    return res.status(200).send("OK");
  } catch (err) {
    return res.sendStatus(422);
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
