import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import uploadRoutes from "./routes/upload.routes.js";

const app = express();

dotenv.config();

app.use(cors());
app.use(express.json());

app.use("/api/uploads", uploadRoutes);

export default app;
