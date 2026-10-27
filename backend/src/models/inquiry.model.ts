// The Inquiry model: one message from the contact page, a piece of feedback or a newsletter sign up.
// Which fields are needed depends on the category, the same rules the zod schema checks on the way in.
import { model, Schema, type HydratedDocument, type Types } from "mongoose";
import { jsonPlugin } from "../plugins/json.plugin.ts";

export const inquiryCategories = ["general", "wholesale", "support", "feedback", "newsletter"] as const;
export const inquiryStatuses = ["new", "responded"] as const;

export type InquiryCategory = (typeof inquiryCategories)[number];
export type InquiryStatus = (typeof inquiryStatuses)[number];

export interface InquiryData {
  userId?: Types.ObjectId;
  name?: string;
  email?: string;
  category: InquiryCategory;
  message?: string;
  rating?: number;
  status: InquiryStatus;
  createdAt: Date;
}

export type InquiryDocument = HydratedDocument<InquiryData>;

// the three categories where someone writes to us and expects an answer
const writtenCategories: InquiryCategory[] = ["general", "wholesale", "support"];

type WithCategory = { category?: InquiryCategory };

// builds a "required" check that only applies to some categories
function requiredFor(categories: InquiryCategory[]) {
  return function (this: WithCategory) {
    return this.category !== undefined && categories.includes(this.category);
  };
}

const inquirySchema = new Schema<InquiryData>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    name: { type: String, trim: true, maxlength: 80, required: requiredFor(writtenCategories) },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 254,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "{PATH} must be a valid email address"],
      required: requiredFor(["general", "wholesale", "support", "newsletter"]),
    },
    category: { type: String, enum: inquiryCategories, required: true },
    message: { type: String, trim: true, maxlength: 2000, required: requiredFor(writtenCategories) },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      required: requiredFor(["feedback"]),
    },
    status: { type: String, enum: inquiryStatuses, default: "new" },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

inquirySchema.path("rating").validate(
  (value: number | null | undefined) => value === null || value === undefined || Number.isInteger(value),
  "{PATH} must be a whole number",
);

// a rating on a general question or a newsletter sign up makes no sense
inquirySchema.path("rating").validate(function (this: WithCategory, value: number | null | undefined) {
  return value === null || value === undefined || this.category === "feedback";
}, "{PATH} is only for feedback");

// the inbox lists inquiries by status, newest first
inquirySchema.index({ status: 1, createdAt: -1 });

inquirySchema.plugin(jsonPlugin);

export const Inquiry = model<InquiryData>("Inquiry", inquirySchema);
