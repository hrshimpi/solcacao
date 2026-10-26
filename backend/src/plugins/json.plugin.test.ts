import mongoose from "mongoose";
import { describe, expect, it } from "vitest";
import { jsonPlugin } from "./json.plugin.ts";

const lineSchema = new mongoose.Schema({ text: String }, { _id: false });
const thingSchema = new mongoose.Schema({
  name: String,
  secret: { type: String, private: true },
  lines: [lineSchema],
});
thingSchema.plugin(jsonPlugin);
const Thing = mongoose.model("JsonPluginThing", thingSchema);

describe("jsonPlugin", () => {
  it("returns id instead of _id and drops __v", () => {
    const thing = new Thing({ name: "bar" });
    const json = thing.toJSON();

    expect(json).toHaveProperty("id", String(thing._id));
    expect(json).not.toHaveProperty("_id");
    expect(json).not.toHaveProperty("__v");
    expect(json.name).toBe("bar");
  });

  it("leaves out fields marked private", () => {
    const thing = new Thing({ name: "bar", secret: "hunter2" });

    expect(thing.secret).toBe("hunter2");
    expect(thing.toJSON()).not.toHaveProperty("secret");
    expect(JSON.stringify(thing)).not.toContain("hunter2");
  });

  it("does not invent an id for embedded documents that have no _id", () => {
    const thing = new Thing({ name: "bar", lines: [{ text: "one" }] });
    const line = thing.toJSON().lines[0];

    expect(line).toEqual({ text: "one" });
  });
});
