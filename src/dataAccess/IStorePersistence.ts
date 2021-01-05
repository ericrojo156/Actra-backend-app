
export interface IStorePersistence {
    save(payload: string): Promise<boolean>;
    load(): Promise<string>;
}