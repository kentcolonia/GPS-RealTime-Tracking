import express from "express";
const router = express.Router();

router.get("/", (req, res) => {
  res.send("Logs route working 📜");
});

export default router;
