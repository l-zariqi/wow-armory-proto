import { fireEvent, render, screen } from "@testing-library/react";
import CharacterModel from "./CharacterModel";

it("shows the character image without a dressing room link and falls back when it fails", () => {
  render(
    <CharacterModel media={{ assets: [
      { key: "main", value: "/main.jpg" },
      { key: "avatar", value: "/avatar.jpg" }
    ] }} />
  );

  const image = screen.getByAltText("Character render");
  expect(image.getAttribute("src")).toBe("/main.jpg");
  expect(screen.queryByRole("link", { name: /dressing room/i })).toBeNull();
  fireEvent.error(image);
  expect(screen.getByAltText("Character render").getAttribute("src")).toBe("/avatar.jpg");
});
