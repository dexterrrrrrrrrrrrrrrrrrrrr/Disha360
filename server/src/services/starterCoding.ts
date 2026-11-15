import { CodingProblem, problemSchema } from "../models/CodingProblem.js";
import { codingSamples } from "./sampleCoding.js";

// Distinct keys keep these published challenges separate from development data.
const starters = codingSamples.map(({ key, title, ...content }) =>
  problemSchema.parse({
    ...content,
    key: key.replace("sample-coding-", "starter-coding-"),
    title: title.replace(/^\[SAMPLE\] /, ""),
    demo: false,
    published: true,
    version: 1,
  }),
);

export async function publishStarterCoding() {
  const now = new Date();
  for (const problem of starters) {
    try {
      await CodingProblem.updateOne(
        { key: problem.key },
        { $setOnInsert: { ...problem, createdAt: now, updatedAt: now } },
        { upsert: true, timestamps: false, runValidators: true },
      );
    } catch (error) {
      // Another instance may have inserted the same starter while we booted.
      if (!(typeof error === "object" && error && "code" in error && error.code === 11000)) throw error;
    }
  }
}
