import { IPersistentStore } from "./IPersistentStore";
import { ISerializableStore } from "./ISerializableStore";

export interface IPersistentAndSerializableStore extends IPersistentStore, ISerializableStore {}
