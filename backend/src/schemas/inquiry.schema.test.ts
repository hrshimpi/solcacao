import { describe, expect, it } from "vitest";
import { inquiryCategories } from "../models/inquiry.model.ts";
import { inquirySchema } from "./inquiry.schema.ts";

const general = {
  category: "general",
  name: "Isabel Vasquez",
  email: "isabel@example.com",
  message: "Do you ship the Ecuador bar to Canada?",
};

// what went wrong, as "field: message" lines (empty when the data is fine)
function problems(data: unknown): string[] {
  const result = inquirySchema.safeParse(data);
  return result.success ? [] : result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
}

function parsed(data: unknown) {
  const result = inquirySchema.safeParse(data);
  if (!result.success) throw new Error(`should have been valid: ${problems(data).join(", ")}`);
  return result.data as Record<string, unknown>;
}

describe("inquiry schema: general, wholesale and support", () => {
  it.each(["general", "wholesale", "support"])("accepts a valid %s inquiry", (category) => {
    expect(parsed({ ...general, category })).toEqual({
      category,
      name: "Isabel Vasquez",
      email: "isabel@example.com",
      message: "Do you ship the Ecuador bar to Canada?",
    });
  });

  it("needs a name, an email and a message", () => {
    expect(problems({ category: "support" })).toEqual([
      "name: Please enter your name.",
      "email: Please enter your email address.",
      "message: Please write a message.",
    ]);
  });

  it("checks the name length (2 to 80)", () => {
    expect(problems({ ...general, name: "I" })).toEqual(["name: Your name needs at least 2 characters."]);
    expect(problems({ ...general, name: "ab" })).toEqual([]);
    expect(problems({ ...general, name: "a".repeat(80) })).toEqual([]);
    expect(problems({ ...general, name: "a".repeat(81) })).toEqual(["name: Your name can be at most 80 characters."]);
  });

  it("checks the message length (10 to 2000)", () => {
    expect(problems({ ...general, message: "too short" })).toEqual(["message: Your message needs at least 10 characters."]);
    expect(problems({ ...general, message: "a".repeat(10) })).toEqual([]);
    expect(problems({ ...general, message: "a".repeat(2000) })).toEqual([]);
    expect(problems({ ...general, message: "a".repeat(2001) })).toEqual(["message: Your message can be at most 2000 characters."]);
  });

  it("explains a wrong email address in plain words", () => {
    for (const email of ["isabel", "isabel@", "isabel@example", "isabel example@x.com"]) {
      expect(problems({ ...general, email }), email).toEqual([
        "email: That email address doesn't look right. It should look like name@example.com.",
      ]);
    }
  });

  it("writes the email in lower case", () => {
    expect(parsed({ ...general, email: "  Isabel@Example.COM " }).email).toBe("isabel@example.com");
  });

  it("does not accept a rating or other extra fields, they are dropped", () => {
    const result = parsed({ ...general, rating: 5, userId: "abc123", status: "responded" });

    expect(result).not.toHaveProperty("rating");
    expect(result).not.toHaveProperty("userId");
    expect(result).not.toHaveProperty("status");
  });
});

describe("inquiry schema: feedback", () => {
  it("only needs a rating", () => {
    expect(parsed({ category: "feedback", rating: 4 })).toEqual({ category: "feedback", rating: 4 });
  });

  it("takes an optional message and an optional email", () => {
    expect(parsed({ category: "feedback", rating: 5, message: "Loved the Peru bar", email: "Isabel@Example.com" })).toEqual({
      category: "feedback",
      rating: 5,
      message: "Loved the Peru bar",
      email: "isabel@example.com",
    });
  });

  it("treats an empty message and an empty email as not given", () => {
    const result = parsed({ category: "feedback", rating: 3, message: "   ", email: "" });

    expect(result.message).toBeUndefined();
    expect(result.email).toBeUndefined();
  });

  it("does not need a name", () => {
    expect(problems({ category: "feedback", rating: 2 })).toEqual([]);
  });

  it("still checks the email and the message length when they are given", () => {
    expect(problems({ category: "feedback", rating: 3, email: "nope" })).toEqual([
      "email: That email address doesn't look right. It should look like name@example.com.",
    ]);
    expect(problems({ category: "feedback", rating: 3, message: "a".repeat(2001) })).toEqual([
      "message: Your comment can be at most 2000 characters.",
    ]);
    expect(problems({ category: "feedback", rating: 3, message: "a".repeat(2000) })).toEqual([]);
  });

  describe("rating", () => {
    const ratingMessage = "rating: Please give a rating from 1 to 5.";

    it.each([1, 2, 3, 4, 5])("accepts %i", (rating) => {
      expect(parsed({ category: "feedback", rating }).rating).toBe(rating);
    });

    it.each([0, 6, -1, 2.5, 100])("rejects %s", (rating) => {
      expect(problems({ category: "feedback", rating })).toEqual([ratingMessage]);
    });

    it("is required", () => {
      expect(problems({ category: "feedback" })).toEqual([ratingMessage]);
      expect(problems({ category: "feedback", rating: null })).toEqual([ratingMessage]);
    });

    it("accepts a number written as text, like a form sends it", () => {
      expect(parsed({ category: "feedback", rating: "4" }).rating).toBe(4);
      expect(problems({ category: "feedback", rating: "7" })).toEqual([ratingMessage]);
    });

    it("rejects text that is not a number", () => {
      for (const rating of ["", "five", "4 stars", true, [], {}]) {
        expect(problems({ category: "feedback", rating }), String(rating)).toEqual([ratingMessage]);
      }
    });
  });
});

describe("inquiry schema: newsletter", () => {
  it("needs only an email", () => {
    expect(parsed({ category: "newsletter", email: "isabel@example.com" })).toEqual({
      category: "newsletter",
      email: "isabel@example.com",
    });
  });

  it("does not ask for a name or a message", () => {
    expect(problems({ category: "newsletter", email: "isabel@example.com" })).toEqual([]);
  });

  it("drops a name, message or rating if one is sent", () => {
    const result = parsed({ category: "newsletter", email: "isabel@example.com", name: "Isabel", message: "hello there", rating: 3 });

    expect(result).toEqual({ category: "newsletter", email: "isabel@example.com" });
  });

  it("is not valid without a good email", () => {
    expect(problems({ category: "newsletter" })).toEqual(["email: Please enter your email address."]);
    expect(problems({ category: "newsletter", email: "   " })).toEqual(["email: Please enter your email address."]);
    expect(problems({ category: "newsletter", email: "isabel" })).toEqual([
      "email: That email address doesn't look right. It should look like name@example.com.",
    ]);
  });
});

describe("inquiry schema: category", () => {
  it("has rules for every category the model knows", () => {
    const valid: Record<string, unknown> = {
      general,
      wholesale: { ...general, category: "wholesale" },
      support: { ...general, category: "support" },
      feedback: { category: "feedback", rating: 5 },
      newsletter: { category: "newsletter", email: "isabel@example.com" },
    };

    expect(Object.keys(valid).sort()).toEqual([...inquiryCategories].sort());
    for (const category of inquiryCategories) {
      expect(problems(valid[category]), category).toEqual([]);
    }
  });

  it("asks for a category when it is missing or not one of ours", () => {
    const message = "category: Please choose what your message is about: general, wholesale, support, feedback or newsletter.";

    expect(problems({ ...general, category: undefined })).toEqual([message]);
    expect(problems({ ...general, category: "complaint" })).toEqual([message]);
    expect(problems({ ...general, category: "General" })).toEqual([message]);
    expect(problems({})).toEqual([message]);
  });

  it("rejects things that are not an object", () => {
    expect(problems(null)).toHaveLength(1);
    expect(problems("hello")).toHaveLength(1);
    expect(problems(42)).toHaveLength(1);
  });
});

describe("inquiry schema: plain text only", () => {
  it("trims all the text", () => {
    const result = parsed({ ...general, name: "  Isabel  ", message: "\n  Do you ship to Canada?  \n" });

    expect(result.name).toBe("Isabel");
    expect(result.message).toBe("Do you ship to Canada?");
  });

  it("keeps line breaks inside a message", () => {
    expect(parsed({ ...general, message: "First line here\nSecond line here" }).message).toBe("First line here\nSecond line here");
  });

  it("strips tags from the name, the message and the feedback comment", () => {
    expect(parsed({ ...general, name: "<b>Isabel</b> <i>Vasquez</i>" }).name).toBe("Isabel Vasquez");
    expect(parsed({ ...general, message: "<p>Do you ship <a href='https://spam.example'>to Canada</a>?</p>" }).message).toBe(
      "Do you ship to Canada?",
    );
    expect(parsed({ category: "feedback", rating: 5, message: "<h1>Great</h1> chocolate" }).message).toBe("Great chocolate");
  });

  it("removes script and style blocks together with what is inside them", () => {
    const message = "Hello there<script>alert('hi')</script> friends<style>body{display:none}</style>!";

    expect(parsed({ ...general, message }).message).toBe("Hello there friends!");
  });

  it("removes comments and tags with attributes", () => {
    expect(parsed({ ...general, message: "Nice bars <!-- hidden note --><img src=x onerror=alert(1)> really" }).message).toBe(
      "Nice bars  really",
    );
  });

  it("removes a tag that was never closed", () => {
    expect(parsed({ ...general, message: "Please call me back soon <img src=x onerror=alert(1)" }).message).toBe(
      "Please call me back soon",
    );
  });

  it("removes a tag that is rebuilt from the pieces around a removed tag", () => {
    expect(parsed({ ...general, message: "Hello there <<b>script>alert(1)<</b>/script> friend" }).message).toBe("Hello there  friend");
    // here what is left over ("ipt>") is only plain text, the point is that no tag can be rebuilt
    const message = parsed({ ...general, message: "Hello <scr<b></b>ipt>alert(1)</scr<b></b>ipt> there, friend" }).message;
    expect(String(message)).not.toMatch(/<[!?/]?[a-z]/i);
    expect(String(message)).toContain("there, friend");
  });

  it("leaves no tag behind, whatever is sent", () => {
    const attacks = [
      "<img src=x onerror=alert(1)>",
      "<svg/onload=alert(1)>",
      "<<script>script>alert(1)<</script>/script>",
      "<!DOCTYPE html><html><body>hi",
      "<?php echo 1; ?> text",
      "<a href=\"javascript:alert(1)\">click",
      "<<<b>b>b>b>b>b>b>b>b>b>b>b>b>b>b>text",
      "<".repeat(5) + "b>".repeat(5) + "text",
      "<iframe src=//evil.example>",
      "</p></div></span> after",
    ];

    for (const attack of attacks) {
      const message = parsed({ category: "feedback", rating: 5, message: `${attack} done` }).message;
      expect(String(message), attack).not.toMatch(/<[!?/]?[a-z]/i);
    }
  });

  it("does not take long over text full of unfinished tags", () => {
    const started = Date.now();
    const result = inquirySchema.safeParse({ ...general, message: "<script>".repeat(1250) });

    expect(result.success).toBe(false);
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it("refuses text that is far too long before looking at it", () => {
    expect(problems({ ...general, message: "a".repeat(10001) })).toEqual(["message: That is too long to send. Please shorten it."]);
    expect(problems({ ...general, name: "a".repeat(10001) })).toEqual(["name: That is too long to send. Please shorten it."]);
  });

  it("keeps a plain less than or greater than sign", () => {
    expect(parsed({ ...general, message: "I <3 your chocolate, 2 > 1 for sure" }).message).toBe("I <3 your chocolate, 2 > 1 for sure");
  });

  it("counts the length after the tags are gone", () => {
    // 12 characters with the tags, only 5 of plain text
    expect(problems({ ...general, message: "<b>hello</b>" })).toEqual(["message: Your message needs at least 10 characters."]);
    expect(problems({ ...general, name: "<b>I</b>" })).toEqual(["name: Your name needs at least 2 characters."]);
  });

  it("treats a message that is only tags as empty", () => {
    expect(problems({ ...general, message: "<p></p><br>" })).toEqual(["message: Please write a message."]);
    expect(problems({ ...general, name: "<script>alert(1)</script>" })).toEqual(["name: Please enter your name."]);
  });

  it("does not let tags hide in an email", () => {
    expect(parsed({ category: "newsletter", email: "<b>isabel@example.com</b>" }).email).toBe("isabel@example.com");
  });

  it("rejects text fields that are not text", () => {
    expect(problems({ ...general, name: 42 })).toEqual(["name: Please enter your name."]);
    expect(problems({ ...general, message: ["a", "b"] })).toEqual(["message: Please write a message."]);
  });
});

describe("inquiry schema: honeypot", () => {
  it("is fine when the website field is missing or empty", () => {
    expect(problems(general)).toEqual([]);
    expect(problems({ ...general, website: "" })).toEqual([]);
    expect(problems({ category: "newsletter", email: "isabel@example.com", website: "" })).toEqual([]);
    expect(problems({ category: "feedback", rating: 5, website: "" })).toEqual([]);
  });

  it("fails when anything is in the website field, in every category", () => {
    const message = "website: We couldn't send this form. Please try again.";
    const bot = "https://spam.example";

    expect(problems({ ...general, website: bot })).toEqual([message]);
    expect(problems({ ...general, category: "wholesale", website: bot })).toEqual([message]);
    expect(problems({ category: "feedback", rating: 5, website: bot })).toEqual([message]);
    expect(problems({ category: "newsletter", email: "isabel@example.com", website: bot })).toEqual([message]);
    expect(problems({ ...general, website: " " })).toEqual([message]);
  });

  it("does not tell the bot what gave it away", () => {
    const [issue] = problems({ ...general, website: "x" });

    expect(issue.toLowerCase()).not.toContain("honeypot");
    expect(issue.toLowerCase()).not.toContain("bot");
    expect(issue.toLowerCase()).not.toContain("spam");
  });

  it("never passes the field on after the check", () => {
    expect(parsed({ ...general, website: "" })).not.toHaveProperty("website");
    expect(parsed({ category: "newsletter", email: "isabel@example.com", website: "" })).not.toHaveProperty("website");
  });
});
