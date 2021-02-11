import {ITrackable} from "./ITrackable";
import {TrackingState} from "./TrackingState";
import {TrackingInterval} from "./TrackingInterval";
import {TimeObject, TimeFormat} from "./TimeObject";
import {v4 as uuidv4} from "uuid";
import { ITrackablesStore } from "../dataAccess/ITrackablesStore";
import { RGBColor } from "./RGBColor";
import { TimeSpan } from "../api/ActraAPI";

export class Activity implements ITrackable {
    public trackingHistory: Set<uuidv4>;
    private name: string;
    private readonly id: uuidv4;
    private color: RGBColor;
    private observers: Set<uuidv4>;
    private currentInterval: uuidv4;
    private readonly store: ITrackablesStore;
    constructor(store: ITrackablesStore, name: string = "NoName", color: RGBColor = new RGBColor(), id: uuidv4 = uuidv4()) {
        this.store = store;
        this.name = name;
        this.color = color;
        this.id = id;
        this.trackingHistory = new Set();
        this.observers = new Set();
        this.currentInterval = null;
    }
    getTrackingHistoryIds(): uuidv4[] {
        return [...this.trackingHistory.values()]
    }
    setCurrentInterval(id: uuidv4): void {
        this.currentInterval = id;
    }
    setName(name: string): void {
        this.name = name;
    }
    setColor(color: RGBColor): void {
        this.color = color;
    }
    getId() {
        return this.id;
    }
    getStore(): ITrackablesStore {
        return this.store;
    }
    getName(): string {
        return this.name;
    }
    getColor(): RGBColor {
        return this.color;
    }
    getTrackingHistory(): TrackingInterval[] {
        return [...this.trackingHistory].map((id: uuidv4) => this.store.getTrackingInterval(id));
    }
    setTrackingHistory(trackingHistory: TrackingInterval[]) {
        this.trackingHistory = new Set(trackingHistory.map((trackingInterval: TrackingInterval) => trackingInterval.getId()));
    }
    getObservers(): Set<uuidv4> {
        return this.observers;
    }
    setIntervalTime(intervalId: number, timeObject: TimeObject): TrackingInterval {
        let interval: TrackingInterval = this.getTrackingInterval(intervalId);
        if (interval !== null) {
            let endTimeSeconds = interval.endTimeSeconds !== null ? interval.endTimeSeconds : (Date.now() /1000);
            interval.startTimeSeconds = endTimeSeconds - timeObject.getTotalSeconds();
            return interval;
        } else {
            return null;
        }
    }
    async deleteInterval(intervalId: number) {
        this.trackingHistory.delete(intervalId);
        this.observers.forEach(observerId => this.store.getTrackableById(observerId).deleteInterval(intervalId));
        await this.store.deleteTrackingInterval(intervalId);
    }
    beginNewTrackingInterval(): number {
        let startTimeSeconds: number = new Date().getTime()/1000;
        let newInterval = new TrackingInterval(startTimeSeconds);
        this.currentInterval = newInterval.getId();
        this.addIntervalToTrackingHistory(newInterval);
        return startTimeSeconds;
    }
    finishTrackingInterval(): void {
        let endTimeSeconds: number = new Date().getTime()/1000;
        this.getCurrentInterval()?.setEndTime(endTimeSeconds);
    }
    startTracking(): number {
        if (this.getCurrentInterval()?.getTrackingState() === TrackingState.ACTIVE) {
            return;
        }
        let trackingId = this.beginNewTrackingInterval();
        this.observers.forEach((id: uuidv4) => this.store.getTrackableById(id).startTracking());
        return trackingId;
    }
    stopTracking(): void {
        if (this.getCurrentInterval() === null || this.getCurrentInterval().getTrackingState() === TrackingState.INACTIVE) {
            return;
        }
        this.finishTrackingInterval();
        this.observers.forEach((id: uuidv4) => this.store.getTrackableById(id).stopTracking());
    }
    addObserver(tracker: ITrackable): void {
        this.observers.add(tracker.getId());
    }
    removeObserver(id: uuidv4): void {
        this.observers.delete(id);
    }
    addIntervalToTrackingHistory(trackingInterval: TrackingInterval): void {
        this.trackingHistory.add(trackingInterval.getId());
        this.store.addTrackingInterval(trackingInterval, this.getId());
    }
    getTrackingState(): TrackingState {
        return this.getCurrentInterval()?.getTrackingState() || TrackingState.INACTIVE; 
    }
    getTrackingInterval(id: number): TrackingInterval {
        if (this.trackingHistory.has(id)) {
            return this.store.getTrackingInterval(id);
        } else {
            return null;
        }
    }
    getCurrentInterval(): TrackingInterval {
        return this.store.getTrackingInterval(this.currentInterval) || null;
    }
    getTrackable(searchId: uuidv4): ITrackable {
        return (this.id === searchId) ? this.store.getTrackableById(this.getId()) : null;
    }
    static buildTrackingHistoryMap(trackingIntervalObjectArray: Array<Object>): Map<uuidv4, TrackingInterval> {
        let trackingIntervalArray = trackingIntervalObjectArray.map(trackingIntervalObject => TrackingInterval.fromObject(trackingIntervalObject));
        let trackingHistoryMap: Map<uuidv4, TrackingInterval> = new Map();
        trackingIntervalArray.forEach((interval: TrackingInterval) => trackingHistoryMap.set(interval.getId(), interval));
        return trackingHistoryMap;
    }
    static extractTrackingHistory(store: ITrackablesStore, trackableObject: Object): Set<uuidv4> {
        return new Set(trackableObject['trackingHistory']) || new Set();
    }
    getTotalTrackedTime(format: TimeFormat = TimeFormat.HMS, overTimeSpan: TimeSpan = null): TimeObject {
        let sinceEpochSeconds = (Date.now() / 1000);
        let sinceTimeSeconds = null;
        if (overTimeSpan && typeof(overTimeSpan) === 'object' && Object.keys(overTimeSpan).length > 0 && typeof(overTimeSpan.since) !== 'undefined') {
            let overTimeSpanSeconds = TimeObject.fromObject(overTimeSpan.since).getTotalSeconds();
            sinceTimeSeconds = sinceEpochSeconds - overTimeSpanSeconds;
        }
        let trackingIntervalsList = this.getTrackingHistory();
        if (sinceTimeSeconds !== null) {
            trackingIntervalsList = trackingIntervalsList
                .filter((interval: TrackingInterval) => {
                    return (sinceTimeSeconds <= interval.startTimeSeconds)
                        || ((interval.startTimeSeconds < sinceTimeSeconds)
                            && ((sinceTimeSeconds < interval.endTimeSeconds) || (interval.getTrackingState() === TrackingState.ACTIVE))
                        )
                });
            trackingIntervalsList = trackingIntervalsList
                .map((interval: TrackingInterval) => {
                        let startTimeSeconds = interval.startTimeSeconds < sinceTimeSeconds ? sinceTimeSeconds : interval.startTimeSeconds;
                        let focusedInterval: TrackingInterval = new TrackingInterval(startTimeSeconds);
                        if (interval.getTrackingState() === TrackingState.INACTIVE) {
                            focusedInterval.endTimeSeconds = interval.endTimeSeconds;
                        } else {
                            focusedInterval.endTimeSeconds = sinceEpochSeconds;
                        }
                        focusedInterval.setTrackingState(TrackingState.INACTIVE);
                        return focusedInterval;
                    }
                );
        }
        let totalTime: TimeObject = new TimeObject(0, format);
        trackingIntervalsList.forEach(
            (interval: TrackingInterval) => {
                totalTime = TimeObject.add(totalTime, interval.toTimeObject(format))
            }
        );
        return totalTime;
    }
    toObject(): Object {
        return {
            id: this.getId(),
            name: this.getName(),
            color: this.getColor().toObject(),
            trackingHistory: [...this.trackingHistory],
            observers: [...this.getObservers()],
            currentInterval: this.currentInterval
        }
    }
    static fromObject(store: ITrackablesStore, trackableObject: Object): Activity {
        let activity = new Activity(
            store,
            trackableObject['name'],
            RGBColor.fromObject(trackableObject['color']),
            trackableObject['id']
        );
        activity.trackingHistory = Activity.extractTrackingHistory(store, trackableObject);
        activity.observers = new Set(trackableObject['observers']);
        activity.currentInterval = trackableObject['currentInterval'] ? trackableObject['currentInterval'] : null;
        return activity;
    }
    static copy(activity: Activity): Activity {
        return Activity.fromObject(activity.getStore(), activity.toObject());
    }
    getType(): string {
        return "activity";
    }
}