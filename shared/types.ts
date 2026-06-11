// types.ts
import { MessageType } from "./constants";

export type HotPepperShop = {
  id: string;
  name: string;
  genre: { code: string; name: string };
  lat: number;
  lng: number;
  photo: { pc: { l: string } };
  urls: { pc: string };
};

export type HotPepperResponse = {
  results: {
    results_available: number;
    results_returned: number;
    results_start: number;
    shop: HotPepperShop[];
  };
};

export type Participant = {
  userId: string;
  name: string;
};

export type Snapshot = {
  selfId: string;
  hostId: string | null;
  searchResult?: HotPepperResponse | null;
  votes: Record<string, string>;
  participants: Participant[];
};

export type ClientMessage =
  | {
      type: typeof MessageType.SEARCH;
      lat: number;
      lng: number;
      range: number;
      lunch: boolean;
      genre?: string;
    }
  | {
      type: typeof MessageType.VOTE;
      restaurantId: string;
    };
