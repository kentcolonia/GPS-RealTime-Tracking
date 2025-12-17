import express from "express";
import requireLogin from "../middleware/auth.js";

const router = express.Router();

router.get("/", requireLogin, (req, res) => {
  res.render("dashboard");
});

export default router;
