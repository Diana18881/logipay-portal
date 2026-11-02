"use client";

import { useEffect, useRef, useState } from "react";

// Real footage for the landing hero: European trucks on a motorway (Pixabay video 37379, Pixabay Content License),
// cut to a seamless 10 s loop and colour graded. Phones get a smaller 4:3 cut; reduced motion keeps the still frame.
export function HeroVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 759px)");
    const update = () => setPhone(query.matches);
    const frame = requestAnimationFrame(update);
    query.addEventListener("change", update);
    return () => { cancelAnimationFrame(frame); query.removeEventListener("change", update); };
  }, []);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches || (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    if (still) return;
    video.src = phone ? "/hero/trucks-phone.mp4" : "/hero/trucks.mp4";
    video.play().catch(() => { /* autoplay blocked: the poster stays */ });
  }, [phone]);
  return (
    <div className="lp-photo-frame">
      <video ref={ref} muted loop playsInline autoPlay preload="none" poster={phone ? "/hero/trucks-phone.webp" : "/hero/trucks.webp"} onPlaying={(event) => event.currentTarget.classList.add("playing")} />
    </div>
  );
}
