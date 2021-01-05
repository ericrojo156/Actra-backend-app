import { ITrackablesStore } from "./ITrackablesStore";

export interface IPersistentStore extends ITrackablesStore {
    save(): Promise<boolean>;
    load(): Promise<boolean>;
};