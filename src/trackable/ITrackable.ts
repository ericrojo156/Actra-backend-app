import {TrackingInterval} from "./TrackingInterval";
import {v4 as uuidv4} from "uuid";
import { TimeFormat, TimeObject } from "./TimeObject";
import { ITrackablesStore } from "../dataAccess/ITrackablesStore";
import { TrackingState } from "./TrackingState";
import { RGBColor } from "./RGBColor";

export interface ITracker {
    getCurrentInterval(): TrackingInterval;
    setCurrentInterval(id: uuidv4): void;
    beginNewTrackingInterval(): number;
    finishTrackingInterval(): void;
    getTrackingHistory(): Array<TrackingInterval>;
    startTracking(): number;
    stopTracking(): void;
    addIntervalToTrackingHistory(TrackingInterval): void;
    getTrackingState(): TrackingState;
    getTrackingInterval(id: uuidv4): TrackingInterval;
    setIntervalTime(id: number, setTime: TimeObject): TrackingInterval;
    deleteInterval(intervalId: number): void;
}

export interface IObservable {
    getObservers(): Set<uuidv4>;
    addObserver(id: uuidv4): void;
    removeObserver(id: uuidv4): void;
}

export interface ITrackable extends ITracker, IObservable {
    getId(): uuidv4;
    getStore(): ITrackablesStore;
    getName(): string;
    setName(name: string): void;
    getColor(): RGBColor;
    setColor(color: RGBColor): void;
    getTrackable(id: uuidv4): ITrackable;
    getTotalTrackedTime(format: TimeFormat, overTimeSpan: Object): TimeObject;
    setTrackingHistory(trackingHistory: TrackingInterval[]);
    toObject(): Object;
    getType(): string;
}