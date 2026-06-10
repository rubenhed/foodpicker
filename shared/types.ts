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

export type StateSnapshotMessage = {
  type: typeof MessageType.STATE_SNAPSHOT;
  selfId: string;
  hostId: string | null;
  searchResult: HotPepperResponse | null;
  votes: Record<string, string>;
  participantIds: string[];
};

export type ServerMessage = StateSnapshotMessage;

export type ClientMessage =
  | {
      type: typeof MessageType.JOIN;
      name: string;
    }
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
