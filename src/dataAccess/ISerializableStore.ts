import { ITrackable } from "../trackable/ITrackable";
import { ITrackablesStore } from "./ITrackablesStore";

export interface IDeserializer {
    deserialize(serializedStore: string): ITrackablesStore;
    deserializeTrackable(store: ITrackablesStore, serializedTrackable: string): ITrackable; 
}

export interface ISerializableStore extends ITrackablesStore {
    serialize(): string;
    serializeTrackable(trackable: ITrackable): string;
    readonly deserializer: IDeserializer;
}