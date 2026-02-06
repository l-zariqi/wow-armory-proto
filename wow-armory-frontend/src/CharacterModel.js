import React, { useEffect, useRef } from "react";

const CharacterModel = ({ region, realmSlug, characterName }) => {
  const modelRef = useRef();

  useEffect(() => {
    if (!characterName || !realmSlug || !region) return;

    // Clear previous model if any
    if (modelRef.current) modelRef.current.innerHTML = "";

    // Create Wowhead model div
    const div = document.createElement("div");
    div.className = "wowhead-model";
    div.setAttribute(
      "data-wowhead-model",
      `character=${characterName}&realm=${realmSlug}&region=${region.toLowerCase()}`
    );

    modelRef.current.appendChild(div);

    // Render via Wowhead power.js
    if (window.$WowheadPower) {
      window.$WowheadPower.refreshLinks();
    }
  }, [characterName, realmSlug, region]);

  return <div ref={modelRef} className="w-full h-full" />;
};

export default CharacterModel;
