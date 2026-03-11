import { create } from "zustand";
import { Brand, Generation } from "./types";
import { mockBrands, mockGenerations } from "./mock-data";

interface BrandStore {
  brands: Brand[];
  generations: Generation[];
  addBrand: (brand: Omit<Brand, "id" | "created_at" | "updated_at">) => Brand;
  updateBrand: (id: string, data: Partial<Brand>) => void;
  deleteBrand: (id: string) => void;
  getBrand: (id: string) => Brand | undefined;
  addGeneration: (gen: Omit<Generation, "id" | "created_at">) => Generation;
  updateGeneration: (id: string, data: Partial<Generation>) => void;
}

export const useBrandStore = create<BrandStore>((set, get) => ({
  brands: mockBrands,
  generations: mockGenerations,

  addBrand: (data) => {
    const brand: Brand = {
      ...data,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    set((s) => ({ brands: [...s.brands, brand] }));
    return brand;
  },

  updateBrand: (id, data) => {
    set((s) => ({
      brands: s.brands.map((b) =>
        b.id === id ? { ...b, ...data, updated_at: new Date().toISOString() } : b
      ),
    }));
  },

  deleteBrand: (id) => {
    set((s) => ({ brands: s.brands.filter((b) => b.id !== id) }));
  },

  getBrand: (id) => get().brands.find((b) => b.id === id),

  addGeneration: (data) => {
    const gen: Generation = {
      ...data,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    };
    set((s) => ({ generations: [gen, ...s.generations] }));
    return gen;
  },

  updateGeneration: (id, data) => {
    set((s) => ({
      generations: s.generations.map((g) =>
        g.id === id ? { ...g, ...data } : g
      ),
    }));
  },
}));
