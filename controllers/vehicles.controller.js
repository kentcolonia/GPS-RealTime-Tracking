// controllers/vehicles.controller.js
import { db } from "../db/index.js";

export async function list(req, res) {
  const [vehicles] = await db.query("SELECT * FROM vehicles");
  res.render("vehicles/list", { vehicles });
}

export async function create(req, res) {
  const { plate, model } = req.body;
  await db.query(
    "INSERT INTO vehicles (plate, model) VALUES (?,?)",
    [plate, model]
  );
  res.redirect("/vehicles");
}
