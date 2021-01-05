import { IPersistentAndSerializableStore } from "../src/dataAccess/IPersistentAndSerializableStore";
import { IStorePersistence } from "../src/dataAccess/IStorePersistence";

export class StorePersistenceMock implements IStorePersistence {
    save(payload: string): Promise<boolean> {
        return Promise.resolve(true);
    }
    load(): Promise<string> {
        return Promise.resolve("");
    }
}