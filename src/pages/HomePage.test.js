import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useAuth } from "../app/AuthContext";
import HomePage from "./HomePage";

jest.mock("../app/AuthContext", () => ({ useAuth: jest.fn() }));

function setup(currentUser) {
  useAuth.mockReturnValue({ currentUser });
  return render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>
  );
}

test("signed-out visitors get Log in", () => {
  setup(null);
  expect(screen.getAllByRole("link", { name: "Log in" })[0]).toHaveAttribute("href", "/login");
  expect(screen.queryByRole("link", { name: "Go to account" })).not.toBeInTheDocument();
});

test("a signed-in resident gets Go to account, linking to their home", () => {
  setup({ id: "u1", role: "user" });
  expect(screen.getByRole("link", { name: "Go to account" })).toHaveAttribute("href", "/user/home");
  expect(screen.queryByRole("link", { name: "Log in" })).not.toBeInTheDocument();
});

test("a signed-in admin's Go to account opens the dashboard", () => {
  setup({ id: "a1", role: "admin" });
  expect(screen.getByRole("link", { name: "Go to account" })).toHaveAttribute("href", "/admin/dashboard");
});
