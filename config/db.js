import mysql from "mysql2/promise";

const pool = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "",        // leave blank if phpMyAdmin root has no password
  database: "gps_vehicle",
  waitForConnections: true,
  connectionLimit: 10
});

export default pool;
