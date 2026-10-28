import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ProfilePage } from "./ProfilePage";
import { AuthProvider } from "../auth/AuthContext";

describe("ProfilePage Component", () => {
  it("renders account dashboard and address tabs successfully", () => {
    render(
      <AuthProvider>
        <ProfilePage />
      </AuthProvider>
    );

    expect(screen.getByRole("heading", { name: /Account Dashboard/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /Account Details/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /Saved Addresses/i })).toBeDefined();
  });
});