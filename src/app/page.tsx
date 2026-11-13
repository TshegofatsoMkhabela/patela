import type { Metadata } from "next";
import { PatelaHome } from "@/components/PatelaHome";
import "@/styles/freezpak-patela.css";

export const metadata: Metadata = {
  title: "Patela — Every handoff accounted for",
  description:
    "Coordinate orders, custody and rule-based payments across South African supply chains.",
};

export default function Home() {
  return <PatelaHome />;
}
