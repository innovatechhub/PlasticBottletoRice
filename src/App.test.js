import { render, screen } from "@testing-library/react";
import App from "./App";

// "/" is the public home page (the old test expected the login form there).
test("renders the public home page", async () => {
  render(<App />);
  expect(await screen.findByRole("heading", { name: "Bottles for rice" })).toBeInTheDocument();
  for (const link of screen.getAllByRole("link", { name: "Log in" })) {
    expect(link).toHaveAttribute("href", "/login");
  }
  expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual(
    expect.arrayContaining(["Collect bottles", "Insert in bin", "Get rice"])
  );
  expect(screen.queryByText(/Learn More|Join the Movement|Find a Station/)).not.toBeInTheDocument();
});
