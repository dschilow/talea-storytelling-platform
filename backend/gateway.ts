import { Gateway } from "encore.dev/api";

export const gateway = new Gateway({ cors: {
  allowOriginsWithoutCredentials: [
    "https://sunny-optimism-production.up.railway.app",
    "https://talea-storytelling-platform-d2okv1482vjjq7d7fpi0.lp.dev",
    /.+\.lp\.dev$/,
    /.+\.up\.railway\.app$/,
  ],
  allowOriginsWithCredentials: [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:4000",
  ],
} });
