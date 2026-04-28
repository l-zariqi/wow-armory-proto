import React, { useEffect, useRef } from "react";

let wowheadScriptLoading = false;

const loadWowheadScript = () => {
  return new Promise((resolve) => {
    // If already loaded
    if (window.$WowheadPower) {
      resolve();
      return;
    }

    // If already loading, wait for it
    if (wowheadScriptLoading) {
      const interval = setInterval(() => {
        if (window.$WowheadPower) {
          clearInterval(interval);
          resolve();
        }
      }, 100);
      return;
    }

    wowheadScriptLoading = true;

    const script = document.createElement("script");
    script.src = "https://wow.zamimg.com/widgets/power.js";
    script.async = true;
    script.onload = () => resolve();

    document.body.appendChild(script);
  });
};

const CharacterModel = ({ region, realmSlug, characterName }) => {
  const modelRef = useRef();

  useEffect(() => {
    if (!characterName || !realmSlug || !region) return;

    const renderModel = async () => {
      await loadWowheadScript();

      if (!modelRef.current) return;

      // Clear previous model
      modelRef.current.innerHTML = "";

      const div = document.createElement("div");
      div.className = "wowhead-model";
      div.setAttribute(
        "data-wowhead-model",
        `character=${characterName}&realm=${realmSlug}&region=${region.toLowerCase()}&game=classic`
      );

      modelRef.current.appendChild(div);

      if (window.$WowheadPower) {
        window.$WowheadPower.refreshLinks();
      }
    };

    renderModel();
  }, [characterName, realmSlug, region]);

  return (
    <div
      ref={modelRef}
      className="w-full h-full flex items-center justify-center text-gray-400"
    >
      Loading Model...
    </div>
  );
};

export default CharacterModel;
