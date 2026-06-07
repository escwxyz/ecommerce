import type { StoreRepository, StoreSettings } from "../domain";

export interface ResettableStoreRepository extends StoreRepository {
  clear(): void;
}

export class InMemoryStoreRepository implements ResettableStoreRepository {
  #settings: StoreSettings | null = null;

  clear(): void {
    this.#settings = null;
  }

  getStoreSettings(): Promise<StoreSettings | null> {
    return Promise.resolve(this.#settings);
  }

  saveStoreSettings(settings: StoreSettings): Promise<StoreSettings> {
    this.#settings = settings;
    return Promise.resolve(settings);
  }
}

export const defaultStoreRepository = new InMemoryStoreRepository();

export const createInMemoryStoreRepository = (): StoreRepository =>
  new InMemoryStoreRepository();

export const createResettableInMemoryStoreRepository =
  (): ResettableStoreRepository => new InMemoryStoreRepository();
