import { Brand, Generation } from "./types";

export const mockBrands: Brand[] = [
  {
    id: "b1",
    name: "TinySteps Academy",
    logo_url: "https://images.unsplash.com/photo-1618160702438-9b02ab6515c9?w=100&h=100&fit=crop",
    primary_color: "#2563EB",
    secondary_color: "#DBEAFE",
    brand_voice_rules:
      "Subjects must strictly be 3-4 year old toddlers, not older kids. Warm, nurturing tone. Bright classroom settings only.",
    negative_prompts:
      "No teenagers or adults as main subjects. No dark or moody lighting. No hallucinated text or watermarks.",
    created_at: "2026-02-15T10:00:00Z",
    updated_at: "2026-03-01T14:30:00Z",
  },
  {
    id: "b2",
    name: "UrbanNest Realty",
    logo_url: "https://images.unsplash.com/photo-1721322800607-8c38375eef04?w=100&h=100&fit=crop",
    primary_color: "#0F172A",
    secondary_color: "#F59E0B",
    brand_voice_rules:
      "Luxury real estate focus. Clean, aspirational imagery. Modern interiors and exteriors only.",
    negative_prompts:
      "Never use the color green for backgrounds. No location pin symbols. Remove all background clutter. No cartoon-style graphics.",
    created_at: "2026-01-20T09:00:00Z",
    updated_at: "2026-03-05T11:00:00Z",
  },
  {
    id: "b3",
    name: "FreshBite Café",
    logo_url: "https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?w=100&h=100&fit=crop",
    primary_color: "#16A34A",
    secondary_color: "#FEF3C7",
    brand_voice_rules:
      "Organic, farm-to-table aesthetic. Bright, natural lighting. Food photography style.",
    negative_prompts:
      "No processed food imagery. No dark backgrounds. No generic stock photo feel.",
    created_at: "2026-03-01T08:00:00Z",
    updated_at: "2026-03-10T16:00:00Z",
  },
];

export const mockGenerations: Generation[] = [
  {
    id: "g1",
    brand_id: "b1",
    reference_image_url: "https://images.unsplash.com/photo-1618160702438-9b02ab6515c9?w=400",
    output_image_url: "https://images.unsplash.com/photo-1618160702438-9b02ab6515c9?w=800",
    status: "completed",
    created_at: "2026-03-10T14:30:00Z",
  },
  {
    id: "g2",
    brand_id: "b2",
    reference_image_url: "https://images.unsplash.com/photo-1721322800607-8c38375eef04?w=400",
    output_image_url: "https://images.unsplash.com/photo-1721322800607-8c38375eef04?w=800",
    status: "completed",
    created_at: "2026-03-09T11:00:00Z",
  },
  {
    id: "g3",
    brand_id: "b1",
    reference_image_url: "https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?w=400",
    output_image_url: "https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?w=800",
    status: "completed",
    created_at: "2026-03-08T09:15:00Z",
  },
  {
    id: "g4",
    brand_id: "b3",
    reference_image_url: "https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?w=400",
    output_image_url: "",
    status: "failed",
    created_at: "2026-03-07T16:45:00Z",
  },
];
