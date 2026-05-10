import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders unified login page", () => {
  render(<App />);
  const headingElement = screen.getByText(/Unified Login/i);
  expect(headingElement).toBeInTheDocument();
});
