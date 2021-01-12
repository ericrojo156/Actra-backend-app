import { Activity } from "../trackable/Activity";
import { Project } from "../trackable/Project";
import {v4 as uuidv4} from "uuid";
import { ITrackable } from "../trackable/ITrackable";
import { TimeFormat, TimeObject } from "../trackable/TimeObject";
import { TrackingInterval } from "../trackable/TrackingInterval";
import { TrackingIntervalAPI } from "../api/ActraAPI";

export interface ITrackablesStore {
    getAllTrackingIntervals(): Array<TrackingInterval>;
    setTrackingHistory(trackableId: uuidv4, trackingIntervals: TrackingInterval[]): void;
    getIntervalsToTrackables(): Object[];
    getTrackingIntervals(trackableId: uuidv4): TrackingIntervalAPI[];
    getTrackingInterval(id: uuidv4): TrackingInterval;
    addTrackingInterval(trackingInterval: TrackingInterval, trackableId: uuidv4): void;
    getCorrespondingTrackableOfInterval(intervalId: uuidv4): uuidv4;
    getVersion(): string;
    getStoreType(): string;
    getActivities(): Map<uuidv4, Activity>;
    getProjects(): Map<uuidv4, Project>;
    getTotalTrackedTime(id: uuidv4, overTimeSpan: Object, format: TimeFormat): TimeObject;
    setActivities(trackables: Array<Activity>);
    setProjects(trackables: Array<Project>);
    setTrackableName(trackableId: uuidv4, name: string): Promise<ITrackable>;
    getAllTrackableIds(): Array<uuidv4>;
    getTrackableById(id: uuidv4): ITrackable;
    putTrackable(trackable: ITrackable): void;
    deleteTrackable(id: uuidv4, deleteTrackingIntervalsFromStore: boolean): Promise<any>;
    deleteTrackingInterval(intervalId: number);
    addTrackableToProject(projectId: uuidv4, trackableId: uuidv4): boolean;
    getId(): uuidv4;
    nameIsRegistered(name: string): boolean;
    getCurrentlyActiveTrackableId();
    setCurrentlyActiveTrackableId(trackableId);
    toObject(): Object;
}
