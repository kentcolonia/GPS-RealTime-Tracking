import express from "express";
const router = express.Router();

router.get("/", (req, res) => {
  res.send("Public tracking route working 🌍");
});

export default router;