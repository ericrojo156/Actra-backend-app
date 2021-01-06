import { ILogger, Logger } from "../Logger";
import { Activity } from "../trackable/Activity";
import { ITrackable } from "../trackable/ITrackable";
import { Project } from "../trackable/Project";
import { TrackableType } from "../trackable/TrackableType";
import { IPersistentAndSerializableStore } from "./IPersistentAndSerializableStore";
import { IDeserializer } from "./ISerializableStore";
import { ITrackablesStore } from "./ITrackablesStore";
import { TrackablesStore } from "./TrackablesStore";
import { v4 as uuidv4 } from "uuid";
import { IStorePersistence } from "./IStorePersistence";
import { NodeFileSystemStorePersistence } from "./NodeFileSystemStorePersistence";
import { TimeFormat, TimeObject } from "../trackable/TimeObject";
import { TrackingInterval } from "../trackable/TrackingInterval";
import {Mutex} from 'async-mutex';

const latestStoreVersion: string = "v.0.3";
const jsonPeristentStore: string = "JsonPersistentStore";

export class JSONStoreDeserializer implements IDeserializer {
    deserialize(serializedStore: string): ITrackablesStore {
        let storeObject = JSON.parse(serializedStore);
        let store = new TrackablesStore(latestStoreVersion, jsonPeristentStore, storeObject['storeId']);
        let activities = storeObject['activities'];
        if (activities) {
            store.setActivities(activities.map((activityObj: Object) => Activity.fromObject(store, activityObj)));
        }
        let projects = storeObject['projects'];
        if (projects) {
            store.setProjects(projects.map((projectObj: Object) => Project.fromObject(store, projectObj)));
        }
        store.setTrackingIntervals(storeObject);
        store.setIntervalsToTrackablesMap(storeObject);
        store.setCurrentlyActiveTrackableId(storeObject['currentlyActiveTrackableId'] || null)
        return store;
    }
    deserializeTrackable(store: ITrackablesStore, serializedTrackable: string): ITrackable {
        let trackableObject: Object = JSON.parse(serializedTrackable);
        if (trackableObject['type'] === TrackableType.PROJECT) {
            return Project.fromObject(store, trackableObject);
        } else {
            return Activity.fromObject(store, trackableObject);
        }
    }
}

export class JsonPersistentStore implements IPersistentAndSerializableStore {
    mutex: Mutex;
    logger: ILogger;
    store: ITrackablesStore;
    deserializer: IDeserializer;
    persistenceLayer: IStorePersistence;
    constructor(persistenceLayer: IStorePersistence = new NodeFileSystemStorePersistence(), deserializer: IDeserializer = new JSONStoreDeserializer()) {
        this.mutex = new Mutex();
        this.logger = new Logger();
        this.deserializer = deserializer;
        this.store = new TrackablesStore(latestStoreVersion, jsonPeristentStore);
        this.persistenceLayer = persistenceLayer;
    }
    getCurrentlyActiveTrackableId() {
        return this.store.getCurrentlyActiveTrackableId();
    }
    setCurrentlyActiveTrackableId(trackableId) {
        this.store.setCurrentlyActiveTrackableId(trackableId);
    }
    setTrackingHistory(trackableId: any, trackingIntervals: TrackingInterval[]): void {
        this.store.setTrackingHistory(trackableId, trackingIntervals);
    }
    getIntervalsToTrackables(): Object[] {
        return this.store.getIntervalsToTrackables();
    }
    getCorrespondingTrackableOfInterval(intervalId: any): uuidv4 {
        return this.store.getCorrespondingTrackableOfInterval(intervalId);
    }
    async setTrackableName(trackableId: any, name: string): Promise<ITrackable> {
        let trackable = await this.store.setTrackableName(trackableId, name);
        this.save(); // perform save after completing ITrackableStore.setTrackableName(), but then run concurrently to process that consumes the resultant trackable
        return trackable;
    }
    async deleteTrackingInterval(intervalId: number): Promise<boolean> {
        await this.store.deleteTrackingInterval(intervalId);
        return this.save();
    }
    nameIsRegistered(name: string): boolean {
        return this.store.nameIsRegistered(name);
    }
    getAllTrackingIntervals(): TrackingInterval[] {
        return this.store.getAllTrackingIntervals();
    }
    async deleteTrackable(id: uuidv4, deleteTrackingIntervalsFromStore: boolean = true): Promise<any> {
        return this.store.deleteTrackable(id, deleteTrackingIntervalsFromStore);
    }
    getTrackingInterval(id: number): TrackingInterval {
        return this.store.getTrackingInterval(id);
    }
    addTrackingInterval(trackingInterval: TrackingInterval, trackableId: uuidv4): void {
        this.store.addTrackingInterval(trackingInterval, trackableId);
    }
    getVersion(): string {
        return this.store.getVersion();
    }
    getStoreType(): string {
        return this.store.getStoreType();
    }
    getId(): uuidv4 {
        return this.store.getId();
    }
    async save(): Promise<boolean> {
        let succeeded = false;
        const release = await this.mutex.acquire();
        try {
            let serializedStore: string = this.serialize();
            succeeded = await this.persistenceLayer.save(serializedStore);
        } finally {
            release();
        }
        return succeeded;
    }
    async load(): Promise<boolean> {
        let loaded = false;
        const release = await this.mutex.acquire();
        try {
            loaded = await this.persistenceLayer.load()
                .then((serializedStore: string) => {
                    this.store = this.deserializer.deserialize(serializedStore);
                    return true;
                })
                .catch(e => {
                    this.logger.log(e);
                    this.store = new TrackablesStore(latestStoreVersion, jsonPeristentStore);
                    return false;
                });
        } finally {
            release();
        }
        return loaded;
    }
    serialize(): string {
        let storeObject = {};
        storeObject['storeId'] = this.store.getId();
        storeObject['version'] = this.store.getVersion();
        storeObject['storeType'] = this.store.getStoreType();
        storeObject['activities'] = [...this.store.getActivities().values()].map((activity: ITrackable) => activity.toObject());
        storeObject['projects'] = [...this.store.getProjects().values()].map((project: ITrackable) => project.toObject());
        storeObject['trackingIntervals'] = this.store.getAllTrackingIntervals().map((interval: TrackingInterval) => interval.toObject());
        storeObject['intervalsToTrackables'] = this.store.getIntervalsToTrackables();
        storeObject['currentlyActiveTrackableId'] = this.store.getCurrentlyActiveTrackableId();
        return JSON.stringify(storeObject);
    }
    updateTrackable(trackable: ITrackable): boolean {
        try {
            this.store.putTrackable(trackable);
            return true;
        } catch (e) {
            return false;
        }
    }
    getActivities(): Map<uuidv4, Activity> {
        return this.store.getActivities();
    }

    getProjects(): Map<uuidv4, Project> {
        return this.store.getProjects();
    }

    setActivities(trackables: Array<Activity>): void {
        this.store.setActivities(trackables);
        this.save();
    }

    setProjects(trackables: Array<Project>): void {
        this.store.setProjects(trackables);
        this.save();
    }

    getAllTrackableIds(): Array<uuidv4> {
        return [...this.getActivities().keys(), ...this.getProjects().keys()];
    }

    getTrackableById(id: uuidv4): ITrackable {
        return this.store.getTrackableById(id);
    }

    putTrackable(trackable: ITrackable): void {
        this.store.putTrackable(trackable);
        this.save();
    }

    addTrackableToProject(projectId: any, trackableId: any): boolean {
        let success: boolean = this.store.addTrackableToProject(projectId, trackableId);
        this.save();
        return success;
    }

    serializeTrackable(trackable: ITrackable): string {
        let trackableObject = {};
        trackableObject['type'] = TrackableType.ACTIVITY;
        trackableObject['name'] = trackable.getName();
        trackableObject['color'] = trackable.getColor();
        trackableObject['id'] = trackable.getId();
        trackableObject['trackingHistory'] = trackable.getTrackingHistory().map(interval => 
            {
                return {
                    startTimeSeconds: interval.startTimeSeconds,
                    endTimeSeconds: interval.endTimeSeconds,
                    state: interval.state
                };
            }
        );
        trackableObject['observers'] = [...trackable.getObservers()];
        trackableObject['currentInterval'] = trackable.getCurrentInterval();
        if (trackable instanceof Project) {
            let projectObject = {};
            projectObject['projectActivity'] = trackableObject;
            projectObject['trackables'] = trackable.getTrackables().map((trackable: ITrackable) => trackable.getId());
            trackableObject = projectObject;
            trackableObject['type'] = TrackableType.PROJECT;
        }
        return JSON.stringify(trackableObject);           
    }
    getTotalTrackedTime(id: uuidv4, overTimeSpan: Object = null, format: TimeFormat): TimeObject {
        return this.store.getTotalTrackedTime(id, overTimeSpan, format);
    }
    toObject(): Object {
        return this.store.toObject();
    }
}
