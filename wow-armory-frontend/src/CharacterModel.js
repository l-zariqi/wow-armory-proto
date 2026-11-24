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

  return imageUrl ? (
    <img
      src={imageUrl}
      alt="Character render"
      className="h-full w-full object-contain"
      style={{ transform: "scale(2.75)" }}
      referrerPolicy="no-referrer"
      onError={() => {
        setImageIndex((currentIndex) => currentIndex + 1);
      }}
    />
  ) : (
    <div className="flex h-full w-full items-center justify-center p-4 text-center text-gray-400">
      Character image unavailable
    </div>
  );
};

export default CharacterModel;
