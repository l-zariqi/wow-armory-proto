import React, { useMemo, useState } from "react";

const CharacterModel = ({ media }) => {
  const imageUrls = useMemo(() => {
    const assets = media?.assets || [];
    const preferredKeys = ["main-raw", "main", "inset", "avatar"];

    return preferredKeys
      .map((key) => assets.find((asset) => asset.key === key)?.value)
      .filter(Boolean);
  }, [media]);
  const [imageIndex, setImageIndex] = useState(0);
  const imageUrl = imageUrls[imageIndex];

  if (!imageUrl) {
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-400 text-center p-4">
        Character image unavailable
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt="Character render"
      className="w-full h-full object-contain"
      style={{ transform: "scale(2.75)" }}
      referrerPolicy="no-referrer"
      onError={() => {
        setImageIndex((currentIndex) => currentIndex + 1);
      }}
    />
  );
};

export default CharacterModel;
