import express from "express";
import requireLogin from "../middleware/auth.js";

const router = express.Router();

router.get("/", requireLogin, (req, res) => {
  // Pass the user object from the session to the EJS template
  res.render("dashboard", {
    user: req.session.user 
  });
});

export default router;