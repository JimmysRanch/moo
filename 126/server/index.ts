import "dotenv/config";
import express from "express";
import cors from "cors";
import { onboardingRouter } from "./routes/onboarding.js";
import { staffInviteRouter } from "./routes/staffInvite.js";

const app = express();
const PORT = Number(process.env.PORT || 4242);

app.use(cors({ origin: process.env.APP_BASE_URL || "http://localhost:5173", credentials: true }));
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/api/onboarding", onboardingRouter);
app.use("/api/staff", staffInviteRouter);

app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
