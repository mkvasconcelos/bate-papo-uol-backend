import express from "express";
import cors from "cors";

const app = express();
const PORT = 5001;
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  return res.status(200).send("OK");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
