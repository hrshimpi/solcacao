// A small mongoose plugin that cleans up what toJSON returns: _id becomes id, __v is dropped,
// and any field marked private: true in the schema is left out. Add it with schema.plugin(jsonPlugin).
import type { Schema } from "mongoose";

export function jsonPlugin(schema: Schema): void {
  const privatePaths = Object.keys(schema.paths).filter((path) => schema.path(path).options?.private === true);

  schema.set("toJSON", {
    versionKey: false,
    transform(_doc, ret) {
      // embedded documents that switched their _id off have nothing to rename
      if (ret._id !== undefined) {
        ret.id = String(ret._id);
        delete ret._id;
      }
      for (const path of privatePaths) {
        delete ret[path];
      }
      return ret;
    },
  });
}
