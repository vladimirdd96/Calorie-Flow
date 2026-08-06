"use client";
/* eslint-disable @next/next/no-img-element -- catalogue photos are hotlinked from their source sites. */

import { ChefHat, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { PublicRecipe } from "@/lib/types";

export function RecipeBrowseCard({ item, hideCalories, onOpen, featured = false }: { item: PublicRecipe; hideCalories?: boolean; onOpen: () => void; featured?: boolean }) {
  return <button type="button" className="recipe-browse-card" onClick={onOpen}>
    {item.imageUrl ? <img src={item.imageUrl} alt="" loading="lazy" /> : <span className="recipe-tile-icon">{item.source === "ai" ? <Sparkles size={22} /> : <ChefHat size={22} />}</span>}
    {featured && <span className="catalogue-pick-badge">Pick</span>}
    <span className="recipe-browse-card-overlay">
      <strong>{item.name}</strong>
      <small>{item.source === "ai" ? "AI pick" : "Community"}{!hideCalories && ` · ${Math.round(item.nutritionPerServing.calories)} kcal`}</small>
    </span>
  </button>;
}

export function CatalogueRow({ title, items, hideCalories, onOpen, featuredId }: { title: string; items: PublicRecipe[]; hideCalories?: boolean; onOpen: (item: PublicRecipe) => void; featuredId?: string }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canScrollBack, setCanScrollBack] = useState(false);
  const [canScrollForward, setCanScrollForward] = useState(false);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const updateControls = () => {
      const maximum = track.scrollWidth - track.clientWidth;
      setCanScrollBack(track.scrollLeft > 2);
      setCanScrollForward(maximum > 2 && track.scrollLeft < maximum - 2);
    };
    const observer = new ResizeObserver(updateControls);
    observer.observe(track);
    track.addEventListener("scroll", updateControls, { passive: true });
    updateControls();
    return () => { observer.disconnect(); track.removeEventListener("scroll", updateControls); };
  }, [items.length]);

  const scroll = (direction: -1 | 1) => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollBy({ left: direction * Math.max(280, track.clientWidth * .82), behavior: "smooth" });
  };

  return <section className="catalogue-row">
    <h3>{title}</h3>
    {/* The controls sit in their own positioned wrapper so they span the track exactly, without covering the heading. */}
    <div className="catalogue-row-viewport">
      <div ref={trackRef} className="catalogue-row-track">{items.map((item) => <RecipeBrowseCard key={item.id} item={item} featured={item.id === featuredId} hideCalories={hideCalories} onOpen={() => onOpen(item)} />)}</div>
      {canScrollBack && <button type="button" className="catalogue-row-control previous" aria-label={`Show earlier recipes in ${title}`} onClick={() => scroll(-1)}><ChevronLeft /></button>}
      {canScrollForward && <button type="button" className="catalogue-row-control next" aria-label={`Show more recipes in ${title}`} onClick={() => scroll(1)}><ChevronRight /></button>}
    </div>
  </section>;
}
